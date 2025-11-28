import type { CossistantClient } from "@cossistant/core";
import { generateMessageId } from "@cossistant/core";
import type { CreateConversationResponseBody } from "@cossistant/types/api/conversation";
import type {
        TimelineItem,
        TimelinePartFile,
        TimelinePartImage,
} from "@cossistant/types/api/timeline-item";
import type { GenerateUploadUrlRequest } from "@cossistant/types/api/upload";
import { useCallback, useState } from "react";

import { useSupport } from "../provider";

export type SendMessageOptions = {
	conversationId?: string | null;
	message: string;
	files?: File[];
	defaultTimelineItems?: TimelineItem[];
	visitorId?: string;
	/**
	 * Optional message ID to use for the optimistic update and API request.
	 * When not provided, a ULID will be generated on the client.
	 */
	messageId?: string;
	onSuccess?: (conversationId: string, messageId: string) => void;
	onError?: (error: Error) => void;
};

export type SendMessageResult = {
	conversationId: string;
	messageId: string;
	conversation?: CreateConversationResponseBody["conversation"];
	initialTimelineItems?: CreateConversationResponseBody["initialTimelineItems"];
};

export type UseSendMessageResult = {
	mutate: (options: SendMessageOptions) => void;
	mutateAsync: (
		options: SendMessageOptions
	) => Promise<SendMessageResult | null>;
	isPending: boolean;
	error: Error | null;
	reset: () => void;
};

export type UseSendMessageOptions = {
	client?: CossistantClient;
};

function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	if (typeof error === "string") {
		return new Error(error);
	}

	return new Error("Unknown error");
}

type UploadScope = Extract<GenerateUploadUrlRequest["scope"], { type: "conversation" }>;

async function buildTimelineItemPayload(
        body: string,
        parts: TimelineItem["parts"],
        conversationId: string,
        visitorId: string | null,
        messageId?: string
): Promise<TimelineItem> {
        const nowIso = typeof window !== "undefined" ? new Date().toISOString() : "";
        const id = messageId ?? generateMessageId();

        const payloadParts = parts.length
                ? parts
                : body
                        ? ([{ type: "text" as const, text: body }] satisfies TimelineItem["parts"])
                        : [];

        return {
                id,
                conversationId,
                organizationId: "", // Will be set by backend
                type: "message" as const,
                text: body,
                parts: payloadParts,
                visibility: "public" as const,
                userId: null,
                aiAgentId: null,
                visitorId: visitorId ?? null,
                createdAt: nowIso,
                deletedAt: null,
        } satisfies TimelineItem;
}

async function uploadToSignedUrl({
        file,
        url,
        contentType,
}: {
        file: File;
        url: string;
        contentType: string;
}): Promise<void> {
        const response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": contentType },
                body: file,
        });

        if (!response.ok) {
                throw new Error(`Upload failed with status ${response.status}`);
        }
}

async function uploadFileToTimelinePart({
        client,
        file,
        scope,
        websiteId,
        messageId,
}: {
        client: CossistantClient;
        file: File;
        scope: UploadScope;
        websiteId: string;
        messageId: string;
}): Promise<TimelinePartImage | TimelinePartFile> {
        const contentType = file.type || "application/octet-stream";

        const uploadDetails = await client.createUploadUrl({
                contentType,
                fileName: file.name,
                websiteId,
                path: `conversations/${scope.conversationId}/timeline-items/${messageId}`,
                scope,
                useCdn: false,
        });

        await uploadToSignedUrl({
                file,
                url: uploadDetails.uploadUrl,
                contentType,
        });

        if (contentType.startsWith("image/")) {
                return {
                        type: "image",
                        url: uploadDetails.publicUrl,
                        mediaType: contentType,
                        fileName: file.name,
                        size: file.size,
                } satisfies TimelinePartImage;
        }

        return {
                type: "file",
                url: uploadDetails.publicUrl,
                mediaType: contentType,
                fileName: file.name,
                size: file.size,
        } satisfies TimelinePartFile;
}

async function uploadFilesToTimelineParts({
        client,
        files,
        scope,
        websiteId,
        messageId,
}: {
        client: CossistantClient;
        files: File[];
        scope: UploadScope;
        websiteId: string;
        messageId: string;
}): Promise<Array<TimelinePartImage | TimelinePartFile>> {
        return Promise.all(
                files.map((file) =>
                        uploadFileToTimelinePart({
                                client,
                                file,
                                scope,
                                websiteId,
                                messageId,
                        })
                )
        );
}

