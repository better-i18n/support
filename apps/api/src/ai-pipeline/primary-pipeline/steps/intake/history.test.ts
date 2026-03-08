import { beforeEach, describe, expect, it, mock } from "bun:test";
import { isConversationMessage } from "../../contracts";

const getConversationTimelineItemsMock = mock(async () => ({
	items: [],
	hasNextPage: false,
	nextCursor: undefined,
}));

mock.module("@api/db/queries/conversation", () => ({
	getConversationTimelineItems: getConversationTimelineItemsMock,
}));

const modulePromise = import("./history");

function createMessage(id: number) {
	return {
		id: `msg-${id}`,
		conversationId: "conv-1",
		organizationId: "org-1",
		type: "message",
		text: `Message ${id}`,
		parts: [{ type: "text", text: `Message ${id}` }],
		userId: null,
		visitorId: "visitor-1",
		aiAgentId: null,
		visibility: "public",
		createdAt: `2026-03-08T10:${String(id).padStart(2, "0")}:00.000Z`,
		deletedAt: null,
	};
}

function createTool(params: {
	id: string;
	toolName: string;
	createdAt: string;
	query?: string;
	totalFound?: number;
}) {
	return {
		id: params.id,
		conversationId: "conv-1",
		organizationId: "org-1",
		type: "tool",
		text:
			params.toolName === "searchKnowledgeBase"
				? `Found ${params.totalFound ?? 0} relevant sources`
				: `Completed ${params.toolName}`,
		parts: [
			{
				type: `tool-${params.toolName}`,
				toolCallId: `${params.id}-call`,
				toolName: params.toolName,
				state: "result",
				input: params.query ? { query: params.query } : {},
				output:
					params.toolName === "searchKnowledgeBase"
						? {
								data: {
									totalFound: params.totalFound ?? 0,
									articles: [],
								},
							}
						: {},
			},
		],
		userId: null,
		visitorId: "visitor-1",
		aiAgentId: "ai-1",
		visibility: "private",
		createdAt: params.createdAt,
		deletedAt: null,
	};
}

describe("buildConversationTranscript", () => {
	beforeEach(() => {
		getConversationTimelineItemsMock.mockReset();
	});

	it("collects 50 real messages and keeps relevant interleaved tool actions", async () => {
		const firstPageMessages = Array.from({ length: 30 }, (_, index) =>
			createMessage(index + 26)
		);
		firstPageMessages.splice(
			24,
			0,
			createTool({
				id: "tool-search-1",
				toolName: "searchKnowledgeBase",
				query: "refund policy",
				totalFound: 3,
				createdAt: "2026-03-08T10:53:30.000Z",
			}) as never
		);
		firstPageMessages.push(
			createTool({
				id: "tool-credits-1",
				toolName: "aiCreditUsage",
				createdAt: "2026-03-08T10:55:30.000Z",
			}) as never
		);

		const secondPageMessages = Array.from({ length: 25 }, (_, index) =>
			createMessage(index + 1)
		);

		getConversationTimelineItemsMock
			.mockResolvedValueOnce({
				items: firstPageMessages,
				hasNextPage: true,
				nextCursor: "cursor-1",
			})
			.mockResolvedValueOnce({
				items: secondPageMessages,
				hasNextPage: false,
				nextCursor: undefined,
			});

		const { buildConversationTranscript } = await modulePromise;
		const transcript = await buildConversationTranscript({} as never, {
			conversationId: "conv-1",
			organizationId: "org-1",
			websiteId: "site-1",
			maxCreatedAt: "2026-03-08T10:55:59.000Z",
			maxId: "msg-55",
		});

		const messageEntries = transcript.filter(isConversationMessage);
		const toolEntries = transcript.filter((entry) => "kind" in entry);

		expect(getConversationTimelineItemsMock).toHaveBeenCalledTimes(2);
		expect(messageEntries).toHaveLength(50);
		expect(messageEntries[0]?.messageId).toBe("msg-6");
		expect(messageEntries.at(-1)?.messageId).toBe("msg-55");
		expect(toolEntries).toHaveLength(1);
		expect(toolEntries[0]?.content).toContain(
			"[PRIVATE][TOOL:searchKnowledgeBase]"
		);
		expect(toolEntries[0]?.content).toContain('query="refund policy"');
		expect(toolEntries[0]?.content).toContain("results=3");
	});
});
