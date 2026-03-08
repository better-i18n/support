import { describe, expect, it } from "bun:test";
import { buildGenerationMessages } from "./format-history";

describe("buildGenerationMessages", () => {
	it("maps transcript entries to AI SDK-native roles and lightweight tags", () => {
		const messages = buildGenerationMessages([
			{
				messageId: "msg-1",
				content: "I need help",
				senderType: "visitor",
				senderId: "visitor-1",
				senderName: null,
				timestamp: "2026-03-08T10:00:00.000Z",
				visibility: "public",
			},
			{
				messageId: "msg-2",
				content: "Can you check their billing issue?",
				senderType: "human_agent",
				senderId: "user-1",
				senderName: "Teammate",
				timestamp: "2026-03-08T10:01:00.000Z",
				visibility: "private",
			},
			{
				kind: "tool",
				itemId: "tool-1",
				toolName: "searchKnowledgeBase",
				content:
					'[PRIVATE][TOOL:searchKnowledgeBase] Found 2 relevant sources query="billing"',
				timestamp: "2026-03-08T10:01:30.000Z",
				visibility: "private",
			},
			{
				messageId: "msg-3",
				content: "I checked billing for you.",
				senderType: "ai_agent",
				senderId: "ai-1",
				senderName: null,
				timestamp: "2026-03-08T10:02:00.000Z",
				visibility: "public",
			},
			{
				messageId: "msg-4",
				content: "Internal handoff note",
				senderType: "ai_agent",
				senderId: "ai-1",
				senderName: null,
				timestamp: "2026-03-08T10:03:00.000Z",
				visibility: "private",
			},
		]);

		expect(messages).toEqual([
			{ role: "user", content: "[VISITOR] I need help" },
			{
				role: "user",
				content: "[PRIVATE][TEAM] Can you check their billing issue?",
			},
			{
				role: "assistant",
				content:
					'[PRIVATE][TOOL:searchKnowledgeBase] Found 2 relevant sources query="billing"',
			},
			{ role: "assistant", content: "I checked billing for you." },
			{ role: "assistant", content: "[PRIVATE] Internal handoff note" },
		]);
	});
});
