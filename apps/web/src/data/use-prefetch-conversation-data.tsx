"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

type PrefetchConversationDataOptions = {
	websiteSlug: string;
	conversationId: string;
	visitorId: string;
	limit?: number;
};

export function usePrefetchConversationData() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const prefetchConversation = async ({
		websiteSlug,
		conversationId,
		visitorId,
		limit = 50,
	}: PrefetchConversationDataOptions) => {
		const prefetchPromises: Promise<void>[] = [];

                // Prefetch combined conversation timeline (messages + events)
                const timelineQueryOptions =
                        trpc.conversation.getTimeline.queryOptions({
                                websiteSlug,
                                conversationId,
                                limit,
                                cursor: null,
                        });

                const timelineCachedData = queryClient.getQueryData(
                        timelineQueryOptions.queryKey
                );

                if (!timelineCachedData) {
                        prefetchPromises.push(
                                queryClient.prefetchQuery(timelineQueryOptions).catch((error) => {
                                        console.warn(
                                                "Failed to prefetch conversation timeline:",
                                                error
                                        );
                                })
                        );
                }

                // Prefetch conversation messages
                const messagesQueryOptions =
                        trpc.conversation.getConversationMessages.queryOptions({
                                websiteSlug,
				conversationId,
				limit,
				cursor: null,
			});

		// Check if messages data is already cached
		const messagesCachedData = queryClient.getQueryData(
			messagesQueryOptions.queryKey
		);

		if (!messagesCachedData) {
			prefetchPromises.push(
				queryClient.prefetchQuery(messagesQueryOptions).catch((error) => {
					console.warn("Failed to prefetch conversation messages:", error);
				})
			);
		}

		// Prefetch visitor data
		const visitorQueryOptions = trpc.conversation.getVisitorById.queryOptions({
			websiteSlug,
			visitorId,
		});

		// Check if visitor data is already cached
		const visitorCachedData = queryClient.getQueryData(
			visitorQueryOptions.queryKey
		);

		if (!visitorCachedData) {
			prefetchPromises.push(
				queryClient.prefetchQuery(visitorQueryOptions).catch((error) => {
					console.warn("Failed to prefetch visitor data:", error);
				})
			);
		}

		// Execute all prefetch operations in parallel
		await Promise.allSettled(prefetchPromises);
	};

	return {
		prefetchConversation,
	};
}
