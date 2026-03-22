import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { PipelineToolContext } from "./contracts";

const buildConversationTranscriptMock = mock((async () => [
	{
		messageId: "msg-1",
		content: "How do I permanently delete my account?",
		senderType: "visitor",
		senderId: "visitor-1",
		senderName: null,
		timestamp: "2026-03-16T09:00:00.000Z",
		visibility: "public",
	},
]) as (...args: unknown[]) => Promise<unknown[]>);
const requestKnowledgeClarificationMock = mock((async () => ({
	requestId: "req_1",
	created: true,
	resolution: "created" as const,
	status: "awaiting_answer" as const,
})) as (...args: unknown[]) => Promise<unknown>);

mock.module("@api/ai-pipeline/primary-pipeline/steps/intake/history", () => ({
	buildConversationTranscript: buildConversationTranscriptMock,
}));

mock.module("../actions/request-knowledge-clarification", () => ({
	requestKnowledgeClarification: requestKnowledgeClarificationMock,
}));

const modulePromise = import("./knowledge-clarification");

function createContext(): PipelineToolContext {
	return {
		db: {} as never,
		conversation: {
			id: "conv-1",
			organizationId: "org-1",
			websiteId: "site-1",
			visitorId: "visitor-1",
		} as never,
		conversationId: "conv-1",
		organizationId: "org-1",
		websiteId: "site-1",
		visitorId: "visitor-1",
		aiAgentId: "ai-1",
		aiAgentName: "Agent",
		visitorName: "Visitor",
		workflowRunId: "wf-1",
		triggerMessageId: "msg-1",
		triggerMessageText: "How do I permanently delete my account?",
		triggerMessageCreatedAt: "2026-03-16T09:00:00.000Z",
		allowPublicMessages: true,
		pipelineKind: "primary",
		mode: "respond_to_visitor",
		isEscalated: false,
		canCategorize: false,
		canRequestKnowledgeClarification: true,
		availableViews: [],
		runtimeState: {
			finalAction: null,
			publicMessagesSent: 0,
			toolCallCounts: {},
			mutationToolCallCounts: {},
			successfulToolCallCounts: {},
			failedToolCallCounts: {},
			chargeableToolCallCounts: {},
			toolExecutions: [
				{
					toolName: "searchKnowledgeBase",
					state: "result",
					input: {
						query: "account deletion",
					},
					output: {
						success: true,
						data: {
							articles: [],
							query: "account deletion",
							questionContext: "How do I permanently delete my account?",
							totalFound: 0,
							maxSimilarity: null,
							retrievalQuality: "none",
							clarificationSignal: "immediate",
						},
					},
				},
			],
			immediateKnowledgeGapClarificationHandled: false,
			publicSendSequence: 0,
			privateSendSequence: 0,
			sentPublicMessageIds: new Set<string>(),
			lastToolError: null,
		},
	};
}

describe("createRequestKnowledgeClarificationTool", () => {
	beforeEach(() => {
		buildConversationTranscriptMock.mockReset();
		requestKnowledgeClarificationMock.mockReset();
		buildConversationTranscriptMock.mockResolvedValue([
			{
				messageId: "msg-1",
				content: "How do I permanently delete my account?",
				senderType: "visitor",
				senderId: "visitor-1",
				senderName: null,
				timestamp: "2026-03-16T09:00:00.000Z",
				visibility: "public",
			},
		]);
		requestKnowledgeClarificationMock.mockResolvedValue({
			requestId: "req_1",
			created: true,
			resolution: "created",
			status: "awaiting_answer",
		});
	});

	it("reuses the shared tool-driven clarification context builder", async () => {
		const { createRequestKnowledgeClarificationTool } = await modulePromise;
		const tool = createRequestKnowledgeClarificationTool(createContext());

		const result = await tool.execute?.(
			{
				topicSummary:
					"Missing exact answer for: How do I permanently delete my account?",
			},
			{} as never
		);

		expect(result).toMatchObject({
			success: true,
			changed: true,
			data: {
				requestId: "req_1",
				created: true,
				changed: true,
			},
		});
		expect(requestKnowledgeClarificationMock).toHaveBeenCalledWith(
			expect.objectContaining({
				topicSummary:
					"Missing exact answer for: How do I permanently delete my account?",
				contextSnapshot: expect.objectContaining({
					sourceTrigger: expect.objectContaining({
						text: "How do I permanently delete my account?",
					}),
					kbSearchEvidence: [
						expect.objectContaining({
							query: "account deletion",
							questionContext: "How do I permanently delete my account?",
							retrievalQuality: "none",
							clarificationSignal: "immediate",
						}),
					],
				}),
			})
		);
		expect(buildConversationTranscriptMock).toHaveBeenCalledTimes(1);
	});
});