/**
 * Sends visitor messages while handling optimistic pending conversations and
 * exposing react-query-like mutation state.
 */
export function useSendMessage(
	options: UseSendMessageOptions = {}
): UseSendMessageResult {
	const { client: contextClient } = useSupport();
	const client = options.client ?? contextClient;

	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const mutateAsync = useCallback(
		async (payload: SendMessageOptions): Promise<SendMessageResult | null> => {
                        const {
                                conversationId: providedConversationId,
                                message,
                                files = [],
                                defaultTimelineItems = [],
                                visitorId,
                                messageId: providedMessageId,
                                onSuccess,
                                onError,
                        } = payload;

                        const trimmedMessage = message.trim();

                        if (!trimmedMessage && files.length === 0) {
                                const emptyMessageError = new Error(
                                        "Please provide a message or attach files"
                                );
                                setError(emptyMessageError);
                                onError?.(emptyMessageError);
                                return null;
                        }

			setIsPending(true);
			setError(null);

                        try {
                                let conversationId = providedConversationId ?? undefined;
                                let preparedDefaultTimelineItems = defaultTimelineItems;
                                let initialConversation:
                                        | CreateConversationResponseBody["conversation"]
                                        | undefined;

                                if (!conversationId) {
                                        const initiated = client.initiateConversation({
                                                defaultTimelineItems,
                                                visitorId: visitorId ?? undefined,
                                        });
                                        conversationId = initiated.conversationId;
                                        preparedDefaultTimelineItems = initiated.defaultTimelineItems;
                                        initialConversation = initiated.conversation;
                                }

                                if (!conversationId) {
                                        throw new Error("Conversation ID is required to send a message");
                                }

                                const website = await client.fetchWebsite();
                                const messageId = providedMessageId ?? generateMessageId();
                                const uploadScope: UploadScope = {
                                        type: "conversation",
                                        conversationId,
                                        organizationId: website.organizationId,
                                        websiteId: website.id,
                                };

                                const fileParts = files.length
                                        ? await uploadFilesToTimelineParts({
                                                client,
                                                files,
                                                scope: uploadScope,
                                                websiteId: website.id,
                                                messageId,
                                        })
                                        : [];

                                const timelineParts: TimelineItem["parts"] = [
                                        ...(trimmedMessage
                                                ? ([
                                                        {
                                                                type: "text" as const,
                                                                text: trimmedMessage,
                                                        },
                                                ] as const satisfies TimelineItem["parts"])
                                                : []),
                                        ...fileParts,
                                ];

                                const timelineItemPayload = await buildTimelineItemPayload(
                                        trimmedMessage,
                                        timelineParts,
                                        conversationId,
                                        visitorId ?? null,
                                        messageId
                                );

				const response = await client.sendMessage({
					conversationId,
					item: {
						id: timelineItemPayload.id,
						text: timelineItemPayload.text ?? "",
						type:
							timelineItemPayload.type === "identification"
								? "message"
								: timelineItemPayload.type,
						visibility: timelineItemPayload.visibility,
						userId: timelineItemPayload.userId,
						aiAgentId: timelineItemPayload.aiAgentId,
						visitorId: timelineItemPayload.visitorId,
						createdAt: timelineItemPayload.createdAt,
						parts: timelineItemPayload.parts,
					},
					createIfPending: true,
				});

				const messageId = response.item.id;

				if (!messageId) {
					throw new Error("SendMessage response missing item.id");
				}

				const result: SendMessageResult = {
					conversationId,
					messageId,
				};

				if ("conversation" in response && response.conversation) {
					result.conversation = response.conversation;
					result.initialTimelineItems = response.initialTimelineItems;
				} else if (initialConversation) {
					result.conversation = initialConversation;
					result.initialTimelineItems = preparedDefaultTimelineItems;
				}

				setIsPending(false);
				setError(null);
				onSuccess?.(result.conversationId, result.messageId);
				return result;
			} catch (raw) {
				const normalised = toError(raw);
				setIsPending(false);
				setError(normalised);
				onError?.(normalised);
				throw normalised;
			}
		},
		[client]
	);

	const mutate = useCallback(
		(opts: SendMessageOptions) => {
			void mutateAsync(opts).catch(() => {
				// Swallow errors to mimic react-query behaviour for mutate
			});
		},
		[mutateAsync]
	);

	const reset = useCallback(() => {
		setError(null);
		setIsPending(false);
	}, []);

	return {
		mutate,
		mutateAsync,
		isPending,
		error,
		reset,
	};
}
