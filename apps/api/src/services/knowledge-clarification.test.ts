import { beforeEach, describe, expect, it, mock } from "bun:test";
import { zodSchema } from "ai";

const getAiAgentForWebsiteMock = mock(async () => null);
const getConversationByIdMock = mock(async () => null);
const getConversationTimelineItemsMock = mock(async () => ({ items: [] }));
const createKnowledgeClarificationRequestMock = mock(async () => null);
const getActiveKnowledgeClarificationForConversationMock = mock(
	async () => null
);
const getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock =
	mock(async () => null);
const getLatestKnowledgeClarificationForConversationByTopicFingerprintMock =
	mock(async () => null);
const listKnowledgeClarificationTurnsMock = mock(async () => []);
const updateKnowledgeClarificationRequestMock = mock(async () => null);
const createKnowledgeClarificationTurnMock = mock(async () => null);
const getKnowledgeClarificationRequestByIdMock = mock(async () => null);
const listKnowledgeClarificationProposalsMock = mock(async () => []);
const getKnowledgeByIdMock = mock(async () => null);
const createKnowledgeMock = mock(async () => null);
const getKnowledgeCountByTypeMock = mock(async () => 0);
const getTotalKnowledgeSizeBytesMock = mock(async () => 0);
const updateKnowledgeMock = mock(async () => null);
const createStructuredOutputModelMock = mock((modelId: string) => ({
	modelId,
}));
const createModelMock = mock((modelId: string) => modelId);
const generateTextMock = mock((async () => ({
	output: null,
	usage: undefined,
})) as (...args: unknown[]) => Promise<unknown>);
const outputObjectMock = mock((value: unknown) => value);
class RetryableMockError extends Error {
	static isInstance(error: unknown): error is RetryableMockError {
		return error instanceof RetryableMockError;
	}
}
class APICallErrorMock extends RetryableMockError {}
class EmptyResponseBodyErrorMock extends RetryableMockError {}
class NoContentGeneratedErrorMock extends RetryableMockError {}
class NoObjectGeneratedErrorMock extends RetryableMockError {}
class NoOutputGeneratedErrorMock extends RetryableMockError {}
class NoSuchModelErrorMock extends RetryableMockError {}
const resolveClarificationModelForExecutionMock = mock((modelId: string) => ({
	modelIdOriginal: modelId,
	modelIdResolved: "moonshotai/kimi-k2.5",
	modelMigrationApplied: modelId !== "moonshotai/kimi-k2.5",
}));
const realtimeEmitMock = mock(async () => {});
const trackGenerationUsageMock = mock(async () => ({
	usageTokens: {
		inputTokens: 120,
		outputTokens: 40,
		totalTokens: 160,
		source: "provider" as const,
	},
	creditUsage: {
		totalCredits: 1,
		mode: "normal" as const,
		ingestStatus: "ingested" as const,
	},
}));
const createTimelineItemMock = mock(async () => null);
const ulidMock = mock(() => "usage_evt_1");

mock.module("@api/db/queries/ai-agent", () => ({
	getAiAgentForWebsite: getAiAgentForWebsiteMock,
}));

mock.module("@api/db/queries/conversation", () => ({
	getConversationById: getConversationByIdMock,
	getConversationTimelineItems: getConversationTimelineItemsMock,
}));

mock.module("@api/db/queries/knowledge-clarification", () => ({
	ACTIVE_CONVERSATION_STATUSES: [
		"analyzing",
		"awaiting_answer",
		"retry_required",
		"draft_ready",
	],
	PROPOSAL_STATUSES: [
		"analyzing",
		"awaiting_answer",
		"retry_required",
		"deferred",
		"draft_ready",
	],
	REUSABLE_CONVERSATION_TOPIC_FINGERPRINT_STATUSES: [
		"analyzing",
		"awaiting_answer",
		"retry_required",
		"deferred",
		"draft_ready",
	],
	createKnowledgeClarificationRequest: createKnowledgeClarificationRequestMock,
	createKnowledgeClarificationTurn: createKnowledgeClarificationTurnMock,
	getActiveKnowledgeClarificationForConversation:
		getActiveKnowledgeClarificationForConversationMock,
	getLatestKnowledgeClarificationForConversationBySourceTriggerMessageId:
		getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock,
	getLatestKnowledgeClarificationForConversationByTopicFingerprint:
		getLatestKnowledgeClarificationForConversationByTopicFingerprintMock,
	getKnowledgeClarificationRequestById:
		getKnowledgeClarificationRequestByIdMock,
	listKnowledgeClarificationProposals: listKnowledgeClarificationProposalsMock,
	listKnowledgeClarificationTurns: listKnowledgeClarificationTurnsMock,
	updateKnowledgeClarificationRequest: updateKnowledgeClarificationRequestMock,
}));

mock.module("@api/db/queries/knowledge", () => ({
	createKnowledge: createKnowledgeMock,
	getKnowledgeById: getKnowledgeByIdMock,
	getKnowledgeCountByType: getKnowledgeCountByTypeMock,
	getTotalKnowledgeSizeBytes: getTotalKnowledgeSizeBytesMock,
	updateKnowledge: updateKnowledgeMock,
}));

mock.module("@api/lib/ai", () => ({
	APICallError: APICallErrorMock,
	createModel: createModelMock,
	createStructuredOutputModel: createStructuredOutputModelMock,
	EmptyResponseBodyError: EmptyResponseBodyErrorMock,
	generateText: generateTextMock,
	NoContentGeneratedError: NoContentGeneratedErrorMock,
	NoObjectGeneratedError: NoObjectGeneratedErrorMock,
	NoOutputGeneratedError: NoOutputGeneratedErrorMock,
	NoSuchModelError: NoSuchModelErrorMock,
	Output: {
		object: outputObjectMock,
	},
}));

