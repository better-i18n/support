import type { RouterOutputs } from "@api/trpc/types";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

export type ConversationEventsPage =
        RouterOutputs["conversation"]["getConversationEvents"];
export type ConversationEvent = ConversationEventsPage["items"][number];

function sortEventsByCreatedAt(events: ConversationEvent[]): ConversationEvent[] {
        return [...events].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
}

function initializeInfiniteData(
        event: ConversationEvent,
        existing?: InfiniteData<ConversationEventsPage>
): InfiniteData<ConversationEventsPage> {
        const firstPageParam =
                existing && existing.pageParams.length > 0 ? existing.pageParams[0] : null;

        return {
                pages: [
                        {
                                items: [event],
                                nextCursor: existing?.pages[0]?.nextCursor ?? null,
                                hasNextPage: existing?.pages[0]?.hasNextPage ?? false,
                        },
                ],
                pageParams: [firstPageParam],
        } satisfies InfiniteData<ConversationEventsPage>;
}

function upsertEventInInfiniteData(
        existing: InfiniteData<ConversationEventsPage> | undefined,
        event: ConversationEvent
): InfiniteData<ConversationEventsPage> {
        if (!existing || existing.pages.length === 0) {
                return initializeInfiniteData(event, existing);
        }

        let eventExists = false;

        const pages = existing.pages.map((page, pageIndex) => {
                const currentItems = [...page.items];
                const existingIndex = currentItems.findIndex((item) => item.id === event.id);

                if (existingIndex !== -1) {
                        eventExists = true;
                        currentItems[existingIndex] = event;
                        return {
                                ...page,
                                items: sortEventsByCreatedAt(currentItems),
                        } satisfies ConversationEventsPage;
                }

                if (!eventExists && pageIndex === existing.pages.length - 1) {
                        return {
                                ...page,
                                items: sortEventsByCreatedAt([...currentItems, event]),
                        } satisfies ConversationEventsPage;
                }

                return page;
        });

        return {
                pages,
                pageParams: [...existing.pageParams],
        } satisfies InfiniteData<ConversationEventsPage>;
}

export function createConversationEventsInfiniteQueryKey(
        baseQueryKey: readonly unknown[]
) {
        return [...baseQueryKey, { type: "infinite" }] as const;
}

export function upsertConversationEventInCache(
        queryClient: QueryClient,
        queryKey: readonly unknown[],
        event: ConversationEvent
) {
        queryClient.setQueryData<InfiniteData<ConversationEventsPage>>(
                queryKey,
                (existing) => upsertEventInInfiniteData(existing, event)
        );
}
