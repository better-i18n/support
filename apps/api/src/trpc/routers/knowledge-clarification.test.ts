import { beforeEach, describe, expect, it, mock } from "bun:test";

const getWebsiteBySlugWithAccessMock = mock(
	(async () => null) as (...args: unknown[]) => Promise<unknown>
);
const getKnowledgeClarificationRequestByIdMock = mock(
	(async () => null) as (...args: unknown[]) => Promise<unknown>
);
const updateKnowledgeClarificationRequestMock = mock(
	(async () => null) as (...args: unknown[]) => Promise<unknown>
);
const getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock =
	mock((async () => null) as (...args: unknown[]) => Promise<unknown>);
const getLatestKnowledgeClarificationForConversationByTopicFingerprintMock =
	mock((async () => null) as (...args: unknown[]) => Promise<unknown>);
const createKnowledgeClarificationTurnMock = mock(
	(async () => null) as (...args: unknown[]) => Promise<unknown>
);
const createKnowledgeMock = mock(
	(async () => null) as (...args: unknown[]) => Promise<unknown>
);
const getKnowledgeByIdMock = mock(
	(async () => null) as (...args: unknown[]) => Promise<unknown>
);
const getKnowledgeCountByTypeMock = mock(
	(async () => 0) as (...args: unknown[]) => Promise<number>
);
const getTotalKnowledgeSizeBytesMock = mock(
	(async () => 0) as (...args: unknown[]) => Promise<number>
);
const updateKnowledgeMock = mock(
	(async () => null) as (...args: unknown[]) => Promise<unknown>
);
const emitConversationClarificationUpdateMock = mock((async () => {}) as (
	...args: unknown[]
) => Promise<void>);
const createKnowledgeClarificationAuditEntryMock = mock((async () => {}) as (
	...args: unknown[]
) => Promise<void>);
const loadKnowledgeClarificationRuntimeMock = mock((async () => ({
	aiAgent: { id: "01JQJ2V0A00000000000000003" },
	conversation: { id: "conv_1", visitorId: "visitor_1" },
	targetKnowledge: null,
})) as (...args: unknown[]) => Promise<unknown>);
const runKnowledgeClarificationStepMock = mock(
	(async () => null) as (...args: unknown[]) => Promise<unknown>
);

mock.module("@api/db/queries/website", () => ({
	getWebsiteBySlugWithAccess: getWebsiteBySlugWithAccessMock,
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
	createKnowledgeClarificationTurn: createKnowledgeClarificationTurnMock,
	getActiveKnowledgeClarificationForConversation: mock(async () => null),
	getLatestKnowledgeClarificationForConversationBySourceTriggerMessageId:
		getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock,
	getLatestKnowledgeClarificationForConversationByTopicFingerprint:
		getLatestKnowledgeClarificationForConversationByTopicFingerprintMock,
	getKnowledgeClarificationRequestById:
		getKnowledgeClarificationRequestByIdMock,
	listActiveKnowledgeClarificationSummariesForConversations: mock(
		async () => new Map()
	),
	listKnowledgeClarificationProposals: mock(async () => []),
	listKnowledgeClarificationTurns: mock(async () => []),
	updateKnowledgeClarificationRequest: updateKnowledgeClarificationRequestMock,
}));

mock.module("@api/db/queries/knowledge", () => ({
	createKnowledge: createKnowledgeMock,
	getKnowledgeById: getKnowledgeByIdMock,
	getKnowledgeCountByType: getKnowledgeCountByTypeMock,
	getTotalKnowledgeSizeBytes: getTotalKnowledgeSizeBytesMock,
	updateKnowledge: updateKnowledgeMock,
}));

mock.module("@api/services/knowledge-clarification", () => ({
	createKnowledgeClarificationAuditEntry:
		createKnowledgeClarificationAuditEntryMock,
	emitConversationClarificationUpdate: emitConversationClarificationUpdateMock,
	loadKnowledgeClarificationRuntime: loadKnowledgeClarificationRuntimeMock,
	runKnowledgeClarificationStep: runKnowledgeClarificationStepMock,
	serializeKnowledgeClarificationRequest: mock((value: unknown) => value),
	startConversationKnowledgeClarification: mock(async () => {
		throw new Error("unused");
	}),
	startFaqKnowledgeClarification: mock(async () => {
		throw new Error("unused");
	}),
}));

const modulePromise = Promise.all([
	import("../init"),
	import("./knowledge-clarification"),
]);

function createWebsite() {
	return {
		id: "01JQJ2V0A00000000000000002",
		organizationId: "01JQJ2V0A00000000000000001",
		slug: "acme",
	} as never;
}

