import { clearTypingFromMessage } from "@cossistant/react/realtime/typing-store";
import type { MessageType, MessageVisibility } from "@cossistant/types";
import type { RealtimeEvent } from "@cossistant/types/realtime-events";
import type { ConversationHeader } from "@/data/conversation-header-cache";
import {
        type ConversationMessage,
        upsertConversationMessageInCache,
} from "@/data/conversation-message-cache";
import { upsertConversationTimelineMessageInCache } from "@/data/conversation-timeline-cache";
import type { DashboardRealtimeContext } from "../types";
import { forEachConversationHeadersQuery } from "./utils/conversation-headers";

type MessageCreatedEvent = RealtimeEvent<"messageCreated">;

type ConversationMessagesQueryInput = {
        conversationId?: string;
        websiteSlug?: string;
};

type QueryKeyInput = {
        input?: ConversationMessagesQueryInput;
        type?: string;
};

type ConversationTimelineQueryParams = {
        conversationId?: string;
        websiteSlug?: string;
        limit?: number;
};

type TimelineQueryMarker = {
        type?: string;
};

function toConversationMessage(
	eventMessage: MessageCreatedEvent["payload"]["message"]
): ConversationMessage {
	return {
		...eventMessage,
		type: eventMessage.type as MessageType,
		visibility: eventMessage.visibility as MessageVisibility,
		createdAt: eventMessage.createdAt,
		updatedAt: eventMessage.updatedAt,
		deletedAt: eventMessage.deletedAt ? eventMessage.deletedAt : null,
	};
}

function toHeaderLastMessage(
	eventMessage: MessageCreatedEvent["payload"]["message"]
): NonNullable<ConversationHeader["lastMessagePreview"]> {
	return { ...eventMessage };
}

function extractQueryInput(
	queryKey: readonly unknown[]
): ConversationMessagesQueryInput | null {
	if (queryKey.length < 2) {
		return null;
	}

	const maybeInput = queryKey[1];
	if (!maybeInput || typeof maybeInput !== "object") {
		return null;
	}

	const input = (maybeInput as QueryKeyInput).input;
	if (!input || typeof input !== "object") {
		return null;
	}

	return input;
}

function isInfiniteQueryKey(queryKey: readonly unknown[]): boolean {
        const marker = queryKey[2];
        return Boolean(
                marker &&
                        typeof marker === "object" &&
                        "type" in marker &&
                        (marker as QueryKeyInput).type === "infinite"
        );
}

function extractTimelineParams(
        queryKey: readonly unknown[]
): ConversationTimelineQueryParams | null {
        if (queryKey.length < 3) {
                return null;
        }

        const params = queryKey[2];
        if (!params || typeof params !== "object") {
                return null;
        }

        return params as ConversationTimelineQueryParams;
}

function isTimelineInfiniteQueryKey(queryKey: readonly unknown[]): boolean {
        const marker = queryKey[3];
        return Boolean(
                marker &&
                        typeof marker === "object" &&
                        "type" in marker &&
                        (marker as TimelineQueryMarker).type === "infinite"
        );
}

export const handleMessageCreated = ({
	event,
	context,
}: {
	event: MessageCreatedEvent;
	context: DashboardRealtimeContext;
}) => {
	const { queryClient, website } = context;
	const { payload } = event;
	const { message } = payload;
	const conversationMessage = toConversationMessage(message);

	// Clear typing state when a message is sent
	clearTypingFromMessage(event);

	const headerMessage = toHeaderLastMessage(payload.message);

	const queries = queryClient
		.getQueryCache()
		.findAll({ queryKey: [["conversation", "getConversationMessages"]] });

        for (const query of queries) {
                const queryKey = query.queryKey as readonly unknown[];

                if (!isInfiniteQueryKey(queryKey)) {
                        continue;
		}

		const input = extractQueryInput(queryKey);
		if (!input) {
			continue;
		}

		if (input.conversationId !== payload.conversationId) {
			continue;
		}

		if (input.websiteSlug !== website.slug) {
			continue;
		}

                upsertConversationMessageInCache(
                        queryClient,
                        queryKey,
                        conversationMessage
                );
        }

        const timelineQueries = queryClient
                .getQueryCache()
                .findAll({ queryKey: ["conversation", "timeline"] });

        for (const query of timelineQueries) {
                const queryKey = query.queryKey as readonly unknown[];

                if (!isTimelineInfiniteQueryKey(queryKey)) {
                        continue;
                }

                const params = extractTimelineParams(queryKey);
                if (!params) {
                        continue;
                }

                if (params.conversationId !== payload.conversationId) {
                        continue;
                }

                if (params.websiteSlug !== website.slug) {
                        continue;
                }

                upsertConversationTimelineMessageInCache(
                        queryClient,
                        queryKey,
                        conversationMessage
                );
        }

	const existingHeader =
		context.queryNormalizer.getObjectById<ConversationHeader>(
			payload.conversationId
		);

	if (!existingHeader) {
		forEachConversationHeadersQuery(
			queryClient,
			context.website.slug,
			(queryKey) => {
				queryClient
					.invalidateQueries({
						queryKey,
						exact: true,
					})
					.catch((error) => {
						console.error(
							"Failed to invalidate conversation header queries:",
							error
						);
					});
			}
		);
		return;
	}

	context.queryNormalizer.setNormalizedData({
		...existingHeader,
		lastMessagePreview: headerMessage,
		lastMessageAt: headerMessage.createdAt,
		updatedAt: headerMessage.updatedAt,
	});
};
