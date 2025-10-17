import type { RouterOutputs } from "@api/trpc/types";
import type { QueryClient, InfiniteData } from "@tanstack/react-query";

import type { ConversationEvent } from "./conversation-event-cache";
import type { ConversationMessage } from "./conversation-message-cache";

export type ConversationTimelineResponse =
        RouterOutputs["conversation"]["getTimeline"];

export type ConversationTimelineItem =
        ConversationTimelineResponse["items"][number];

export type ConversationTimelineMessageItem = Extract<
        ConversationTimelineItem,
        { type: "message" }
>;

export type ConversationTimelineEventItem = Extract<
        ConversationTimelineItem,
        { type: "event" }
>;

export type ConversationTimelinePage = {
        items: ConversationTimelineItem[];
        nextCursor: string | null;
};

export type ConversationTimelineCursor = string | null;

export type ConversationTimelineInfiniteData = InfiniteData<
        ConversationTimelinePage,
        ConversationTimelineCursor
>;

type ConversationTimelineQueryParams = {
        conversationId: string;
        websiteSlug: string;
        limit: number;
};

const TIMELINE_TYPE_PRIORITY = {
        message: 2,
        event: 1,
} as const;

type TimelineType = keyof typeof TIMELINE_TYPE_PRIORITY;

function getTimelineItemCreatedAt(item: ConversationTimelineItem): Date {
        if (item.type === "message") {
                return new Date(item.message.createdAt);
        }

        return new Date(item.event.createdAt);
}

function getTimelineItemId(item: ConversationTimelineItem): string {
        if (item.type === "message") {
                return item.message.id;
        }

        return item.event.id;
}

function sortTimelineItems(
        items: ConversationTimelineItem[]
): ConversationTimelineItem[] {
        return [...items].sort((a, b) => {
                const timeDiff = getTimelineItemCreatedAt(a).getTime() -
                        getTimelineItemCreatedAt(b).getTime();

                if (timeDiff !== 0) {
                        return timeDiff;
                }

                if (a.type !== b.type) {
                        return (
                                TIMELINE_TYPE_PRIORITY[a.type as TimelineType] -
                                TIMELINE_TYPE_PRIORITY[b.type as TimelineType]
                        );
                }

                return getTimelineItemId(a).localeCompare(getTimelineItemId(b));
        });
}

function asTimelineMessage(
        message: ConversationMessage
): ConversationTimelineMessageItem {
        return {
                type: "message",
                message,
        } satisfies ConversationTimelineMessageItem;
}

function asTimelineEvent(
        event: ConversationEvent
): ConversationTimelineEventItem {
        return {
                type: "event",
                event,
        } satisfies ConversationTimelineEventItem;
}

export function createConversationTimelineQueryKey(
        params: ConversationTimelineQueryParams
) {
        return [
                "conversation",
                "timeline",
                {
                        conversationId: params.conversationId,
                        websiteSlug: params.websiteSlug,
                        limit: params.limit,
                },
        ] as const;
}

export function createConversationTimelineInfiniteQueryKey(
        params: ConversationTimelineQueryParams
) {
        return [
                ...createConversationTimelineQueryKey(params),
                { type: "infinite" },
        ] as const;
}

function initializeInfiniteDataWithMessage(
        message: ConversationMessage,
        existing?: ConversationTimelineInfiniteData
): ConversationTimelineInfiniteData {
        const firstPageParam = existing?.pageParams.at(0) ?? null;

        return {
                pages: [
                        {
                                items: [asTimelineMessage(message)],
                                nextCursor: null,
                        },
                ],
                pageParams: [firstPageParam],
        } satisfies ConversationTimelineInfiniteData;
}

function initializeInfiniteDataWithEvent(
        event: ConversationEvent,
        existing?: ConversationTimelineInfiniteData
): ConversationTimelineInfiniteData {
        const firstPageParam = existing?.pageParams.at(0) ?? null;

        return {
                pages: [
                        {
                                items: [asTimelineEvent(event)],
                                nextCursor: null,
                        },
                ],
                pageParams: [firstPageParam],
        } satisfies ConversationTimelineInfiniteData;
}