function createRequest(
	overrides: Record<string, unknown> = {}
): Record<string, unknown> {
	return {
		id: "01JQJ2V0A00000000000000010",
		organizationId: "01JQJ2V0A00000000000000001",
		websiteId: "01JQJ2V0A00000000000000002",
		aiAgentId: "01JQJ2V0A00000000000000003",
		conversationId: "conv_1",
		source: "conversation",
		status: "awaiting_answer",
		topicSummary: "Clarify billing timing",
		stepIndex: 1,
		maxSteps: 3,
		targetKnowledgeId: null,
		currentQuestion: "Does the billing change immediately?",
		currentSuggestedAnswers: ["Immediately", "Later", "It depends"],
		currentQuestionInputMode: "suggested_answers",
		currentQuestionScope: "narrow_detail",
		draftFaqPayload: null,
		lastError: null,
		createdAt: "2026-03-17T10:00:00.000Z",
		updatedAt: "2026-03-17T10:00:00.000Z",
		...overrides,
	};
}

function createRetryStep() {
	return {
		kind: "retry_required" as const,
		request: createRequest({
			status: "retry_required",
			currentQuestion: null,
			currentSuggestedAnswers: null,
			currentQuestionInputMode: null,
			currentQuestionScope: null,
			lastError: "No output generated.",
		}),
	};
}

async function createCaller() {
	const [{ createCallerFactory }, { knowledgeClarificationRouter }] =
		await modulePromise;
	const createCallerFactoryForRouter = createCallerFactory(
		knowledgeClarificationRouter
	);

	return createCallerFactoryForRouter({
		db: {} as never,
		user: { id: "user_1" } as never,
		session: { id: "session_1" } as never,
		geo: {} as never,
		headers: new Headers(),
	});
}

