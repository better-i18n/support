import type { RouterOutputs } from "@api/trpc/types";
import type { RealtimeEvent } from "@cossistant/types/realtime-events";
import { upsertConversationEventInCache } from "@/data/conversation-event-cache";
import { upsertConversationTimelineEventInCache } from "@/data/conversation-timeline-cache";
import type { DashboardRealtimeContext } from "../types";

type ConversationEventCreated = RealtimeEvent<"conversationEventCreated">;

type ConversationEventsQueryInput = {
        conversationId?: string;
        websiteSlug?: string;
};

type QueryKeyInput = {
        input?: ConversationEventsQueryInput;
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

type ConversationEvent =
        RouterOutputs["conversation"]["getConversationEvents"]["items"][number];

function toConversationEvent(
        event: ConversationEventCreated["payload"]["event"]
): ConversationEvent {
        return {
                id: event.id,
                organizationId: event.organizationId,
                conversationId: event.conversationId,
                type: event.type,
                actorUserId: event.actorUserId,
                actorAiAgentId: event.actorAiAgentId,
                targetUserId: event.targetUserId,
                targetAiAgentId: event.targetAiAgentId,
                message: event.message ?? undefined,
                metadata: event.metadata ?? undefined,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt,
                deletedAt: event.deletedAt ?? null,
        } satisfies ConversationEvent;
}

function extractQueryInput(queryKey: readonly unknown[]): ConversationEventsQueryInput | null {
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

export const handleConversationEventCreated = ({
        event,
        context,
}: {
        event: ConversationEventCreated;
        context: DashboardRealtimeContext;
}) => {
        const { queryClient, website } = context;
        const { payload } = event;
        const normalizedEvent = toConversationEvent(payload.event);

        const queries = queryClient
                .getQueryCache()
                .findAll({ queryKey: [["conversation", "getConversationEvents"]] });

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

                upsertConversationEventInCache(queryClient, queryKey, normalizedEvent);
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

                upsertConversationTimelineEventInCache(
                        queryClient,
                        queryKey,
                        normalizedEvent
                );
        }
};
