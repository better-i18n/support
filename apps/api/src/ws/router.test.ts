import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConversationEventType } from "@cossistant/types/enums";
import type { RealtimeEvent } from "@cossistant/types/realtime-events";
import type { EventContext } from "./router";
import { routeEvent } from "./router";

const sendToWebsite = mock<NonNullable<EventContext["sendToWebsite"]>>();
const sendToVisitor = mock<NonNullable<EventContext["sendToVisitor"]>>();
const sendToConnection = mock<NonNullable<EventContext["sendToConnection"]>>();

describe("routeEvent", () => {
	beforeEach(() => {
		sendToWebsite.mockReset();
		sendToVisitor.mockReset();
		sendToConnection.mockReset();
	});

	it("routes presence updates to website connections", async () => {
		const event: RealtimeEvent<"userPresenceUpdate"> = {
			type: "userPresenceUpdate",
			payload: {
				websiteId: "website-789",
				organizationId: "org-1",
				userId: "user-123",
				visitorId: null,
				status: "online",
				lastSeen: new Date().toISOString(),
			},
		};

		await routeEvent(event, {
			connectionId: "conn-123",
			websiteId: "website-789",
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToWebsite.mock.calls[0]).toEqual([
			"website-789",
			event,
			{ exclude: "conn-123" },
		]);
		expect(sendToVisitor).not.toHaveBeenCalled();
	});

	it("routes visitor events to dashboards", async () => {
		const event: RealtimeEvent<"visitorConnected"> = {
			type: "visitorConnected",
			payload: {
				websiteId: "website-abc",
				organizationId: "org-1",
				visitorId: "visitor-123",
				userId: null,
				connectionId: "conn-456",
			},
		};

		await routeEvent(event, {
			connectionId: "conn-456",
			websiteId: "website-abc",
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToWebsite.mock.calls[0]).toEqual([
			"website-abc",
			event,
			undefined,
		]);
	});
});

describe("messageCreated handler", () => {
	beforeEach(() => {
		sendToWebsite.mockReset();
		sendToVisitor.mockReset();
		sendToConnection.mockReset();
	});

	it("forwards messages to dashboards and the matching visitor", async () => {
		const event: RealtimeEvent<"messageCreated"> = {
			type: "messageCreated",
			payload: {
				websiteId: "site-1",
				organizationId: "org-1",
				userId: "user-1",
				visitorId: "visitor-1",
				conversationId: "conv-1",
				message: {
					id: "msg-1",
					bodyMd: "hello",
					type: "text",
					userId: "user-1",
					aiAgentId: null,
					visitorId: "visitor-1",
					organizationId: "org-1",
					websiteId: "site-1",
					conversationId: "conv-1",
					parentMessageId: null,
					modelUsed: null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					deletedAt: null,
					visibility: "public",
				},
			},
		};

		await routeEvent(event, {
			connectionId: "conn-1",
			websiteId: "site-1",
			visitorId: "visitor-1",
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToWebsite.mock.calls[0]).toEqual(["site-1", event]);
		expect(sendToVisitor).toHaveBeenCalledTimes(1);
		expect(sendToVisitor.mock.calls[0]).toEqual(["visitor-1", event]);
	});

	it("falls back to context visitor when message has no visitorId", async () => {
		const event: RealtimeEvent<"messageCreated"> = {
			type: "messageCreated",
			payload: {
				websiteId: "site-ctx",
				organizationId: "org-ctx",
				userId: "user-2",
				visitorId: "visitor-from-context",
				conversationId: "conv-ctx",
				message: {
					id: "msg-ctx-1",
					bodyMd: "from agent",
					type: "text",
					userId: "user-2",
					aiAgentId: null,
					visitorId: null,
					organizationId: "org-ctx",
					websiteId: "site-ctx",
					conversationId: "conv-ctx",
					parentMessageId: null,
					modelUsed: null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					deletedAt: null,
					visibility: "public",
				},
			},
		};

		await routeEvent(event, {
			connectionId: "conn-ctx",
			websiteId: "site-ctx",
			visitorId: "visitor-from-context",
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToVisitor).toHaveBeenCalledTimes(1);
		expect(sendToVisitor.mock.calls[0]).toEqual([
			"visitor-from-context",
			event,
		]);
	});
});

describe("conversationSeen handler", () => {
	beforeEach(() => {
		sendToWebsite.mockReset();
		sendToVisitor.mockReset();
		sendToConnection.mockReset();
	});

	it("broadcasts to dashboards and conversation visitor", async () => {
		const event: RealtimeEvent<"conversationSeen"> = {
			type: "conversationSeen",
			payload: {
				websiteId: "site-seen",
				organizationId: "org-seen",
				conversationId: "conv-seen-1",
				userId: "user-actor",
				visitorId: null,
				aiAgentId: null,
				lastSeenAt: new Date().toISOString(),
			},
		};

		await routeEvent(event, {
			connectionId: "conn-seen",
			websiteId: "site-seen",
			visitorId: "visitor-xyz",
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToWebsite.mock.calls[0]).toEqual(["site-seen", event]);
		expect(sendToVisitor).toHaveBeenCalledTimes(1);
		expect(sendToVisitor.mock.calls[0]).toEqual(["visitor-xyz", event]);
	});

	it("emits to actor visitor when visitor sees conversation", async () => {
		const visitorId = "visitor-actor";
		const event: RealtimeEvent<"conversationSeen"> = {
			type: "conversationSeen",
			payload: {
				websiteId: "site-seen",
				organizationId: "org-seen",
				conversationId: "conv-seen-2",
				userId: null,
				visitorId,
				aiAgentId: null,
				lastSeenAt: new Date().toISOString(),
			},
		};

		await routeEvent(event, {
			connectionId: "conn-seen",
			websiteId: "site-seen",
			visitorId,
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToVisitor).toHaveBeenCalledTimes(1);
		expect(sendToVisitor.mock.calls[0]).toEqual([visitorId, event]);
	});
});

describe("conversationTyping handler", () => {
	beforeEach(() => {
		sendToWebsite.mockReset();
		sendToVisitor.mockReset();
		sendToConnection.mockReset();
	});

	it("broadcasts typing state to dashboards and visitors", async () => {
		const event: RealtimeEvent<"conversationTyping"> = {
			type: "conversationTyping",
			payload: {
				websiteId: "site-typing",
				organizationId: "org-typing",
				conversationId: "conv-typing",
				userId: "user-123",
				visitorId: null,
				aiAgentId: null,
				isTyping: true,
				visitorPreview: null,
			},
		};

		await routeEvent(event, {
			connectionId: "conn-typing",
			websiteId: "site-typing",
			visitorId: "visitor-owner",
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToWebsite.mock.calls[0]).toEqual(["site-typing", event]);
		expect(sendToVisitor).toHaveBeenCalledTimes(1);
		expect(sendToVisitor.mock.calls[0]).toEqual(["visitor-owner", event]);
	});
});

describe("conversationEventCreated handler", () => {
	beforeEach(() => {
		sendToWebsite.mockReset();
		sendToVisitor.mockReset();
		sendToConnection.mockReset();
	});

	it("broadcasts timeline events to dashboards and visitor", async () => {
		const event: RealtimeEvent<"conversationEventCreated"> = {
			type: "conversationEventCreated",
			payload: {
				websiteId: "site-event",
				organizationId: "org-event",
				conversationId: "conv-event",
				userId: null,
				visitorId: null,
				aiAgentId: null,
				event: {
					id: "evt-1",
					conversationId: "conv-event",
					organizationId: "org-event",
					type: ConversationEventType.STATUS_CHANGED,
					actorUserId: "user-1",
					actorAiAgentId: null,
					targetUserId: null,
					targetAiAgentId: null,
					message: null,
					metadata: null,
					createdAt: "2024-01-01T00:00:00.000Z",
					updatedAt: "2024-01-01T00:00:00.000Z",
					deletedAt: null,
				},
			},
		};

		await routeEvent(event, {
			connectionId: "conn-event",
			websiteId: "site-event",
			visitorId: "visitor-event",
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToWebsite.mock.calls[0]).toEqual(["site-event", event]);
		expect(sendToVisitor).toHaveBeenCalledTimes(1);
		expect(sendToVisitor.mock.calls[0]).toEqual(["visitor-event", event]);
	});
});

describe("conversationCreated handler", () => {
	beforeEach(() => {
		sendToWebsite.mockReset();
		sendToVisitor.mockReset();
		sendToConnection.mockReset();
	});

	it("broadcasts new conversations to dashboards and visitor", async () => {
		const event: RealtimeEvent<"conversationCreated"> = {
			type: "conversationCreated",
			payload: {
				websiteId: "site-created",
				organizationId: "org-created",
				conversationId: "conv-created",
				userId: null,
				visitorId: "visitor-created",
				conversation: {
					id: "conv-created",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					visitorId: "visitor-created",
					websiteId: "site-created",
					status: "open",
					lastMessage: undefined,
				},
				header: {
					id: "conv-created",
					status: "open",
					priority: "normal",
					organizationId: "org-created",
					visitorId: "visitor-created",
					visitor: {
						id: "visitor-created",
						lastSeenAt: null,
						blockedAt: null,
						blockedByUserId: null,
						isBlocked: false,
						contact: null,
					},
					websiteId: "site-created",
					channel: "widget",
					title: null,
					resolutionTime: null,
					startedAt: new Date().toISOString(),
					firstResponseAt: null,
					resolvedAt: null,
					resolvedByUserId: null,
					resolvedByAiAgentId: null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					deletedAt: null,
					lastMessageAt: null,
					lastSeenAt: null,
					lastMessagePreview: null,
					viewIds: [],
					seenData: [],
				},
			},
		};

		await routeEvent(event, {
			connectionId: "conn-created",
			websiteId: "site-created",
			sendToWebsite,
			sendToVisitor,
			sendToConnection,
		});

		expect(sendToWebsite).toHaveBeenCalledTimes(1);
		expect(sendToWebsite.mock.calls[0]).toEqual(["site-created", event]);
		expect(sendToVisitor).toHaveBeenCalledTimes(1);
		expect(sendToVisitor.mock.calls[0]).toEqual(["visitor-created", event]);
	});
});