describe("knowledgeClarification router retry handling", () => {
	beforeEach(() => {
		getWebsiteBySlugWithAccessMock.mockReset();
		getKnowledgeClarificationRequestByIdMock.mockReset();
		updateKnowledgeClarificationRequestMock.mockReset();
		getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock.mockReset();
		getLatestKnowledgeClarificationForConversationByTopicFingerprintMock.mockReset();
		createKnowledgeClarificationTurnMock.mockReset();
		createKnowledgeMock.mockReset();
		getKnowledgeByIdMock.mockReset();
		getKnowledgeCountByTypeMock.mockReset();
		getTotalKnowledgeSizeBytesMock.mockReset();
		updateKnowledgeMock.mockReset();
		emitConversationClarificationUpdateMock.mockReset();
		createKnowledgeClarificationAuditEntryMock.mockReset();
		loadKnowledgeClarificationRuntimeMock.mockReset();
		runKnowledgeClarificationStepMock.mockReset();

		getWebsiteBySlugWithAccessMock.mockResolvedValue(createWebsite());
		getKnowledgeClarificationRequestByIdMock.mockResolvedValue(createRequest());
		getLatestKnowledgeClarificationForConversationBySourceTriggerMessageIdMock.mockResolvedValue(
			null
		);
		getLatestKnowledgeClarificationForConversationByTopicFingerprintMock.mockResolvedValue(
			null
		);
		updateKnowledgeClarificationRequestMock.mockResolvedValue(
			createRequest({
				status: "analyzing",
				lastError: null,
			})
		);
		loadKnowledgeClarificationRuntimeMock.mockResolvedValue({
			aiAgent: { id: "01JQJ2V0A00000000000000003" },
			conversation: {
				id: "conv_1",
				websiteId: "01JQJ2V0A00000000000000002",
				organizationId: "01JQJ2V0A00000000000000001",
				visitorId: "visitor_1",
			},
			targetKnowledge: null,
		});
		runKnowledgeClarificationStepMock.mockResolvedValue(createRetryStep());
	});

	it("returns retry_required from answer without throwing a TRPC error", async () => {
		const caller = await createCaller();

		const result = await caller.answer({
			websiteSlug: "acme",
			requestId: "01JQJ2V0A00000000000000010",
			selectedAnswer: "At the next billing cycle",
		});

		expect(result.step.kind).toBe("retry_required");
		expect(createKnowledgeClarificationTurnMock).toHaveBeenCalledWith(
			{} as never,
			expect.objectContaining({
				role: "human_answer",
				selectedAnswer: "At the next billing cycle",
			})
		);
		expect(runKnowledgeClarificationStepMock).toHaveBeenCalledWith(
			expect.objectContaining({
				progressReporter: expect.any(Function),
			})
		);
		expect(emitConversationClarificationUpdateMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				request: expect.objectContaining({
					status: "retry_required",
				}),
			})
		);
	});

	it("returns retry_required from skip without throwing a TRPC error", async () => {
		const caller = await createCaller();

		const result = await caller.skip({
			websiteSlug: "acme",
			requestId: "01JQJ2V0A00000000000000010",
		});

		expect(result.step.kind).toBe("retry_required");
		expect(createKnowledgeClarificationTurnMock).toHaveBeenCalledWith(
			{} as never,
			expect.objectContaining({
				role: "human_skip",
			})
		);
		expect(runKnowledgeClarificationStepMock).toHaveBeenCalledWith(
			expect.objectContaining({
				progressReporter: expect.any(Function),
			})
		);
	});

	it("returns retry_required from retry without throwing a TRPC error", async () => {
		getKnowledgeClarificationRequestByIdMock.mockResolvedValueOnce(
			createRequest({
				status: "retry_required",
				currentQuestion: null,
				currentSuggestedAnswers: null,
				currentQuestionInputMode: null,
				currentQuestionScope: null,
				lastError: "No output generated.",
			})
		);
		const caller = await createCaller();

		const result = await caller.retry({
			websiteSlug: "acme",
			requestId: "01JQJ2V0A00000000000000010",
		});

		expect(result.step.kind).toBe("retry_required");
		expect(createKnowledgeClarificationTurnMock).not.toHaveBeenCalled();
		expect(runKnowledgeClarificationStepMock).toHaveBeenCalledTimes(1);
		expect(runKnowledgeClarificationStepMock).toHaveBeenCalledWith(
			expect.objectContaining({
				progressReporter: expect.any(Function),
			})
		);
	});

	it("rejects retrying a clarification that is not retry-required", async () => {
		const caller = await createCaller();

		await expect(
			caller.retry({
				websiteSlug: "acme",
				requestId: "01JQJ2V0A00000000000000010",
			})
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "This clarification request cannot be retried",
		});
	});

	it("rejects answering a draft-ready clarification", async () => {
		getKnowledgeClarificationRequestByIdMock.mockResolvedValueOnce(
			createRequest({
				status: "draft_ready",
				currentQuestion: null,
				currentSuggestedAnswers: null,
				currentQuestionInputMode: null,
				currentQuestionScope: null,
				draftFaqPayload: {
					title: "Billing timing",
					question: "When does billing change take effect?",
					answer: "At the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		);
		const caller = await createCaller();

		await expect(
			caller.answer({
				websiteSlug: "acme",
				requestId: "01JQJ2V0A00000000000000010",
				selectedAnswer: "At the next billing cycle",
			})
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "This clarification request is not waiting for an answer",
		});
	});

	it("rejects approving a clarification that is not draft-ready", async () => {
		const caller = await createCaller();

		await expect(
			caller.approveDraft({
				websiteSlug: "acme",
				requestId: "01JQJ2V0A00000000000000010",
				draft: {
					title: "Billing timing",
					question: "When does billing change take effect?",
					answer: "At the next billing cycle.",
					categories: ["Billing"],
					relatedQuestions: [],
				},
			})
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "This clarification draft is no longer ready to approve",
		});
	});

	it("rejects deferring an applied clarification", async () => {
		getKnowledgeClarificationRequestByIdMock.mockResolvedValueOnce(
			createRequest({
				status: "applied",
				currentQuestion: null,
				currentSuggestedAnswers: null,
				currentQuestionInputMode: null,
				currentQuestionScope: null,
			})
		);
		const caller = await createCaller();

		await expect(
			caller.defer({
				websiteSlug: "acme",
				requestId: "01JQJ2V0A00000000000000010",
			})
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "This clarification request can no longer be changed",
		});
	});

	it("rejects dismissing an already-dismissed clarification", async () => {
		getKnowledgeClarificationRequestByIdMock.mockResolvedValueOnce(
			createRequest({
				status: "dismissed",
				currentQuestion: null,
				currentSuggestedAnswers: null,
				currentQuestionInputMode: null,
				currentQuestionScope: null,
			})
		);
		const caller = await createCaller();

		await expect(
			caller.dismiss({
				websiteSlug: "acme",
				requestId: "01JQJ2V0A00000000000000010",
			})
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "This clarification request can no longer be changed",
		});
	});

	it("returns a null proposal when the clarification request no longer exists", async () => {
		getKnowledgeClarificationRequestByIdMock.mockResolvedValueOnce(null);
		const caller = await createCaller();

		const result = await caller.getProposal({
			websiteSlug: "acme",
			requestId: "01JQJ2V0A00000000000000010",
		});

		expect(result).toEqual({
			request: null,
		});
	});
});
