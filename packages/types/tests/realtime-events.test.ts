import { describe, expect, it } from "bun:test";
import { validateRealtimeEvent } from "../src/realtime-events";

describe("realtime-events", () => {
	it("accepts retry-required active clarification updates", () => {
		const payload = validateRealtimeEvent("conversationUpdated", {
			websiteId: "site_1",
			organizationId: "org_1",
			visitorId: "visitor_1",
			userId: null,
			conversationId: "conv_1",
			updates: {
				activeClarification: {
					requestId: "01JKCM0FJ8T8Q6W0M3Q2A1B9CD",
					status: "retry_required",
					topicSummary: "Clarify account deletion.",
					question: null,
					stepIndex: 1,
					maxSteps: 3,
					updatedAt: "2026-03-17T10:54:40.208Z",
				},
			},
			aiAgentId: null,
		});

		expect(payload.updates.activeClarification).toMatchObject({
			status: "retry_required",
			question: null,
		});
	});
});