mock.module("@api/lib/ai-credits/config", () => ({
	resolveClarificationModelForExecution:
		resolveClarificationModelForExecutionMock,
	resolveModelForExecution: resolveClarificationModelForExecutionMock,
}));

mock.module("@api/realtime/emitter", () => ({
	realtime: {
		emit: realtimeEmitMock,
	},
}));

mock.module("@api/ai-pipeline/shared/usage", () => ({
	trackGenerationUsage: trackGenerationUsageMock,
}));

mock.module("@api/utils/timeline-item", () => ({
	createTimelineItem: createTimelineItemMock,
}));

mock.module("ulid", () => ({
	ulid: ulidMock,
}));

const modulePromise = import("./knowledge-clarification");

function createContextSnapshot(overrides: Record<string, unknown> = {}) {
	return {
		sourceTrigger: {
			messageId: "msg_1",
			text: "When does the billing change take effect?",
			senderType: "visitor",
			visibility: "public",
			createdAt: "2026-03-13T09:55:00.000Z",
		},
		relevantTranscript: [
			{
				messageId: "msg_1",
				content: "When does the billing change take effect?",
				senderType: "visitor",
				visibility: "public",
				timestamp: "2026-03-13T09:55:00.000Z",
			},
			{
				messageId: "msg_2",
				content: "I think it should wait until the next invoice.",
				senderType: "human_agent",
				visibility: "public",
				timestamp: "2026-03-13T09:56:00.000Z",
			},
		],
		kbSearchEvidence: [],
		linkedFaq: null,
		...overrides,
	} as never;
}

function createAiAgent(overrides: Record<string, unknown> = {}) {
	return {
		id: "agent_1",
		organizationId: "org_1",
		websiteId: "site_1",
		name: "Support Agent",
		model: "moonshotai/kimi-k2-0905",
		basePrompt: "You are helpful.",
		temperature: 0.4,
		maxOutputTokens: 1200,
		behaviorSettings: {},
		...overrides,
	} as never;
}

function createConversation(overrides: Record<string, unknown> = {}) {
	return {
		id: "conv_1",
		organizationId: "org_1",
		websiteId: "site_1",
		visitorId: "visitor_1",
		...overrides,
	} as never;
}

function createRequest(overrides: Record<string, unknown> = {}) {
	return {
		id: "clar_req_1",
		organizationId: "org_1",
		websiteId: "site_1",
		aiAgentId: "agent_1",
		conversationId: "conv_1",
		source: "conversation",
		status: "awaiting_answer",
		topicSummary: "Clarify billing timing",
		sourceTriggerMessageId: "msg_1",
		topicFingerprint: "topic_fp_1",
		stepIndex: 1,
		maxSteps: 3,
		contextSnapshot: createContextSnapshot(),
		targetKnowledgeId: null,
		draftFaqPayload: null,
		currentQuestionInputMode: "suggested_answers",
		currentQuestionScope: "narrow_detail",
		lastError: null,
		createdAt: "2026-03-13T10:00:00.000Z",
		updatedAt: "2026-03-13T10:00:00.000Z",
		...overrides,
	} as never;
}

function createTurn(overrides: Record<string, unknown> = {}) {
	return {
		id: "turn_1",
		requestId: "clar_req_1",
		role: "ai_question",
		question: "When does the billing change take effect?",
		suggestedAnswers: [
			"Immediately",
			"At the next billing cycle",
			"It depends on the plan",
		],
		selectedAnswer: null,
		freeAnswer: null,
		createdAt: "2026-03-13T10:00:00.000Z",
		updatedAt: "2026-03-13T10:00:00.000Z",
		...overrides,
	} as never;
}

function createQuestionOutput(overrides: Record<string, unknown> = {}) {
	return {
		kind: "question",
		continueClarifying: true,
		inputMode: "suggested_answers",
		questionScope: "narrow_detail",
		topicSummary: "Clarify billing timing",
		missingFact:
			"Whether the billing change always waits for the next billing cycle",
		whyItMatters: "That determines how the FAQ should describe timing.",
		groundingSource: "latest_exchange",
		groundingSnippet: "Does the billing change immediately?",
		question: "Should the change wait for the next billing cycle?",
		suggestedAnswers: [
			"Yes, always",
			"No, it is immediate",
			"It depends on the plan",
		],
		draftFaqPayload: null,
		...overrides,
	} as const;
}

function createDraftOutput(overrides: Record<string, unknown> = {}) {
	return {
		kind: "draft_ready",
		continueClarifying: false,
		inputMode: null,
		questionScope: null,
		groundingSource: null,
		groundingSnippet: null,
		question: null,
		suggestedAnswers: null,
		topicSummary: "Clarify billing timing",
		missingFact: "Exact billing timing",
		whyItMatters: "The FAQ needs a single grounded timing rule.",
		draftFaqPayload: {
			title: "Billing timing",
			question: "When does a billing change take effect?",
			answer: "Billing changes apply at the next billing cycle.",
			categories: ["Billing"],
			relatedQuestions: [],
		},
		...overrides,
	} as const;
}

function createFaqKnowledge(overrides: Record<string, unknown> = {}) {
	return {
		id: "knowledge_1",
		organizationId: "org_1",
		websiteId: "site_1",
		aiAgentId: "agent_1",
		type: "faq",
		sourceTitle: "When do billing changes apply?",
		payload: {
			question: "When do billing changes apply?",
			answer: "Billing changes apply at the next billing cycle.",
			categories: ["Billing"],
			relatedQuestions: ["Can I make a billing change immediately?"],
		},
		...overrides,
	} as never;
}

