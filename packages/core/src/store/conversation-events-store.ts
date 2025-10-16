import type { ConversationEvent, RealtimeEvent } from "@cossistant/types";
import { createStore, type Store } from "./create-store";

type ConversationEventCreated = RealtimeEvent<"conversationEventCreated">;

export type ConversationEventsState = {
        events: ConversationEvent[];
        hasNextPage: boolean;
        nextCursor?: string;
};

export type ConversationEventsStoreState = {
        conversations: Record<string, ConversationEventsState>;
};

const INITIAL_STATE: ConversationEventsStoreState = {
        conversations: {},
};

function sortEvents(events: ConversationEvent[]): ConversationEvent[] {
        return [...events].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
}

function isSameEvent(a: ConversationEvent, b: ConversationEvent): boolean {
        return (
                a.id === b.id &&
                new Date(a.createdAt).getTime() === new Date(b.createdAt).getTime() &&
                new Date(a.updatedAt).getTime() === new Date(b.updatedAt).getTime()
        );
}

function mergeEvents(
        existing: ConversationEvent[],
        incoming: ConversationEvent[]
): ConversationEvent[] {
        if (incoming.length === 0) {
                return existing;
        }

        const byId = new Map<string, ConversationEvent>();
        for (const event of existing) {
                byId.set(event.id, event);
        }

        let changed = false;
        for (const event of incoming) {
                const previous = byId.get(event.id);
                if (!(previous && isSameEvent(previous, event))) {
                        changed = true;
                }
                byId.set(event.id, event);
        }

        if (!changed && byId.size === existing.length) {
                let orderStable = true;
                for (const event of existing) {
                        if (byId.get(event.id) !== event) {
                                orderStable = false;
                                break;
                        }
                }

                if (orderStable) {
                        return existing;
                }
        }

        return sortEvents(Array.from(byId.values()));
}

function applyPage(
        state: ConversationEventsStoreState,
        conversationId: string,
        page: Pick<ConversationEventsState, "events" | "hasNextPage" | "nextCursor">
): ConversationEventsStoreState {
        const existing = state.conversations[conversationId];
        const merged = mergeEvents(existing?.events ?? [], page.events);

        if (
                existing &&
                existing.events === merged &&
                existing.hasNextPage === page.hasNextPage &&
                existing.nextCursor === page.nextCursor
        ) {
                return state;
        }

        return {
                ...state,
                conversations: {
                        ...state.conversations,
                        [conversationId]: {
                                events: merged,
                                hasNextPage: page.hasNextPage,
                                nextCursor: page.nextCursor,
                        },
                },
        } satisfies ConversationEventsStoreState;
}

function applyEvent(
        state: ConversationEventsStoreState,
        conversationId: string,
        event: ConversationEvent
): ConversationEventsStoreState {
        const existing = state.conversations[conversationId];
        const merged = mergeEvents(existing?.events ?? [], [event]);

        if (existing && existing.events === merged) {
                return state;
        }

        return {
                ...state,
                conversations: {
                        ...state.conversations,
                        [conversationId]: {
                                events: merged,
                                hasNextPage: existing?.hasNextPage ?? false,
                                nextCursor: existing?.nextCursor,
                        },
                },
        } satisfies ConversationEventsStoreState;
}

function normalizeRealtimeEvent(
        event: ConversationEventCreated
): ConversationEvent {
        const payload = event.payload.event;
        return {
                id: payload.id,
                organizationId: payload.organizationId,
                conversationId: payload.conversationId,
                type: payload.type,
                actorUserId: payload.actorUserId,
                actorAiAgentId: payload.actorAiAgentId,
                targetUserId: payload.targetUserId,
                targetAiAgentId: payload.targetAiAgentId,
                message: payload.message ?? undefined,
                metadata: payload.metadata ?? undefined,
                createdAt: payload.createdAt,
                updatedAt: payload.updatedAt,
                deletedAt: payload.deletedAt ?? null,
        } satisfies ConversationEvent;
}

export type ConversationEventsStore = Store<ConversationEventsStoreState> & {
        ingestPage(
                conversationId: string,
                page: Pick<ConversationEventsState, "events" | "hasNextPage" | "nextCursor">
        ): void;
        ingestEvent(conversationId: string, event: ConversationEvent): void;
        ingestRealtime(event: RealtimeEvent<"conversationEventCreated">): ConversationEvent;
        clearConversation(conversationId: string): void;
};

export function createConversationEventsStore(
        initialState: ConversationEventsStoreState = INITIAL_STATE
): ConversationEventsStore {
        const store = createStore<ConversationEventsStoreState>(initialState);

        return {
                ...store,
                ingestPage(conversationId, page) {
                        store.setState((state) => applyPage(state, conversationId, page));
                },
                ingestEvent(conversationId, event) {
                        store.setState((state) => applyEvent(state, conversationId, event));
                },
                ingestRealtime(event) {
                        const conversationEvent = normalizeRealtimeEvent(event);
                        store.setState((state) =>
                                applyEvent(state, event.payload.conversationId, conversationEvent)
                        );
                        return conversationEvent;
                },
                clearConversation(conversationId) {
                        store.setState((state) => {
                                if (!state.conversations[conversationId]) {
                                        return state;
                                }

                                const { [conversationId]: _removed, ...rest } = state.conversations;

                                return {
                                        ...state,
                                        conversations: rest,
                                } satisfies ConversationEventsStoreState;
                        });
                },
        };
}

export function getConversationEvents(
        store: Store<ConversationEventsStoreState>,
        conversationId: string
): ConversationEventsState | undefined {
        return store.getState().conversations[conversationId];
}
