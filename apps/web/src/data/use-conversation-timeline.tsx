"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { ConversationEvent } from "@/data/conversation-event-cache";
import type { ConversationMessage } from "@/data/conversation-message-cache";
import {
        createConversationTimelineInfiniteQueryKey,
        type ConversationTimelineCursor,
        type ConversationTimelineItem,
        type ConversationTimelinePage,
} from "@/data/conversation-timeline-cache";
import { useTRPC } from "@/lib/trpc/client";

const DEFAULT_PAGE_LIMIT = 50;

// 5 minutes
const STALE_TIME = 300_000;

function normalizeMessage(message: ConversationMessage): ConversationMessage {
        return {
                ...message,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
        } satisfies ConversationMessage;
}

function normalizeEvent(event: ConversationEvent): ConversationEvent {
        return {
                ...event,
                metadata: event.metadata ?? undefined,
        } satisfies ConversationEvent;
}

function normalizeTimelineItems(
        items: ConversationTimelineItem[]
): ConversationTimelineItem[] {
        return items.map((item) => {
                if (item.type === "message") {
                        return {
                                type: "message" as const,
                                message: normalizeMessage(item.message),
                        } satisfies ConversationTimelineItem;
                }

                return {
                        type: "event" as const,
                        event: normalizeEvent(item.event),
                } satisfies ConversationTimelineItem;
        });
}

export function useConversationTimeline({
        websiteSlug,
        conversationId,
        limit = DEFAULT_PAGE_LIMIT,
}: {
        websiteSlug: string;
        conversationId: string;
        limit?: number;
}) {
        const trpc = useTRPC();
        const queryClient = useQueryClient();

        const queryKey = createConversationTimelineInfiniteQueryKey({
                conversationId,
                websiteSlug,
                limit,
        });

        const query = useInfiniteQuery({
                queryKey,
                queryFn: async ({ pageParam }) => {
                        const cursor = (pageParam ?? null) as ConversationTimelineCursor;

                        const response = await queryClient.fetchQuery(
                                trpc.conversation.getTimeline.queryOptions({
                                        websiteSlug,
                                        conversationId,
                                        limit,
                                        cursor,
                                })
                        );

                        return {
                                items: normalizeTimelineItems(response.items),
                                nextCursor: response.nextCursor ?? null,
                        } satisfies ConversationTimelinePage;
                },
                getNextPageParam: (lastPage) => lastPage.nextCursor,
                initialPageParam: null as ConversationTimelineCursor,
                staleTime: STALE_TIME,
        });

        const messages = useMemo(() => {
                return (
                        query.data?.pages
                                .flatMap((page) =>
                                        page.items
                                                .filter(
                                                        (item): item is Extract<
                                                                ConversationTimelineItem,
                                                                { type: "message" }
                                                        > => item.type === "message"
                                                )
                                                .map((item) => item.message)
                                )
                                .sort(
                                        (a, b) =>
                                                new Date(a.createdAt).getTime() -
                                                new Date(b.createdAt).getTime()
                                ) ?? []
                );
        }, [query.data?.pages]);

        const events = useMemo(() => {
                return (
                        query.data?.pages
                                .flatMap((page) =>
                                        page.items
                                                .filter(
                                                        (item): item is Extract<
                                                                ConversationTimelineItem,
                                                                { type: "event" }
                                                        > => item.type === "event"
                                                )
                                                .map((item) => item.event)
                                )
                                .sort(
                                        (a, b) =>
                                                new Date(a.createdAt).getTime() -
                                                new Date(b.createdAt).getTime()
                                ) ?? []
                );
        }, [query.data?.pages]);

        return {
                messages,
                events,
                isLoading: query.isLoading,
                isFetching: query.isFetching,
                isFetchingNextPage: query.isFetchingNextPage,
                hasNextPage: query.hasNextPage,
                fetchNextPage: query.fetchNextPage,
                error: query.error,
                refetch: query.refetch,
        };
}