function upsertMessageInInfiniteData(
        existing: ConversationTimelineInfiniteData | undefined,
        message: ConversationMessage
): ConversationTimelineInfiniteData {
        if (!existing || existing.pages.length === 0) {
                return initializeInfiniteDataWithMessage(message, existing);
        }

        let messageExists = false;

        const pages = existing.pages.map((page, index) => {
                const currentItems = [...page.items];
                const existingIndex = currentItems.findIndex(
                        (item) => item.type === "message" && item.message.id === message.id
                );

                if (existingIndex !== -1) {
                        messageExists = true;
                        currentItems[existingIndex] = asTimelineMessage(message);
                        return {
                                ...page,
                                items: sortTimelineItems(currentItems),
                        } satisfies ConversationTimelinePage;
                }

                if (!messageExists && index === existing.pages.length - 1) {
                        currentItems.push(asTimelineMessage(message));
                        return {
                                ...page,
                                items: sortTimelineItems(currentItems),
                        } satisfies ConversationTimelinePage;
                }

                return page;
        });

        return {
                pages,
                pageParams: [...existing.pageParams],
        } satisfies ConversationTimelineInfiniteData;
}

function removeMessageFromInfiniteData(
        existing: ConversationTimelineInfiniteData | undefined,
        messageId: string
): ConversationTimelineInfiniteData | undefined {
        if (!existing) {
                return existing;
        }

        let removed = false;

        const pages = existing.pages.map((page) => {
                const filtered = page.items.filter(
                        (item) => !(item.type === "message" && item.message.id === messageId)
                );

                if (filtered.length !== page.items.length) {
                        removed = true;
                        return {
                                ...page,
                                items: filtered,
                        } satisfies ConversationTimelinePage;
                }

                return page;
        });

        if (!removed) {
                return existing;
        }

        return {
                pages,
                pageParams: [...existing.pageParams],
        } satisfies ConversationTimelineInfiniteData;
}

function upsertEventInInfiniteData(
        existing: ConversationTimelineInfiniteData | undefined,
        event: ConversationEvent
): ConversationTimelineInfiniteData {
        if (!existing || existing.pages.length === 0) {
                return initializeInfiniteDataWithEvent(event, existing);
        }

        let eventExists = false;

        const pages = existing.pages.map((page, index) => {
                const currentItems = [...page.items];
                const existingIndex = currentItems.findIndex(
                        (item) => item.type === "event" && item.event.id === event.id
                );

                if (existingIndex !== -1) {
                        eventExists = true;
                        currentItems[existingIndex] = asTimelineEvent(event);
                        return {
                                ...page,
                                items: sortTimelineItems(currentItems),
                        } satisfies ConversationTimelinePage;
                }

                if (!eventExists && index === existing.pages.length - 1) {
                        currentItems.push(asTimelineEvent(event));
                        return {
                                ...page,
                                items: sortTimelineItems(currentItems),
                        } satisfies ConversationTimelinePage;
                }

                return page;
        });

        return {
                pages,
                pageParams: [...existing.pageParams],
        } satisfies ConversationTimelineInfiniteData;
}

export function upsertConversationTimelineMessageInCache(
        queryClient: QueryClient,
        queryKey: readonly unknown[],
        message: ConversationMessage
) {
        queryClient.setQueryData<ConversationTimelineInfiniteData | undefined>(
                queryKey,
                (existing) => upsertMessageInInfiniteData(existing, message)
        );
}

export function removeConversationTimelineMessageFromCache(
        queryClient: QueryClient,
        queryKey: readonly unknown[],
        messageId: string
) {
        queryClient.setQueryData<ConversationTimelineInfiniteData | undefined>(
                queryKey,
                (existing) => removeMessageFromInfiniteData(existing, messageId)
        );
}

export function upsertConversationTimelineEventInCache(
        queryClient: QueryClient,
        queryKey: readonly unknown[],
        event: ConversationEvent
) {
        queryClient.setQueryData<ConversationTimelineInfiniteData | undefined>(
                queryKey,
                (existing) => upsertEventInInfiniteData(existing, event)
        );
}
