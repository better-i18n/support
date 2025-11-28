"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { ulid } from "ulid";
import type {
        TimelinePartFile,
        TimelinePartImage,
} from "@cossistant/types/api/timeline-item";
import type {
        GenerateUploadUrlRequest,
        GenerateUploadUrlResponse,
} from "@cossistant/types/api/upload";
import {
        type ConversationTimelineItem,
        createConversationTimelineItemsInfiniteQueryKey,
        removeConversationTimelineItemFromCache,
        upsertConversationTimelineItemInCache,
} from "@/data/conversation-message-cache";
import { useTRPC } from "@/lib/trpc/client";
import { uploadToPresignedUrl } from "@/components/ui/avatar-input";

type SubmitPayload = {
        message: string;
        files: File[];
};

type UseSendConversationMessageOptions = {
        conversationId: string;
        websiteSlug: string;
        websiteId: string;
        organizationId: string;
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
        websiteId,
        organizationId,
        currentUserId,
        pageLimit = DEFAULT_PAGE_LIMIT,
}: UseSendConversationMessageOptions): UseSendConversationMessageReturn {
        const trpc = useTRPC();
        const queryClient = useQueryClient();

	const timelineItemsQueryKey = useMemo(
		() =>
			createConversationTimelineItemsInfiniteQueryKey(
				trpc.conversation.getConversationTimelineItems.queryOptions({
					conversationId,
					websiteSlug,
					limit: pageLimit,
				}).queryKey
			),
		[conversationId, pageLimit, trpc, websiteSlug]
	);

        const { mutateAsync: sendMessage, isPending } = useMutation(
                trpc.conversation.sendMessage.mutationOptions()
        );

        const { mutateAsync: createSignedUrl } = useMutation(
                trpc.upload.createSignedUrl.mutationOptions()
        );

        const submit = useCallback(
                async ({ message, files }: SubmitPayload) => {
                        const trimmedMessage = message.trim();

                        if (!trimmedMessage && files.length === 0) {
                                return;
                        }

                        const timelineItemId = ulid();
                        const timestamp = new Date().toISOString();

                        const fileParts = await Promise.all(
                                files.map((file) =>
                                        uploadFileToTimelinePart({
                                                createSignedUrl,
                                                file,
                                                conversationId,
                                                organizationId,
                                                websiteId,
                                                timelineItemId,
                                        })
                                )
                        );

                        const parts: ConversationTimelineItem["parts"] = [
                                ...(trimmedMessage
                                        ? ([{ type: "text", text: trimmedMessage }] as const)
                                        : []),
                                ...fileParts,
                        ];

                        const optimisticItem: ConversationTimelineItem = {
                                id: timelineItemId,
                                conversationId,
                                organizationId: "", // Will be set by backend
                                type: "message",
                                text: trimmedMessage,
                                parts,
                                visibility: "public",
                                userId: currentUserId,
                                aiAgentId: null,
				visitorId: null,
				createdAt: timestamp,
				deletedAt: null,
			};

			await queryClient.cancelQueries({ queryKey: timelineItemsQueryKey });

			upsertConversationTimelineItemInCache(
				queryClient,
				timelineItemsQueryKey,
				optimisticItem
			);

			try {
				const response = await sendMessage({
                                        conversationId,
                                        websiteSlug,
                                        text: trimmedMessage,
                                        parts,
                                        visibility: "public",
                                        timelineItemId,
                                });

				const { item: createdItem } = response;

				upsertConversationTimelineItemInCache(
					queryClient,
					timelineItemsQueryKey,
					{
						...createdItem,
						parts: createdItem.parts as ConversationTimelineItem["parts"],
					}
				);
			} catch (error) {
				removeConversationTimelineItemFromCache(
					queryClient,
					timelineItemsQueryKey,
					timelineItemId
				);

				throw error;
			}
		},
                [
                        conversationId,
                        currentUserId,
                        timelineItemsQueryKey,
                        queryClient,
                        sendMessage,
                        createSignedUrl,
                        organizationId,
                        websiteId,
                        websiteSlug,
                ]
        );

        return {
                submit,
                isPending,
        };
}

async function uploadFileToTimelinePart({
        createSignedUrl,
        file,
        conversationId,
        organizationId,
        websiteId,
        timelineItemId,
}: {
        createSignedUrl: (
                params: Omit<GenerateUploadUrlRequest, "scope"> & {
                        scope: Extract<
                                GenerateUploadUrlRequest["scope"],
                                { type: "conversation" }
                        >;
                }
        ) => Promise<GenerateUploadUrlResponse>;
        file: File;
        conversationId: string;
        organizationId: string;
        websiteId: string;
        timelineItemId: string;
}): Promise<TimelinePartImage | TimelinePartFile> {
        const contentType = file.type || "application/octet-stream";

        const uploadDetails = await createSignedUrl({
                contentType,
                fileName: file.name,
                websiteId,
                path: `conversations/${conversationId}/timeline-items/${timelineItemId}`,
                scope: {
                        type: "conversation",
                        conversationId,
                        organizationId,
                        websiteId,
                },
                useCdn: false,
        });

        await uploadToPresignedUrl({
                file,
                url: uploadDetails.uploadUrl,
                headers: { "Content-Type": contentType },
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
