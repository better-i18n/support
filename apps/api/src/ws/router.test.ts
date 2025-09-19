import { beforeEach, describe, expect, it, mock } from "bun:test";
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
		const event: RealtimeEvent<"USER_PRESENCE_UPDATE"> = {
			type: "USER_PRESENCE_UPDATE",
			data: {
				userId: "user-123",
				status: "online",
				lastSeen: Date.now(),
			},
			timestamp: Date.now(),
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
		const event: RealtimeEvent<"VISITOR_CONNECTED"> = {
			type: "VISITOR_CONNECTED",
			data: {
				visitorId: "visitor-123",
				connectionId: "conn-456",
				timestamp: Date.now(),
			},
			timestamp: Date.now(),
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

describe("MESSAGE_CREATED handler", () => {
	beforeEach(() => {
		sendToWebsite.mockReset();
		sendToVisitor.mockReset();
		sendToConnection.mockReset();
	});

	it("forwards messages to dashboards and the matching visitor", async () => {
		const event: RealtimeEvent<"MESSAGE_CREATED"> = {
			type: "MESSAGE_CREATED",
			data: {
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
				conversationId: "conv-1",
				websiteId: "site-1",
				organizationId: "org-1",
			},
			timestamp: Date.now(),
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
		const event: RealtimeEvent<"MESSAGE_CREATED"> = {
			type: "MESSAGE_CREATED",
			data: {
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
				conversationId: "conv-ctx",
				websiteId: "site-ctx",
				organizationId: "org-ctx",
			},
			timestamp: Date.now(),
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