describe("knowledge clarification usage tracking", () => {
	beforeEach(() => {
		getAiAgentForWebsiteMock.mockReset();
		getConversationByIdMock.mockReset();
		getConversationTimelineItemsMock.mockReset();
		createKnowledgeClarificationRequestMock.mockReset();
		getActiveKnowledgeClarificationForConversationMock.mockReset();
		getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock.mockReset();
		getLatestKnowledgeClarificationForConversationByTopicFingerprintMock.mockReset();
		listKnowledgeClarificationTurnsMock.mockReset();
		updateKnowledgeClarificationRequestMock.mockReset();
		createKnowledgeClarificationTurnMock.mockReset();
		getKnowledgeClarificationRequestByIdMock.mockReset();
		listKnowledgeClarificationProposalsMock.mockReset();
		getKnowledgeByIdMock.mockReset();
		createKnowledgeMock.mockReset();
		getKnowledgeCountByTypeMock.mockReset();
		getTotalKnowledgeSizeBytesMock.mockReset();
		updateKnowledgeMock.mockReset();
		createStructuredOutputModelMock.mockReset();
		generateTextMock.mockReset();
		outputObjectMock.mockReset();
		resolveClarificationModelForExecutionMock.mockReset();
		realtimeEmitMock.mockReset();
		trackGenerationUsageMock.mockReset();
		createTimelineItemMock.mockReset();
		ulidMock.mockReset();

		getConversationTimelineItemsMock.mockResolvedValue({ items: [] });
		getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock.mockResolvedValue(
			null
		);
		getLatestKnowledgeClarificationForConversationByTopicFingerprintMock.mockResolvedValue(
			null
		);
		createModelMock.mockImplementation((modelId: string) => modelId);
		createStructuredOutputModelMock.mockImplementation((modelId: string) => ({
			modelId,
		}));
		outputObjectMock.mockImplementation((value: unknown) => value);
		resolveClarificationModelForExecutionMock.mockImplementation(
			(modelId: string) => ({
				modelIdOriginal: modelId,
				modelIdResolved: "moonshotai/kimi-k2.5",
				modelMigrationApplied: modelId !== "moonshotai/kimi-k2.5",
			})
		);
		trackGenerationUsageMock.mockResolvedValue({
			usageTokens: {
				inputTokens: 120,
				outputTokens: 40,
				totalTokens: 160,
				source: "provider",
			},
			creditUsage: {
				totalCredits: 1,
				mode: "normal",
				ingestStatus: "ingested",
			},
		});
		ulidMock.mockImplementation(() => "usage_evt_1");
	});

	it("does not bill when an existing unanswered clarification step is reused", async () => {
		const { startConversationKnowledgeClarification } = await modulePromise;
		const request = createRequest();

		getActiveKnowledgeClarificationForConversationMock.mockResolvedValue(
			request
		);
		listKnowledgeClarificationTurnsMock.mockResolvedValue([createTurn()]);

		const result = await startConversationKnowledgeClarification({
			db: {} as never,
			organizationId: "org_1",
			websiteId: "site_1",
			aiAgent: createAiAgent(),
			conversation: createConversation(),
			topicSummary: "Clarify billing timing",
			actor: {
				aiAgentId: "agent_1",
			},
		});

		expect(result.created).toBe(false);
		expect(result.step).not.toBeNull();
		const step = result.step;
		if (!step) {
			throw new Error("Expected clarification step to be present");
		}
		expect(step.kind).toBe("question");
		expect(generateTextMock).not.toHaveBeenCalled();
		expect(trackGenerationUsageMock).not.toHaveBeenCalled();
	});

	it("suppresses automated duplicates when the same trigger already led to an applied clarification", async () => {
		const { startConversationKnowledgeClarification } = await modulePromise;

		getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock.mockResolvedValue(
			createRequest({
				status: "applied",
				currentQuestionInputMode: null,
				currentQuestionScope: null,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does billing change take effect?",
					answer: "It changes at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);
		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);

		const result = await startConversationKnowledgeClarification({
			db: {} as never,
			organizationId: "org_1",
			websiteId: "site_1",
			aiAgent: createAiAgent(),
			conversation: createConversation(),
			topicSummary: "Clarify billing timing",
			actor: {
				aiAgentId: "agent_1",
			},
			contextSnapshot: createContextSnapshot(),
			creationMode: "automation",
		});

		expect(result).toMatchObject({
			created: false,
			resolution: "suppressed_duplicate",
			step: null,
			request: {
				id: "clar_req_1",
				status: "applied",
			},
		});
		expect(createKnowledgeClarificationRequestMock).not.toHaveBeenCalled();
		expect(generateTextMock).not.toHaveBeenCalled();
	});

	it("reuses manual clarifications by topic fingerprint when no trigger message exists", async () => {
		const { startConversationKnowledgeClarification } = await modulePromise;
		const existingRequest = createRequest({
			sourceTriggerMessageId: null,
			topicFingerprint: "topic_fp_manual",
			contextSnapshot: createContextSnapshot({
				sourceTrigger: {
					messageId: null,
					text: "Clarify billing timing",
					senderType: null,
					visibility: null,
					createdAt: null,
				},
			}),
		});

		getLatestKnowledgeClarificationForConversationByTopicFingerprintMock.mockResolvedValue(
			existingRequest
		);
		listKnowledgeClarificationTurnsMock.mockResolvedValue([createTurn()]);

		const result = await startConversationKnowledgeClarification({
			db: {} as never,
			organizationId: "org_1",
			websiteId: "site_1",
			aiAgent: createAiAgent(),
			conversation: createConversation(),
			topicSummary: "Clarify billing timing",
			actor: {
				userId: "user_1",
			},
			contextSnapshot: createContextSnapshot({
				sourceTrigger: {
					messageId: null,
					text: "Clarify billing timing",
					senderType: null,
					visibility: null,
					createdAt: null,
				},
			}),
			creationMode: "manual",
		});

		expect(result.created).toBe(false);
		expect(result.resolution).toBe("reused");
		expect(result.step?.kind).toBe("question");
		expect(createKnowledgeClarificationRequestMock).not.toHaveBeenCalled();
	});

	it("recovers from a trigger-message unique violation by reusing the winning clarification", async () => {
		const { startConversationKnowledgeClarification } = await modulePromise;
		const winningRequest = createRequest();

		createKnowledgeClarificationRequestMock.mockRejectedValueOnce({
			code: "23505",
			constraint: "knowledge_clarification_request_conv_trigger_unique",
		});
		getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock.mockResolvedValue(
			winningRequest
		);
		listKnowledgeClarificationTurnsMock.mockResolvedValue([createTurn()]);

		const result = await startConversationKnowledgeClarification({
			db: {} as never,
			organizationId: "org_1",
			websiteId: "site_1",
			aiAgent: createAiAgent(),
			conversation: createConversation(),
			topicSummary: "Clarify billing timing",
			actor: {
				aiAgentId: "agent_1",
			},
			contextSnapshot: createContextSnapshot(),
			creationMode: "automation",
		});

		expect(result.created).toBe(false);
		expect(result.resolution).toBe("reused");
		expect(result.step?.kind).toBe("question");
		expect(createTimelineItemMock).not.toHaveBeenCalled();
	});

	it("keeps deferred unanswered questions visible in serialized requests", async () => {
		const { serializeKnowledgeClarificationRequest } = await modulePromise;
		const serialized = serializeKnowledgeClarificationRequest({
			request: createRequest({
				status: "deferred",
			}),
			turns: [createTurn()],
		});

		expect(serialized.currentQuestion).toBe(
			"When does the billing change take effect?"
		);
		expect(serialized.currentSuggestedAnswers).toEqual([
			"Immediately",
			"At the next billing cycle",
			"It depends on the plan",
		]);
		expect(serialized.currentQuestionInputMode).toBe("textarea_first");
		expect(serialized.currentQuestionScope).toBe("broad_discovery");
	});

	it("emits retry-required conversation clarifications as active retryable summaries", async () => {
		const { emitConversationClarificationUpdate } = await modulePromise;

		await emitConversationClarificationUpdate({
			db: {} as never,
			conversation: createConversation(),
			request: createRequest({
				status: "retry_required",
				currentQuestionInputMode: null,
				currentQuestionScope: null,
			}),
			aiAgentId: null,
			turns: [],
		});

		expect(realtimeEmitMock).toHaveBeenCalledWith(
			"conversationUpdated",
			expect.objectContaining({
				conversationId: "conv_1",
				updates: {
					activeClarification: {
						requestId: "clar_req_1",
						status: "retry_required",
						topicSummary: "Clarify billing timing",
						question: null,
						stepIndex: 1,
						maxSteps: 3,
						updatedAt: "2026-03-13T10:00:00.000Z",
					},
				},
			})
		);
	});

	it("tracks clarification-question usage when the model returns the next question", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
		});
		const nextQuestionTurn = createTurn({
			question: "How does billing timing work today?",
			suggestedAnswers: [
				"Users see the change immediately",
				"It waits until the next billing cycle",
				"It depends on the plan or change type",
			],
		});

		listKnowledgeClarificationTurnsMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([nextQuestionTurn]);
		generateTextMock.mockResolvedValue({
			output: createQuestionOutput({
				inputMode: "textarea_first",
				questionScope: "broad_discovery",
				missingFact: "How billing-change handling works today",
				whyItMatters: "That detail determines the final FAQ answer.",
				groundingSource: "topic_anchor",
				groundingSnippet: "Clarify billing timing",
				question: "How does billing timing work today?",
				suggestedAnswers: [
					"Users see the change immediately",
					"It waits until the next billing cycle",
					"It depends on the plan or change type",
				],
			}),
			usage: {
				inputTokens: 120,
				outputTokens: 40,
				totalTokens: 160,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "awaiting_answer",
				stepIndex: 1,
				topicSummary: "Clarify billing timing",
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		const usageCall = trackGenerationUsageMock.mock.calls[0] as unknown as
			| [Record<string, unknown>]
			| undefined;

		expect(step.kind).toBe("question");
		expect(step).toMatchObject({
			inputMode: "textarea_first",
			questionScope: "broad_discovery",
		});
		expect(trackGenerationUsageMock).toHaveBeenCalledTimes(1);
		expect(usageCall?.[0]).toMatchObject({
			conversationId: "conv_1",
			visitorId: "visitor_1",
			aiAgentId: "agent_1",
			usageEventId: "usage_evt_1",
			triggerMessageId: "clar_req_1",
			source: "knowledge_clarification",
			phase: "clarification_question",
			knowledgeClarificationRequestId: "clar_req_1",
			knowledgeClarificationStepIndex: 1,
		});
		expect(resolveClarificationModelForExecutionMock).toHaveBeenCalledWith(
			"moonshotai/kimi-k2-0905"
		);
		expect(createStructuredOutputModelMock).toHaveBeenCalledWith(
			"moonshotai/kimi-k2.5"
		);
	});

	it("uses a root object schema with required nullable branch fields", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);
		generateTextMock.mockResolvedValue({
			output: createDraftOutput(),
			usage: {
				inputTokens: 180,
				outputTokens: 60,
				totalTokens: 240,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 0,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		const schema = (
			outputObjectMock.mock.calls[0]?.[0] as { schema?: unknown } | undefined
		)?.schema;
		const jsonSchema = zodSchema(schema as never).jsonSchema as Record<
			string,
			any
		>;

		expect(jsonSchema.type).toBe("object");
		expect(jsonSchema.oneOf).toBeUndefined();
		expect(jsonSchema.anyOf).toBeUndefined();
		expect(jsonSchema.required).toEqual(
			expect.arrayContaining([
				"kind",
				"continueClarifying",
				"topicSummary",
				"missingFact",
				"whyItMatters",
				"inputMode",
				"questionScope",
				"groundingSource",
				"groundingSnippet",
				"question",
				"suggestedAnswers",
				"draftFaqPayload",
			])
		);

		const draftFaqPayloadProperty = jsonSchema.properties
			.draftFaqPayload as Record<string, any>;
		const draftFaqObject = draftFaqPayloadProperty.anyOf.find(
			(entry: Record<string, unknown>) => entry.type === "object"
		) as Record<string, any> | undefined;

		expect(draftFaqObject?.required).toEqual(
			expect.arrayContaining([
				"title",
				"question",
				"answer",
				"categories",
				"relatedQuestions",
			])
		);
		expect(draftFaqObject?.properties?.categories?.default).toBeUndefined();
		expect(
			draftFaqObject?.properties?.relatedQuestions?.default
		).toBeUndefined();
	});

	it("falls through to the next fallback model after a no-output attempt", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
		});
		const nextQuestionTurn = createTurn({
			question: "How does billing timing work today?",
			suggestedAnswers: [
				"Users see the change immediately",
				"It waits until the next billing cycle",
				"It depends on the plan or change type",
			],
		});

		listKnowledgeClarificationTurnsMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([nextQuestionTurn]);
		generateTextMock
			.mockRejectedValueOnce(
				new NoOutputGeneratedErrorMock("No output generated.")
			)
			.mockResolvedValueOnce({
				output: createQuestionOutput({
					inputMode: "textarea_first",
					questionScope: "broad_discovery",
					missingFact: "How billing-change handling works today",
					whyItMatters: "That detail determines the final FAQ answer.",
					groundingSource: "topic_anchor",
					groundingSnippet: "Clarify billing timing",
					question: "How does billing timing work today?",
					suggestedAnswers: [
						"Users see the change immediately",
						"It waits until the next billing cycle",
						"It depends on the plan or change type",
					],
				}),
				usage: {
					inputTokens: 120,
					outputTokens: 40,
					totalTokens: 160,
				},
			});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "awaiting_answer",
				stepIndex: 1,
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		expect(step.kind).toBe("question");
		expect(
			createStructuredOutputModelMock.mock.calls.map((call) => call[0])
		).toEqual(["moonshotai/kimi-k2.5", "google/gemini-3-flash-preview"]);
	});

	it("stores exhausted provider failures as retry-required requests instead of throwing", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 1,
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);
		generateTextMock
			.mockRejectedValueOnce(new Error("Provider returned error"))
			.mockRejectedValueOnce(new Error("Gateway timeout"))
			.mockRejectedValueOnce(new Error("No output generated."));
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "retry_required",
				currentQuestion: null,
				currentSuggestedAnswers: null,
				currentQuestionInputMode: null,
				currentQuestionScope: null,
				lastError: "No output generated.",
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		expect(step).toMatchObject({
			kind: "retry_required",
			request: {
				id: "clar_req_1",
				status: "retry_required",
				currentQuestion: null,
				currentSuggestedAnswers: null,
				currentQuestionInputMode: null,
				currentQuestionScope: null,
				lastError: "No output generated.",
			},
		});
		expect(updateKnowledgeClarificationRequestMock).toHaveBeenCalledWith(
			{} as never,
			{
				requestId: "clar_req_1",
				updates: {
					status: "retry_required",
					lastError: "No output generated.",
				},
			}
		);
	});

	it("falls back to a draft when the first broad question degrades into a catch-all prompt", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);
		generateTextMock
			.mockResolvedValueOnce({
				output: {
					kind: "question",
					continueClarifying: true,
					inputMode: "textarea_first",
					questionScope: "broad_discovery",
					topicSummary: "Clarify billing timing",
					missingFact: "How billing-change handling works today",
					whyItMatters: "That detail determines the FAQ draft.",
					groundingSource: "topic_anchor",
					groundingSnippet: "Clarify billing timing",
					question: "Can you share more context?",
					suggestedAnswers: [
						"It changes immediately",
						"It changes on the next cycle",
						"It depends on the plan",
					],
				},
				usage: {
					inputTokens: 120,
					outputTokens: 40,
					totalTokens: 160,
				},
			})
			.mockResolvedValueOnce({
				output: {
					kind: "draft_ready",
					continueClarifying: false,
					topicSummary: "Clarify billing timing",
					missingFact: "No additional grounded gap remains",
					whyItMatters:
						"The first broad question was too generic to keep asking.",
					draftFaqPayload: {
						title: "Billing timing",
						question: "When does a billing change take effect?",
						answer: "Billing changes apply at the next billing cycle.",
						categories: ["Billing"],
						relatedQuestions: [],
					},
				},
				usage: {
					inputTokens: 80,
					outputTokens: 30,
					totalTokens: 110,
				},
			});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 0,
				currentQuestion: null,
				currentSuggestedAnswers: null,
				currentQuestionInputMode: null,
				currentQuestionScope: null,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		expect(step.kind).toBe("draft_ready");
		expect(generateTextMock).toHaveBeenCalledTimes(2);
	});

	it("sanitizes malformed clarification questions before storing them", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
			topicSummary: "Clarify account deletion",
			source: "faq",
			conversationId: null,
		});
		const malformedQuestion =
			'1. What is the exact method for a user to delete their account - do they (a) click a "Delete Account" button in settings, (b) email support with a deletion request, or (c) run a CLI command such as `npx ai-support delete-account`?';
		const sanitizedQuestion =
			"What is the exact method for a user to delete their account?";
		const suggestedAnswers = [
			"Click Delete Account in settings",
			"Email support",
			"Use a CLI command",
		];
		const nextQuestionTurn = createTurn({
			question: sanitizedQuestion,
			suggestedAnswers,
		});

		listKnowledgeClarificationTurnsMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([nextQuestionTurn]);
		generateTextMock.mockResolvedValue({
			output: {
				kind: "question",
				continueClarifying: true,
				inputMode: "suggested_answers",
				questionScope: "narrow_detail",
				topicSummary: "Clarify account deletion",
				missingFact: "Which account deletion path users should follow",
				whyItMatters: "That determines the final FAQ answer.",
				groundingSource: "topic_anchor",
				groundingSnippet: "Clarify account deletion",
				question: malformedQuestion,
				suggestedAnswers,
			},
			usage: {
				inputTokens: 120,
				outputTokens: 40,
				totalTokens: 160,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				source: "faq",
				conversationId: null,
				status: "awaiting_answer",
				stepIndex: 1,
				topicSummary: "Clarify account deletion",
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		expect(createKnowledgeClarificationTurnMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				question: sanitizedQuestion,
				suggestedAnswers,
			})
		);
		expect(step).toMatchObject({
			kind: "question",
			question: sanitizedQuestion,
			suggestedAnswers,
			inputMode: "suggested_answers",
			questionScope: "narrow_detail",
		});
	});

	it("includes skipped questions in the clarification history sent back to the model", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 1,
		});
		const historyTurns = [
			createTurn({
				question: "Does the billing change immediately?",
			}),
			createTurn({
				id: "turn_2",
				role: "human_skip",
				question: null,
				suggestedAnswers: null,
				selectedAnswer: null,
				freeAnswer: null,
			}),
		];
		const nextQuestionTurn = createTurn({
			id: "turn_3",
			question: "Should the change wait for the next billing cycle?",
		});

		listKnowledgeClarificationTurnsMock
			.mockResolvedValueOnce(historyTurns)
			.mockResolvedValueOnce([...historyTurns, nextQuestionTurn]);
		generateTextMock.mockResolvedValue({
			output: {
				kind: "question",
				continueClarifying: true,
				inputMode: "suggested_answers",
				questionScope: "narrow_detail",
				topicSummary: "Clarify billing timing",
				missingFact:
					"Whether the billing change always waits for the next cycle",
				whyItMatters: "That determines how the FAQ should describe timing.",
				groundingSource: "latest_exchange",
				groundingSnippet: "Does the billing change immediately?",
				question: "Should the change wait for the next billing cycle?",
				suggestedAnswers: [
					"Yes, always",
					"No, it is immediate",
					"It depends on the plan",
				],
			},
			usage: {
				inputTokens: 140,
				outputTokens: 45,
				totalTokens: 185,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "awaiting_answer",
				stepIndex: 2,
				topicSummary: "Clarify billing timing",
			})
		);

		await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		const promptCall = generateTextMock.mock.calls[0] as
			| [Record<string, unknown>]
			| undefined;

		expect(promptCall?.[0]?.prompt).toContain("Skipped by teammate");
	});

	it("tracks faq-draft-generation usage when the model returns a draft faq", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 2,
			updatedAt: "2026-03-13T10:05:00.000Z",
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([
			createTurn(),
			createTurn({
				id: "turn_2",
				role: "human_answer",
				question: null,
				suggestedAnswers: null,
				selectedAnswer: "At the next billing cycle",
			}),
		]);
		generateTextMock.mockResolvedValue({
			output: createDraftOutput(),
			usage: {
				inputTokens: 180,
				outputTokens: 60,
				totalTokens: 240,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 2,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		const usageCall = trackGenerationUsageMock.mock.calls[0] as unknown as
			| [Record<string, unknown>]
			| undefined;

		expect(step.kind).toBe("draft_ready");
		expect(trackGenerationUsageMock).toHaveBeenCalledTimes(1);
		expect(usageCall?.[0]).toMatchObject({
			conversationId: "conv_1",
			visitorId: "visitor_1",
			aiAgentId: "agent_1",
			usageEventId: "usage_evt_1",
			triggerMessageId: "clar_req_1",
			source: "knowledge_clarification",
			phase: "faq_draft_generation",
			knowledgeClarificationRequestId: "clar_req_1",
			knowledgeClarificationStepIndex: 2,
		});
	});

	it("falls back to a draft when the next question repeats an earlier clarification", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 1,
		});
		const historyTurns = [
			createTurn({
				question: "Does the billing change immediately?",
			}),
			createTurn({
				id: "turn_2",
				role: "human_answer",
				question: null,
				suggestedAnswers: null,
				selectedAnswer: "At the next billing cycle",
			}),
		];

		listKnowledgeClarificationTurnsMock.mockResolvedValue(historyTurns);
		generateTextMock
			.mockResolvedValueOnce({
				output: {
					kind: "question",
					continueClarifying: true,
					inputMode: "suggested_answers",
					questionScope: "narrow_detail",
					topicSummary: "Clarify billing timing",
					missingFact: "Whether billing changes immediately",
					whyItMatters: "That controls the FAQ answer.",
					groundingSource: "latest_exchange",
					groundingSnippet: "Does the billing change immediately?",
					question: "Does the billing change immediately?",
					suggestedAnswers: [
						"Immediately",
						"At the next billing cycle",
						"It depends on the plan",
					],
				},
				usage: {
					inputTokens: 120,
					outputTokens: 40,
					totalTokens: 160,
				},
			})
			.mockResolvedValueOnce({
				output: {
					kind: "draft_ready",
					continueClarifying: false,
					topicSummary: "Clarify billing timing",
					missingFact: "Exact billing timing",
					whyItMatters: "The answer is already grounded enough to draft.",
					draftFaqPayload: {
						title: "Billing timing",
						question: "When does a billing change take effect?",
						answer: "Billing changes apply at the next billing cycle.",
						categories: ["Billing"],
						relatedQuestions: [],
					},
				},
				usage: {
					inputTokens: 80,
					outputTokens: 30,
					totalTokens: 110,
				},
			});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 1,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});
		const usageCall = trackGenerationUsageMock.mock.calls[0] as unknown as
			| [Record<string, unknown>]
			| undefined;

		expect(step.kind).toBe("draft_ready");
		expect(generateTextMock).toHaveBeenCalledTimes(2);
		expect(trackGenerationUsageMock).toHaveBeenCalledTimes(1);
		expect(usageCall?.[0]).toMatchObject({
			phase: "faq_draft_generation",
		});
	});

	it("falls back to a draft when a follow-up is not grounded in the latest answer", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 1,
		});
		const historyTurns = [
			createTurn({
				question: "When does the billing change take effect?",
			}),
			createTurn({
				id: "turn_2",
				role: "human_answer",
				question: null,
				suggestedAnswers: null,
				selectedAnswer: "At the next billing cycle",
			}),
		];

		listKnowledgeClarificationTurnsMock.mockResolvedValue(historyTurns);
		generateTextMock
			.mockResolvedValueOnce({
				output: {
					kind: "question",
					continueClarifying: true,
					inputMode: "suggested_answers",
					questionScope: "narrow_detail",
					topicSummary: "Clarify billing timing",
					missingFact: "Whether annual plans are an exception",
					whyItMatters: "That would materially change the FAQ answer.",
					groundingSource: "topic_anchor",
					groundingSnippet: "Clarify billing timing",
					question: "Are annual plans handled differently?",
					suggestedAnswers: [
						"No, same rule",
						"Yes, they are different",
						"It depends on the plan",
					],
				},
				usage: {
					inputTokens: 120,
					outputTokens: 40,
					totalTokens: 160,
				},
			})
			.mockResolvedValueOnce({
				output: {
					kind: "draft_ready",
					continueClarifying: false,
					topicSummary: "Clarify billing timing",
					missingFact: "No additional grounded gap remains",
					whyItMatters:
						"The latest answer is specific enough for a narrow draft.",
					draftFaqPayload: {
						title: "Billing timing",
						question: "When does a billing change take effect?",
						answer: "Billing changes apply at the next billing cycle.",
						categories: ["Billing"],
						relatedQuestions: [],
					},
				},
				usage: {
					inputTokens: 80,
					outputTokens: 30,
					totalTokens: 110,
				},
			});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 1,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		expect(step.kind).toBe("draft_ready");
		expect(generateTextMock).toHaveBeenCalledTimes(2);
	});

	it("goes straight to a draft when the latest answer already resolves the gap", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 1,
		});
		const historyTurns = [
			createTurn({
				question: "When does the billing change take effect?",
			}),
			createTurn({
				id: "turn_2",
				role: "human_answer",
				question: null,
				suggestedAnswers: null,
				selectedAnswer: "At the next billing cycle",
			}),
		];

		listKnowledgeClarificationTurnsMock.mockResolvedValue(historyTurns);
		generateTextMock.mockResolvedValue({
			output: {
				kind: "draft_ready",
				continueClarifying: false,
				topicSummary: "Clarify billing timing",
				missingFact: "No additional grounded gap remains",
				whyItMatters: "The latest answer already resolves the material fact.",
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			},
			usage: {
				inputTokens: 80,
				outputTokens: 30,
				totalTokens: 110,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 1,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		expect(step.kind).toBe("draft_ready");
		expect(generateTextMock).toHaveBeenCalledTimes(1);
	});

	it("keeps transcript claims separate from grounded facts in the model prompt", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);
		generateTextMock.mockResolvedValue({
			output: {
				kind: "draft_ready",
				continueClarifying: false,
				topicSummary: "Clarify billing timing",
				missingFact: "No additional grounded gap remains",
				whyItMatters: "The prompt should distinguish facts from claims.",
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			},
			usage: {
				inputTokens: 180,
				outputTokens: 60,
				totalTokens: 240,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 0,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		const promptCall = generateTextMock.mock.calls[0] as
			| [Record<string, unknown>]
			| undefined;
		const prompt = String(promptCall?.[0]?.prompt ?? "");

		expect(prompt).toContain(
			"Transcript claims:\n- Visitor claim: When does the billing change take effect?"
		);
		expect(prompt).not.toContain(
			"Grounded facts:\n- Visitor claim: When does the billing change take effect?"
		);
	});

	it("tells the model to keep clarification questions short and free of inline answers", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);
		generateTextMock.mockResolvedValue({
			output: {
				kind: "draft_ready",
				continueClarifying: false,
				topicSummary: "Clarify billing timing",
				missingFact: "No additional grounded gap remains",
				whyItMatters: "The prompt should constrain question formatting.",
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			},
			usage: {
				inputTokens: 180,
				outputTokens: 60,
				totalTokens: 240,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 0,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		const promptCall = generateTextMock.mock.calls[0] as
			| [Record<string, unknown>]
			| undefined;
		const systemPrompt = String(promptCall?.[0]?.system ?? "");

		expect(systemPrompt).toContain(
			"the question field must be one short, simple plain-language question."
		);
		expect(systemPrompt).toContain(
			'must not start with numbering or bullets such as "1.", "1)", "a)", or "(a)".'
		);
		expect(systemPrompt).toContain(
			"must not include answer options, multiple-choice labels, button text, support emails, CLI commands, or any candidate answers."
		);
		expect(systemPrompt).toContain(
			"Put all answer choices only in suggestedAnswers."
		);
	});

	it("frames clarification prompts for the website owner and strips visitor-facing base prompts", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);
		generateTextMock.mockResolvedValue({
			output: {
				kind: "draft_ready",
				continueClarifying: false,
				topicSummary: "Clarify avatar upload flow",
				missingFact: "No additional grounded gap remains",
				whyItMatters: "The prompt should stay owner-facing and internal.",
				draftFaqPayload: {
					title: "Avatar uploads",
					question: "How do users upload a profile photo?",
					answer: "Users can upload a profile photo from account settings.",
					categories: ["Account"],
					relatedQuestions: [],
				},
			},
			usage: {
				inputTokens: 180,
				outputTokens: 60,
				totalTokens: 240,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 0,
				topicSummary: "Clarify avatar upload flow",
				draftFaqPayload: {
					title: "Avatar uploads",
					question: "How do users upload a profile photo?",
					answer: "Users can upload a profile photo from account settings.",
					categories: ["Account"],
					relatedQuestions: [],
				},
			})
		);

		await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent({
				basePrompt:
					"Help the visitor clearly and ask what they already clicked.",
			}),
			conversation: createConversation(),
		});

		const promptCall = generateTextMock.mock.calls[0] as
			| [Record<string, unknown>]
			| undefined;
		const systemPrompt = String(promptCall?.[0]?.system ?? "");
		const prompt = String(promptCall?.[0]?.prompt ?? "");

		expect(systemPrompt).toContain("website owner or one of their teammates");
		expect(systemPrompt).toContain("never the visitor");
		expect(systemPrompt).toContain(
			"Never ask what the visitor already tried, clicked, searched for, entered, or saw."
		);
		expect(systemPrompt).toContain(
			'Good broad question: "How does avatar setup work in your product today?"'
		);
		expect(systemPrompt).toContain(
			'Good narrow question: "Which settings page lets users upload a profile photo?"'
		);
		expect(systemPrompt).toContain(
			'Bad question: "Where has the visitor already looked for the avatar option?"'
		);
		expect(prompt).toContain(
			"Clarification audience: website owner or teammate. This is private/internal, not the visitor."
		);
		expect(prompt).not.toContain(
			"Help the visitor clearly and ask what they already clicked."
		);
	});

	it("uses the clarification model fallback when the configured model is unknown", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 0,
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);
		generateTextMock.mockResolvedValue({
			output: createDraftOutput({
				missingFact: "No additional grounded gap remains",
				whyItMatters: "The model fallback should still generate a draft.",
			}),
			usage: {
				inputTokens: 180,
				outputTokens: 60,
				totalTokens: 240,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 0,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent({
				model: "legacy/unknown-model",
			}),
			conversation: createConversation(),
		});

		expect(resolveClarificationModelForExecutionMock).toHaveBeenCalledWith(
			"legacy/unknown-model"
		);
		expect(createStructuredOutputModelMock).toHaveBeenCalledWith(
			"moonshotai/kimi-k2.5"
		);
	});

	it("forces a draft once the clarification flow has already asked three questions", async () => {
		const { runKnowledgeClarificationStep } = await modulePromise;
		const request = createRequest({
			status: "analyzing",
			stepIndex: 3,
			maxSteps: 3,
		});

		listKnowledgeClarificationTurnsMock.mockResolvedValue([
			createTurn({ id: "turn_1", question: "Question 1?" }),
			createTurn({
				id: "turn_2",
				role: "human_answer",
				question: null,
				suggestedAnswers: null,
				selectedAnswer: "Answer 1",
			}),
			createTurn({ id: "turn_3", question: "Question 2?" }),
			createTurn({
				id: "turn_4",
				role: "human_answer",
				question: null,
				suggestedAnswers: null,
				selectedAnswer: "Answer 2",
			}),
			createTurn({ id: "turn_5", question: "Question 3?" }),
		]);
		generateTextMock.mockResolvedValue({
			output: {
				kind: "draft_ready",
				continueClarifying: true,
				topicSummary: "Clarify billing timing",
				missingFact: "Any remaining edge cases",
				whyItMatters: "The hard cap has been reached.",
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			},
			usage: {
				inputTokens: 180,
				outputTokens: 60,
				totalTokens: 240,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "draft_ready",
				stepIndex: 3,
				maxSteps: 3,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does a billing change take effect?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);

		const step = await runKnowledgeClarificationStep({
			db: {} as never,
			request,
			aiAgent: createAiAgent(),
			conversation: createConversation(),
		});

		const promptCall = generateTextMock.mock.calls[0] as
			| [Record<string, unknown>]
			| undefined;

		expect(step.kind).toBe("draft_ready");
		expect(promptCall?.[0]?.prompt).toContain("Return draft_ready now.");
	});

	it("stores linked FAQ context when deepening an existing FAQ", async () => {
		const { startFaqKnowledgeClarification } = await modulePromise;
		const draftRequest = createRequest({
			conversationId: null,
			source: "faq",
			status: "analyzing",
			topicSummary:
				"Clarify the exact FAQ answer for: When do billing changes apply?",
			targetKnowledgeId: "knowledge_1",
		});

		createKnowledgeClarificationRequestMock.mockResolvedValue(draftRequest);
		listKnowledgeClarificationTurnsMock.mockResolvedValue([]);
		generateTextMock.mockResolvedValue({
			output: {
				kind: "draft_ready",
				continueClarifying: false,
				topicSummary:
					"Clarify the exact FAQ answer for: When do billing changes apply?",
				missingFact: "Whether billing changes ever apply immediately",
				whyItMatters: "That keeps the FAQ precise without overpromising.",
				draftFaqPayload: {
					title: "Billing timing",
					question: "When do billing changes apply?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: ["Can I make a billing change immediately?"],
				},
			},
			usage: {
				inputTokens: 140,
				outputTokens: 55,
				totalTokens: 195,
			},
		});
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				conversationId: null,
				source: "faq",
				status: "draft_ready",
				topicSummary:
					"Clarify the exact FAQ answer for: When do billing changes apply?",
				targetKnowledgeId: "knowledge_1",
				draftFaqPayload: {
					title: "Billing timing",
					question: "When do billing changes apply?",
					answer: "Billing changes apply at the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: ["Can I make a billing change immediately?"],
				},
			})
		);

		const result = await startFaqKnowledgeClarification({
			db: {} as never,
			organizationId: "org_1",
			websiteId: "site_1",
			aiAgent: createAiAgent(),
			topicSummary: "Clarify FAQ: When do billing changes apply?",
			targetKnowledge: createFaqKnowledge(),
		});

		expect(result.step.kind).toBe("draft_ready");
		expect(createKnowledgeClarificationRequestMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				maxSteps: 3,
				topicSummary:
					"Clarify the exact FAQ answer for: When do billing changes apply?",
				contextSnapshot: expect.objectContaining({
					linkedFaq: expect.objectContaining({
						question: "When do billing changes apply?",
					}),
				}),
			})
		);
	});
});
