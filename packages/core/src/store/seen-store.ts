import type { RealtimeEvent } from "@cossistant/types/realtime-events";
import type { ConversationSeen } from "@cossistant/types/schemas";
import { createStore, type Store } from "./create-store";

export type SeenActorType = "visitor" | "user" | "ai_agent";

export type SeenEntry = {
	actorType: SeenActorType;
	actorId: string;
	lastSeenAt: string;
};

export type ConversationSeenState = Record<string, SeenEntry>;

export type SeenState = {
	conversations: Record<string, ConversationSeenState>;
};

const INITIAL_STATE: SeenState = {
	conversations: {},
};

type UpsertSeenOptions = {
	conversationId: string;
	actorType: SeenActorType;
	actorId: string;
	lastSeenAt: string;
};

function makeKey(
	conversationId: string,
	actorType: SeenActorType,
	actorId: string
): string {
	return `${conversationId}:${actorType}:${actorId}`;
}

function hasSameEntries(
	existing: ConversationSeenState | undefined,
	next: ConversationSeenState
): boolean {
	if (!existing) {
		return false;
	}

	const existingKeys = Object.keys(existing);
	const nextKeys = Object.keys(next);

	if (existingKeys.length !== nextKeys.length) {
		return false;
	}

	for (const key of nextKeys) {
		const previous = existing[key];
		const incoming = next[key];

		if (!(previous && incoming)) {
			return false;
		}

		if (
			previous.actorType !== incoming.actorType ||
			previous.actorId !== incoming.actorId ||
			new Date(previous.lastSeenAt).getTime() !==
				new Date(incoming.lastSeenAt).getTime()
		) {
			return false;
		}
	}

	return true;
}

type RemoveSeenOptions = {
	conversationId: string;
	actorType: SeenActorType;
	actorId: string;
};

export type SeenStore = Store<SeenState> & {
	upsert(options: UpsertSeenOptions): void;
	remove(options: RemoveSeenOptions): void;
	hydrate(conversationId: string, entries: ConversationSeen[]): void;
	clear(conversationId: string): void;
};

type ActorIdentity = {
	actorType: SeenActorType;
	actorId: string;
};

function resolveActorIdentity(
	entry: Pick<
		ConversationSeen | RealtimeEvent<"conversationSeen">["payload"],
		"userId" | "visitorId" | "aiAgentId"
	>
): ActorIdentity | null {
	if (entry.userId) {
		return { actorType: "user", actorId: entry.userId } satisfies ActorIdentity;
	}

	if (entry.visitorId) {
		return {
			actorType: "visitor",
			actorId: entry.visitorId,
		} satisfies ActorIdentity;
	}

	if (entry.aiAgentId) {
		return {
			actorType: "ai_agent",
			actorId: entry.aiAgentId,
		} satisfies ActorIdentity;
	}

	return null;
}

