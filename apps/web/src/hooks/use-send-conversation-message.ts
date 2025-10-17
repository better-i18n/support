"use client";

import { MessageType, MessageVisibility } from "@cossistant/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
        type ConversationMessage,
        createConversationMessagesInfiniteQueryKey,
        removeConversationMessageFromCache,
        upsertConversationMessageInCache,
} from "@/data/conversation-message-cache";
import {
        createConversationTimelineInfiniteQueryKey,
        removeConversationTimelineMessageFromCache,
        upsertConversationTimelineMessageInCache,
} from "@/data/conversation-timeline-cache";
import { useTRPC } from "@/lib/trpc/client";

type SubmitPayload = {
	message: string;
	files: File[];
};

type UseSendConversationMessageOptions = {
	conversationId: string;
	websiteSlug: string;
	currentUserId: string;
	pageLimit?: number;
};

type UseSendConversationMessageReturn = {
	submit: (payload: SubmitPayload) => Promise<void>;
	isPending: boolean;
};

const DEFAULT_PAGE_LIMIT = 50;

export function useSendConversationMessage({
	conversationId,
	websiteSlug,
	currentUserId,
	pageLimit = DEFAULT_PAGE_LIMIT,
}: UseSendConversationMessageOptions): UseSendConversationMessageReturn {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

        const messagesQueryKey = useMemo(
                () =>
                        createConversationMessagesInfiniteQueryKey(
                                trpc.conversation.getConversationMessages.queryOptions({
                                        conversationId,
                                        websiteSlug,
                                        limit: pageLimit,
                                }).queryKey
                        ),
                [conversationId, pageLimit, trpc, websiteSlug]
        );

        const timelineQueryKey = useMemo(
                () =>
                        createConversationTimelineInfiniteQueryKey({
                                conversationId,
                                websiteSlug,
                                limit: pageLimit,
                        }),
                [conversationId, pageLimit, websiteSlug]
        );

	const { mutateAsync: sendMessage, isPending } = useMutation(
		trpc.conversation.sendMessage.mutationOptions()
	);

	const submit = useCallback(
		async ({ message, files }: SubmitPayload) => {
			const trimmedMessage = message.trim();

			if (!trimmedMessage) {
				return;
			}

			if (files.length > 0) {
				throw new Error("File attachments are not supported yet.");
			}

			const optimisticId = `optimistic-${crypto.randomUUID()}`;
			const timestamp = new Date();

			const optimisticMessage: ConversationMessage = {
				id: optimisticId,
				bodyMd: trimmedMessage,
				type: MessageType.TEXT,
				userId: currentUserId,
				aiAgentId: null,
				parentMessageId: null,
				modelUsed: null,
				visitorId: null,
				conversationId,
				createdAt: timestamp,
				updatedAt: timestamp,
				deletedAt: null,
				visibility: MessageVisibility.PUBLIC,
			};

                        await Promise.all([
                                queryClient.cancelQueries({ queryKey: messagesQueryKey }),
                                queryClient.cancelQueries({ queryKey: timelineQueryKey }),
                        ]);

                        upsertConversationMessageInCache(
                                queryClient,
                                messagesQueryKey,
                                optimisticMessage
                        );
                        upsertConversationTimelineMessageInCache(
                                queryClient,
                                timelineQueryKey,
                                optimisticMessage
                        );

			try {
				const response = await sendMessage({
					conversationId,
					websiteSlug,
					bodyMd: trimmedMessage,
					type: MessageType.TEXT,
					visibility: MessageVisibility.PUBLIC,
				});

				const { message: createdMessage } = response;

                                removeConversationMessageFromCache(
                                        queryClient,
                                        messagesQueryKey,
                                        optimisticId
                                );
                                removeConversationTimelineMessageFromCache(
                                        queryClient,
                                        timelineQueryKey,
                                        optimisticId
                                );

				const normalizedMessage: ConversationMessage = {
					...createdMessage,
					createdAt: new Date(createdMessage.createdAt),
					updatedAt: new Date(createdMessage.updatedAt),
					deletedAt: createdMessage.deletedAt
						? new Date(createdMessage.deletedAt)
						: null,
				};

                                upsertConversationMessageInCache(
                                        queryClient,
                                        messagesQueryKey,
                                        normalizedMessage
                                );
                                upsertConversationTimelineMessageInCache(
                                        queryClient,
                                        timelineQueryKey,
                                        normalizedMessage
                                );
                        } catch (error) {
                                removeConversationMessageFromCache(
                                        queryClient,
                                        messagesQueryKey,
                                        optimisticId
                                );
                                removeConversationTimelineMessageFromCache(
                                        queryClient,
                                        timelineQueryKey,
                                        optimisticId
                                );

                                throw error;
                        }
                },
                [
                        conversationId,
                        currentUserId,
                        messagesQueryKey,
                        timelineQueryKey,
                        queryClient,
                        sendMessage,
                        websiteSlug,
                ]
        );

	return {
		submit,
		isPending,
	};
}