export function createSeenStore(
	initialState: SeenState = INITIAL_STATE
): SeenStore {
	const store = createStore<SeenState>({
		conversations: { ...initialState.conversations },
	});

	return {
		...store,
		upsert({ conversationId, actorType, actorId, lastSeenAt }) {
			store.setState((state) => {
				const existingConversation = state.conversations[conversationId] ?? {};
				const key = makeKey(conversationId, actorType, actorId);
				const previous = existingConversation[key];

				if (
					previous &&
					new Date(previous.lastSeenAt).getTime() >=
						new Date(lastSeenAt).getTime()
				) {
					return state;
				}

				const nextConversation: ConversationSeenState = {
					...existingConversation,
					[key]: {
						actorType,
						actorId,
						lastSeenAt,
					},
				};

				return {
					conversations: {
						...state.conversations,
						[conversationId]: nextConversation,
					},
				} satisfies SeenState;
			});
		},
		remove({ conversationId, actorType, actorId }) {
			store.setState((state) => {
				const existingConversation = state.conversations[conversationId];
				if (!existingConversation) {
					return state;
				}

				const key = makeKey(conversationId, actorType, actorId);
				if (!(key in existingConversation)) {
					return state;
				}

				const { [key]: _, ...remaining } = existingConversation;

				// If no entries remain, remove the conversation entirely
				if (Object.keys(remaining).length === 0) {
					const { [conversationId]: __, ...remainingConversations } =
						state.conversations;
					return { conversations: remainingConversations } satisfies SeenState;
				}

				return {
					conversations: {
						...state.conversations,
						[conversationId]: remaining,
					},
				} satisfies SeenState;
			});
		},
		hydrate(conversationId, entries) {
			store.setState((state) => {
				if (entries.length === 0) {
					if (!(conversationId in state.conversations)) {
						return state;
					}
					const nextConversations = { ...state.conversations };
					delete nextConversations[conversationId];
					return { conversations: nextConversations } satisfies SeenState;
				}

				const existing = state.conversations[conversationId] ?? {};
				const nextEntries: ConversationSeenState = {
					...existing,
				};

				for (const entry of entries) {
					const identity = resolveActorIdentity(entry);

					if (!identity) {
						continue;
					}

					const key = makeKey(
						conversationId,
						identity.actorType,
						identity.actorId
					);
					const previous = existing[key];
					const incomingTimestamp = new Date(entry.lastSeenAt).getTime();
					const previousTimestamp = previous
						? new Date(previous.lastSeenAt).getTime()
						: null;

					if (
						previous &&
						previousTimestamp !== null &&
						!Number.isNaN(previousTimestamp) &&
						!Number.isNaN(incomingTimestamp) &&
						previousTimestamp > incomingTimestamp
					) {
						nextEntries[key] = previous;
						continue;
					}

					nextEntries[key] = {
						actorType: identity.actorType,
						actorId: identity.actorId,
						lastSeenAt: entry.lastSeenAt,
					} satisfies SeenEntry;
				}

				if (hasSameEntries(existing, nextEntries)) {
					return state;
				}

				if (Object.keys(nextEntries).length === 0) {
					const nextConversations = { ...state.conversations };
					delete nextConversations[conversationId];
					return { conversations: nextConversations } satisfies SeenState;
				}

				return {
					conversations: {
						...state.conversations,
						[conversationId]: nextEntries,
					},
				} satisfies SeenState;
			});
		},
		clear(conversationId) {
			store.setState((state) => {
				if (!(conversationId in state.conversations)) {
					return state;
				}

				const nextConversations = { ...state.conversations };
				delete nextConversations[conversationId];

				return { conversations: nextConversations } satisfies SeenState;
			});
		},
	} satisfies SeenStore;
}

export function hydrateConversationSeen(
	store: SeenStore,
	conversationId: string,
	entries: ConversationSeen[]
): void {
	store.hydrate(conversationId, entries);
}

export function upsertConversationSeen(
	store: SeenStore,
	options: UpsertSeenOptions
): void {
	store.upsert(options);
}

export function applyConversationSeenEvent(
	store: SeenStore,
	event: RealtimeEvent<"conversationSeen">,
	options: {
		ignoreVisitorId?: string | null;
		ignoreUserId?: string | null;
		ignoreAiAgentId?: string | null;
	} = {}
): void {
	const { payload } = event;
	const identity = resolveActorIdentity(payload);

	if (!identity) {
		return;
	}

	if (
		(identity.actorType === "visitor" &&
			payload.visitorId &&
			options.ignoreVisitorId &&
			payload.visitorId === options.ignoreVisitorId) ||
		(identity.actorType === "user" &&
			payload.userId &&
			options.ignoreUserId &&
			payload.userId === options.ignoreUserId) ||
		(identity.actorType === "ai_agent" &&
			payload.aiAgentId &&
			options.ignoreAiAgentId &&
			payload.aiAgentId === options.ignoreAiAgentId)
	) {
		return;
	}

	const { lastSeenAt } = payload;

	// null lastSeenAt indicates unread - remove the seen entry
	if (lastSeenAt === null) {
		store.remove({
			conversationId: payload.conversationId,
			actorType: identity.actorType,
			actorId: identity.actorId,
		});
		return;
	}

	upsertConversationSeen(store, {
		conversationId: payload.conversationId,
		actorType: identity.actorType,
		actorId: identity.actorId,
		lastSeenAt,
	});
}
