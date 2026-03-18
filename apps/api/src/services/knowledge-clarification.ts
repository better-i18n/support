import { buildConversationTranscript } from "@api/ai-pipeline/primary-pipeline/steps/intake/history";
import { trackGenerationUsage } from "@api/ai-pipeline/shared/usage";
import type { Database } from "@api/db";
import { getAiAgentForWebsite } from "@api/db/queries/ai-agent";
import { getConversationById } from "@api/db/queries/conversation";
import { getKnowledgeById } from "@api/db/queries/knowledge";
import {
	createKnowledgeClarificationRequest,
	createKnowledgeClarificationTurn,
	getActiveKnowledgeClarificationForConversation,
	getLatestKnowledgeClarificationForConversationBySourceTriggerMessageId,
	getLatestKnowledgeClarificationForConversationByTopicFingerprint,
	listKnowledgeClarificationTurns,
	REUSABLE_CONVERSATION_TOPIC_FINGERPRINT_STATUSES,
	updateKnowledgeClarificationRequest,
} from "@api/db/queries/knowledge-clarification";
import type { AiAgentSelect } from "@api/db/schema/ai-agent";
import type { ConversationSelect } from "@api/db/schema/conversation";
import type { KnowledgeSelect } from "@api/db/schema/knowledge";
import type {
	KnowledgeClarificationRequestSelect,
	KnowledgeClarificationTurnSelect,
} from "@api/db/schema/knowledge-clarification";
import {
	APICallError,
	createStructuredOutputModel,
	EmptyResponseBodyError,
	generateText,
	NoContentGeneratedError,
	NoObjectGeneratedError,
	NoOutputGeneratedError,
	NoSuchModelError,
	Output,
} from "@api/lib/ai";
import { resolveClarificationModelForExecution } from "@api/lib/ai-credits/config";
import {
	buildConversationClarificationContextSnapshot,
	buildFaqClarificationContextSnapshot,
	buildSpecificClarificationTopicSummary,
	extractLinkedFaqSnapshot,
	type KnowledgeClarificationContextSnapshot,
} from "@api/lib/knowledge-clarification-context";
import { realtime } from "@api/realtime/emitter";
import {
	buildClarificationRelevancePacket,
	CLARIFICATION_QUESTION_GROUNDING_SOURCES,
	validateClarificationQuestionCandidate,
} from "@api/services/knowledge-clarification-relevance";
import {
	buildClarificationTopicFingerprint,
	getClarificationSourceTriggerMessageId,
} from "@api/utils/knowledge-clarification-identity";
import {
	buildConversationClarificationSummary,
	getDisplayClarificationQuestionTurn,
	getPendingClarificationQuestionTurn,
} from "@api/utils/knowledge-clarification-summary";
import { createTimelineItem } from "@api/utils/timeline-item";
import {
	ConversationTimelineType,
	type KnowledgeClarificationDraftFaq,
	type KnowledgeClarificationQuestionInputMode,
	type KnowledgeClarificationQuestionScope,
	type KnowledgeClarificationRequest,
	type KnowledgeClarificationStatus,
	type KnowledgeClarificationStepResponse,
	TimelineItemVisibility,
} from "@cossistant/types";
import { ulid } from "ulid";
import { z } from "zod";

const DEFAULT_MAX_CLARIFICATION_STEPS = 3;

const clarificationOutputBaseSchema = z.object({
	topicSummary: z.string().min(1).max(400),
	missingFact: z.string().min(1).max(280),
	whyItMatters: z.string().min(1).max(400),
});

const clarificationQuestionOutputSchema = clarificationOutputBaseSchema.extend({
	kind: z.literal("question"),
	continueClarifying: z.literal(true),
	inputMode: z.enum(["textarea_first", "suggested_answers"]),
	questionScope: z.enum(["broad_discovery", "narrow_detail"]),
	groundingSource: z.enum(CLARIFICATION_QUESTION_GROUNDING_SOURCES),
	groundingSnippet: z.string().min(1).max(280),
	question: z.string().min(1).max(500),
	suggestedAnswers: z.array(z.string().min(1).max(240)).length(3),
});

const clarificationDraftFaqPayloadSchema = z.object({
	title: z.string().min(1).max(200).nullable(),
	question: z.string().min(1).max(300),
	answer: z.string().min(1).max(6000),
	categories: z.array(z.string().min(1).max(80)).max(8),
	relatedQuestions: z.array(z.string().min(1).max(300)).max(8),
});

const clarificationDraftOutputSchema = clarificationOutputBaseSchema.extend({
	kind: z.literal("draft_ready"),
	continueClarifying: z.boolean(),
	draftFaqPayload: clarificationDraftFaqPayloadSchema,
});

const clarificationModelOutputSchema = clarificationOutputBaseSchema.extend({
	kind: z.enum(["question", "draft_ready"]),
	continueClarifying: z.boolean(),
	inputMode: z.enum(["textarea_first", "suggested_answers"]).nullable(),
	questionScope: z.enum(["broad_discovery", "narrow_detail"]).nullable(),
	groundingSource: z.enum(CLARIFICATION_QUESTION_GROUNDING_SOURCES).nullable(),
	groundingSnippet: z.string().min(1).max(280).nullable(),
	question: z.string().min(1).max(500).nullable(),
	suggestedAnswers: z.array(z.string().min(1).max(240)).length(3).nullable(),
	draftFaqPayload: clarificationDraftFaqPayloadSchema.nullable(),
});

type ClarificationQuestionOutput = z.infer<
	typeof clarificationQuestionOutputSchema
>;
type ClarificationDraftOutput = z.infer<typeof clarificationDraftOutputSchema>;
type ClarificationModelOutput = z.infer<typeof clarificationModelOutputSchema>;

type KnowledgeClarificationActor = {
	userId?: string | null;
	aiAgentId?: string | null;
};

type StartConversationKnowledgeClarificationParams = {
	db: Database;
	organizationId: string;
	websiteId: string;
	aiAgent: AiAgentSelect;
	conversation: ConversationSelect;
	topicSummary: string;
	actor: KnowledgeClarificationActor;
	contextSnapshot?: KnowledgeClarificationContextSnapshot | null;
	maxSteps?: number;
	creationMode?: "manual" | "automation";
};

type StartFaqKnowledgeClarificationParams = {
	db: Database;
	organizationId: string;
	websiteId: string;
	aiAgent: AiAgentSelect;
	topicSummary: string;
	targetKnowledge: KnowledgeSelect;
	contextSnapshot?: KnowledgeClarificationContextSnapshot | null;
	maxSteps?: number;
};

type RunKnowledgeClarificationStepParams = {
	db: Database;
	request: KnowledgeClarificationRequestSelect;
	aiAgent: AiAgentSelect;
	conversation?: ConversationSelect | null;
	targetKnowledge?: KnowledgeSelect | null;
};

type ClarificationUsagePhase =
	| "clarification_question"
	| "faq_draft_generation";

type ClarificationGenerationResult = {
	kind: "success";
	output: ClarificationQuestionOutput | ClarificationDraftOutput;
	modelId: string;
	modelIdOriginal?: string;
	modelMigrationApplied?: boolean;
	providerUsage?:
		| {
				inputTokens?: number;
				outputTokens?: number;
				totalTokens?: number;
		  }
		| undefined;
};

type ClarificationRetryRequiredResult = {
	kind: "retry_required";
	lastError: string;
};

type ClarificationQuestionStrategy = {
	inputMode: KnowledgeClarificationQuestionInputMode;
	questionScope: KnowledgeClarificationQuestionScope;
};

type ConversationClarificationStartResolution =
	| "created"
	| "reused"
	| "suppressed_duplicate";

type ConversationClarificationStartResult = {
	request: KnowledgeClarificationRequest;
	step: KnowledgeClarificationStepResponse | null;
	created: boolean;
	resolution: ConversationClarificationStartResolution;
};

const CLARIFICATION_FALLBACK_MODEL_IDS = [
	"moonshotai/kimi-k2.5",
	"google/gemini-3-flash-preview",
	"openai/gpt-5-mini",
] as const;

function isTerminalClarificationStatus(
	status: KnowledgeClarificationStatus
): status is "applied" | "dismissed" {
	return status === "applied" || status === "dismissed";
}

function isUniqueViolationError(
	error: unknown,
	constraintName?: string
): boolean {
	if (!(typeof error === "object" && error !== null)) {
		return false;
	}

	const code = "code" in error ? error.code : null;
	if (code !== "23505") {
		return false;
	}

	if (!constraintName) {
		return true;
	}

	const message =
		typeof (error as { message?: unknown }).message === "string"
			? (error as { message: string }).message
			: "";
	const detail =
		typeof (error as { detail?: unknown }).detail === "string"
			? (error as { detail: string }).detail
			: "";
	const constraint =
		typeof (error as { constraint?: unknown }).constraint === "string"
			? (error as { constraint: string }).constraint
			: "";

	return (
		constraint === constraintName ||
		`${message} ${detail}`.includes(constraintName)
	);
}

function normalizeDraftFaq(
	draft: ClarificationDraftOutput["draftFaqPayload"]
): KnowledgeClarificationDraftFaq {
	return {
		title: draft.title ?? null,
		question: draft.question.trim(),
		answer: draft.answer.trim(),
		categories: [
			...new Set(draft.categories.map((value) => value.trim()).filter(Boolean)),
		],
		relatedQuestions: [
			...new Set(
				draft.relatedQuestions.map((value) => value.trim()).filter(Boolean)
			),
		],
	};
}

function normalizeClarificationQuestionText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function sanitizeClarificationQuestion(question: string): string {
	let sanitized = normalizeClarificationQuestionText(question);

	sanitized = sanitized
		.replace(/^(?:[-*\u2022]\s+|\([a-z0-9]\)\s*|[a-z0-9][.)]\s+)/i, "")
		.trim();

	const inlineChoiceMatch = sanitized.match(
		/\s(?:\([a-z0-9]\)|[a-z0-9][.)]|option\s+[a-z0-9]\b)(?=\s|:|-|$)/i
	);
	if (inlineChoiceMatch && typeof inlineChoiceMatch.index === "number") {
		sanitized = sanitized.slice(0, inlineChoiceMatch.index).trim();
	}

	let previous = "";
	while (sanitized && sanitized !== previous) {
		previous = sanitized;
		sanitized = sanitized
			.replace(/[\s:;,\-.]+$/g, "")
			.replace(/\b(?:do they|is it|are they|does it)\s*$/i, "")
			.trim();
	}

	sanitized = sanitized.replace(/[.!:;,/-]+$/g, "").trim();

	if (!sanitized) {
		return normalizeClarificationQuestionText(question);
	}

	return sanitized.endsWith("?") ? sanitized : `${sanitized}?`;
}

function normalizeClarificationQuestionOutput(
	output: ClarificationModelOutput
): ClarificationQuestionOutput {
	if ((output.draftFaqPayload ?? null) !== null) {
		throw new Error(
			"Clarification model returned a draft payload for a question response."
		);
	}

	const parsed = clarificationQuestionOutputSchema.safeParse({
		kind: "question",
		continueClarifying: output.continueClarifying,
		inputMode: output.inputMode ?? null,
		questionScope: output.questionScope ?? null,
		groundingSource: output.groundingSource ?? null,
		groundingSnippet: output.groundingSnippet ?? null,
		question: output.question ?? null,
		suggestedAnswers: output.suggestedAnswers ?? null,
		topicSummary: output.topicSummary,
		missingFact: output.missingFact,
		whyItMatters: output.whyItMatters,
	});

	if (!parsed.success) {
		throw new Error(
			"Clarification model returned an invalid question response."
		);
	}

	return parsed.data;
}

function normalizeClarificationDraftOutput(
	output: ClarificationModelOutput
): ClarificationDraftOutput {
	if ((output.inputMode ?? null) !== null) {
		throw new Error(
			"Clarification model returned inputMode for a draft response."
		);
	}
	if ((output.questionScope ?? null) !== null) {
		throw new Error(
			"Clarification model returned questionScope for a draft response."
		);
	}
	if ((output.groundingSource ?? null) !== null) {
		throw new Error(
			"Clarification model returned groundingSource for a draft response."
		);
	}
	if ((output.groundingSnippet ?? null) !== null) {
		throw new Error(
			"Clarification model returned groundingSnippet for a draft response."
		);
	}
	if ((output.question ?? null) !== null) {
		throw new Error(
			"Clarification model returned a question for a draft response."
		);
	}
	if ((output.suggestedAnswers ?? null) !== null) {
		throw new Error(
			"Clarification model returned suggested answers for a draft response."
		);
	}

	const draftFaqPayload = output.draftFaqPayload ?? null;
	if (draftFaqPayload === null) {
		throw new Error(
			"Clarification model returned no draft payload for a draft response."
		);
	}

	const parsed = clarificationDraftOutputSchema.safeParse({
		kind: "draft_ready",
		continueClarifying: output.continueClarifying,
		topicSummary: output.topicSummary,
		missingFact: output.missingFact,
		whyItMatters: output.whyItMatters,
		draftFaqPayload,
	});

	if (!parsed.success) {
		throw new Error("Clarification model returned an invalid draft response.");
	}

	return parsed.data;
}

function getAiQuestionCount(turns: KnowledgeClarificationTurnSelect[]): number {
	return turns.filter((turn) => turn.role === "ai_question").length;
}

function isBroadDiscoveryQuestion(params: {
	request: Pick<
		KnowledgeClarificationRequestSelect,
		"source" | "targetKnowledgeId"
	>;
	questionOrdinal: number;
}): boolean {
	return (
		params.request.source === "conversation" &&
		!params.request.targetKnowledgeId &&
		params.questionOrdinal === 1
	);
}

function resolveExpectedQuestionStrategy(params: {
	request: Pick<
		KnowledgeClarificationRequestSelect,
		"source" | "targetKnowledgeId"
	>;
	turns: KnowledgeClarificationTurnSelect[];
}): ClarificationQuestionStrategy {
	const nextQuestionOrdinal = getAiQuestionCount(params.turns) + 1;
	if (
		isBroadDiscoveryQuestion({
			request: params.request,
			questionOrdinal: nextQuestionOrdinal,
		})
	) {
		return {
			inputMode: "textarea_first",
			questionScope: "broad_discovery",
		};
	}

	return {
		inputMode: "suggested_answers",
		questionScope: "narrow_detail",
	};
}

function resolveStoredQuestionStrategy(params: {
	request: Pick<
		KnowledgeClarificationRequestSelect,
		"source" | "targetKnowledgeId"
	>;
	turns: KnowledgeClarificationTurnSelect[];
	questionTurnId: string;
}): ClarificationQuestionStrategy {
	let questionOrdinal = 0;

	for (const turn of params.turns) {
		if (turn.role !== "ai_question") {
			continue;
		}

		questionOrdinal += 1;

		if (turn.id === params.questionTurnId) {
			break;
		}
	}

	if (
		isBroadDiscoveryQuestion({
			request: params.request,
			questionOrdinal,
		})
	) {
		return {
			inputMode: "textarea_first",
			questionScope: "broad_discovery",
		};
	}

	return {
		inputMode: "suggested_answers",
		questionScope: "narrow_detail",
	};
}

function formatPromptList(
	title: string,
	items: string[],
	emptyMessage: string
): string {
	return `${title}:\n${
		items.length > 0
			? items.map((item) => `- ${item}`).join("\n")
			: `- ${emptyMessage}`
	}`;
}

function mergeProviderUsage(
	...usages: Array<
		| {
				inputTokens?: number;
				outputTokens?: number;
				totalTokens?: number;
		  }
		| undefined
	>
):
	| {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
	  }
	| undefined {
	const merged: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	} = {};

	for (const usage of usages) {
		if (!usage) {
			continue;
		}

		merged.inputTokens = (merged.inputTokens ?? 0) + (usage.inputTokens ?? 0);
		merged.outputTokens =
			(merged.outputTokens ?? 0) + (usage.outputTokens ?? 0);
		merged.totalTokens = (merged.totalTokens ?? 0) + (usage.totalTokens ?? 0);
	}

	return merged.inputTokens || merged.outputTokens || merged.totalTokens
		? merged
		: undefined;
}

async function resolveConversationForAudit(
	db: Database,
	request: KnowledgeClarificationRequestSelect,
	conversation?: ConversationSelect | null
): Promise<ConversationSelect | null> {
	if (conversation) {
		return conversation;
	}

	if (!request.conversationId) {
		return null;
	}

	return (
		(await getConversationById(db, {
			conversationId: request.conversationId,
		})) ?? null
	);
}

export async function createKnowledgeClarificationAuditEntry(params: {
	db: Database;
	request: KnowledgeClarificationRequestSelect;
	text: string;
	actor: KnowledgeClarificationActor;
	conversation?: ConversationSelect | null;
}): Promise<void> {
	const conversation = await resolveConversationForAudit(
		params.db,
		params.request,
		params.conversation
	);
	if (!conversation) {
		return;
	}

	await createTimelineItem({
		db: params.db,
		organizationId: params.request.organizationId,
		websiteId: params.request.websiteId,
		conversationId: conversation.id,
		conversationOwnerVisitorId: conversation.visitorId,
		item: {
			type: ConversationTimelineType.EVENT,
			visibility: TimelineItemVisibility.PRIVATE,
			text: params.text,
			parts: [{ type: "text", text: params.text }],
			userId: params.actor.userId ?? null,
			aiAgentId: params.actor.aiAgentId ?? null,
		},
	});
}

export async function emitConversationClarificationUpdate(params: {
	db: Database;
	conversation: ConversationSelect | null;
	request:
		| Pick<
				KnowledgeClarificationRequest,
				| "id"
				| "conversationId"
				| "status"
				| "topicSummary"
				| "stepIndex"
				| "maxSteps"
				| "updatedAt"
		  >
		| KnowledgeClarificationRequestSelect
		| null;
	aiAgentId: string | null;
	turns?: KnowledgeClarificationTurnSelect[];
}): Promise<void> {
	if (!params.conversation) {
		return;
	}

	let turns = params.turns ?? [];
	if (params.request && !params.turns) {
		turns = await listKnowledgeClarificationTurns(params.db, {
			requestId: params.request.id,
		});
	}

	await realtime.emit("conversationUpdated", {
		websiteId: params.conversation.websiteId,
		organizationId: params.conversation.organizationId,
		visitorId: params.conversation.visitorId,
		userId: null,
		conversationId: params.conversation.id,
		updates: {
			activeClarification: params.request
				? buildConversationClarificationSummary({
						request: params.request,
						turns,
					})
				: null,
		},
		aiAgentId: params.aiAgentId,
	});
}

export function serializeKnowledgeClarificationRequest(params: {
	request: KnowledgeClarificationRequestSelect;
	turns: KnowledgeClarificationTurnSelect[];
}): KnowledgeClarificationRequest {
	const currentQuestionTurn =
		params.request.status === "deferred"
			? getPendingClarificationQuestionTurn(params.turns)
			: getDisplayClarificationQuestionTurn({
					status: params.request.status,
					turns: params.turns,
				});
	const currentQuestionStrategy = currentQuestionTurn
		? resolveStoredQuestionStrategy({
				request: params.request,
				turns: params.turns,
				questionTurnId: currentQuestionTurn.id,
			})
		: null;

	return {
		id: params.request.id,
		organizationId: params.request.organizationId,
		websiteId: params.request.websiteId,
		aiAgentId: params.request.aiAgentId,
		conversationId: params.request.conversationId,
		source: params.request.source,
		status: params.request.status,
		topicSummary: params.request.topicSummary,
		stepIndex: params.request.stepIndex,
		maxSteps: params.request.maxSteps,
		targetKnowledgeId: params.request.targetKnowledgeId,
		currentQuestion: currentQuestionTurn?.question ?? null,
		currentSuggestedAnswers:
			(currentQuestionTurn?.suggestedAnswers as
				| [string, string, string]
				| null
				| undefined) ?? null,
		currentQuestionInputMode: currentQuestionStrategy?.inputMode ?? null,
		currentQuestionScope: currentQuestionStrategy?.questionScope ?? null,
		draftFaqPayload:
			(params.request
				.draftFaqPayload as KnowledgeClarificationDraftFaq | null) ?? null,
		lastError: params.request.lastError,
		createdAt: params.request.createdAt,
		updatedAt: params.request.updatedAt,
	};
}

export function toKnowledgeClarificationStep(params: {
	request: KnowledgeClarificationRequestSelect;
	turns: KnowledgeClarificationTurnSelect[];
}): KnowledgeClarificationStepResponse | null {
	const serializedRequest = serializeKnowledgeClarificationRequest(params);

	if (serializedRequest.status === "retry_required") {
		return {
			kind: "retry_required",
			request: serializedRequest,
		};
	}

	if (serializedRequest.draftFaqPayload) {
		return {
			kind: "draft_ready",
			request: serializedRequest,
			draftFaqPayload: serializedRequest.draftFaqPayload,
		};
	}

	if (
		serializedRequest.currentQuestion &&
		serializedRequest.currentSuggestedAnswers &&
		serializedRequest.currentQuestionInputMode &&
		serializedRequest.currentQuestionScope
	) {
		return {
			kind: "question",
			request: serializedRequest,
			question: serializedRequest.currentQuestion,
			suggestedAnswers: serializedRequest.currentSuggestedAnswers,
			inputMode: serializedRequest.currentQuestionInputMode,
			questionScope: serializedRequest.currentQuestionScope,
		};
	}

	return null;
}

async function buildResolvedContextSnapshot(params: {
	db: Database;
	request: KnowledgeClarificationRequestSelect;
	conversation?: ConversationSelect | null;
	targetKnowledge?: KnowledgeSelect | null;
}): Promise<KnowledgeClarificationContextSnapshot | null> {
	if (params.request.contextSnapshot) {
		return params.request.contextSnapshot;
	}

	const linkedFaq = extractLinkedFaqSnapshot(params.targetKnowledge ?? null);
	if (params.conversation) {
		const conversationHistory = await buildConversationTranscript(params.db, {
			conversationId: params.conversation.id,
			organizationId: params.request.organizationId,
			websiteId: params.request.websiteId,
		});

		return buildConversationClarificationContextSnapshot({
			conversationHistory,
			linkedFaq,
		});
	}

	if (linkedFaq) {
		return buildFaqClarificationContextSnapshot({
			topicSummary: params.request.topicSummary,
			linkedFaq,
		});
	}

	return null;
}

async function callClarificationModel(params: {
	request: KnowledgeClarificationRequestSelect;
	aiAgent: AiAgentSelect;
	modelId: string;
	contextSnapshot: KnowledgeClarificationContextSnapshot | null;
	turns: KnowledgeClarificationTurnSelect[];
	expectedQuestionStrategy: ClarificationQuestionStrategy;
	forceDraft: boolean;
	forceDraftReason?: string | null;
}): Promise<{
	output: ClarificationModelOutput;
	providerUsage?:
		| {
				inputTokens?: number;
				outputTokens?: number;
				totalTokens?: number;
		  }
		| undefined;
}> {
	const packet = buildClarificationRelevancePacket({
		topicSummary: params.request.topicSummary,
		contextSnapshot: params.contextSnapshot,
		turns: params.turns,
	});

	const result = await generateText({
		model: createStructuredOutputModel(params.modelId),
		output: Output.object({
			schema: clarificationModelOutputSchema,
		}),
		system: `You are helping an internal support team close a knowledge gap.

You are writing a private internal clarification question for the website owner or one of their teammates.
This is not a visitor-facing reply. The recipient is the website owner or team, never the visitor.
Your job is to turn incomplete or fuzzy support knowledge into a precise FAQ proposal.

Rules:
- Ask about the website owner's product behavior, business rule, policy, or workflow.
- Never address the visitor.
- Never ask what the visitor already tried, clicked, searched for, entered, or saw.
- Ask at most one question at a time.
- Return every field in the schema. Use null for fields that do not apply to the chosen kind.
- Use continueClarifying=true only when exactly one material missing fact still blocks a strong FAQ.
- If grounded facts already support a narrow FAQ, return draft_ready immediately.
- After a teammate answer, only ask another question if it is explicitly grounded in that latest clarification exchange.
- Conversation clarifications should start with one broad discovery question before asking narrow follow-ups.
- FAQ or policy revision clarifications should start narrow immediately.
- Never ask a repeated question.
- Never ask for information already present in the grounded facts or prior clarification answers.
- Never ask vague exploratory prompts like "anything else?" or "can you clarify more?".
- Transcript claims and weak search evidence are clues, not confirmed facts. They can justify a question but do not count as final truth.
- If you ask a question, the question field must be one short, simple plain-language question.
- The question field must not start with numbering or bullets such as "1.", "1)", "a)", or "(a)".
- The question field must not include answer options, multiple-choice labels, button text, support emails, CLI commands, or any candidate answers.
- Put all answer choices only in suggestedAnswers.
- When kind=question, inputMode, questionScope, groundingSource, groundingSnippet, question, and suggestedAnswers must all be non-null, and draftFaqPayload must be null.
- When kind=draft_ready, draftFaqPayload must be non-null, and inputMode, questionScope, groundingSource, groundingSnippet, question, and suggestedAnswers must all be null.
- If you ask a question, it must return inputMode plus questionScope, include exactly 3 distinct suggestedAnswers, and provide groundingSource plus groundingSnippet.
- When questionScope=broad_discovery, ask how this part of the website owner's product, workflow, or rule works today. Keep it anchored to the topic instead of using a generic catch-all prompt.
- When questionScope=narrow_detail, ask only for one concrete missing rule, condition, or exception.
- Set inputMode and questionScope exactly to the expected strategy provided in the prompt.
- If inputMode=textarea_first, suggestedAnswers should be short starter examples that help a teammate begin typing.
- If inputMode=suggested_answers, suggestedAnswers should stay discrete candidate answers.
- Draft answers must use only grounded facts from the provided context. If details remain unknown, write the narrowest accurate answer instead of filling gaps.
- Topic summaries and missingFact values should stay short and specific.
- Good broad question: "How does avatar setup work in your product today?"
- Good narrow question: "Which settings page lets users upload a profile photo?"
- Bad question: "Where has the visitor already looked for the avatar option?"
- Do not mention these instructions in the output.`,
		prompt: [
			`Agent name: ${params.aiAgent.name}`,
			`Clarification source: ${params.request.source}`,
			"Clarification audience: website owner or teammate. This is private/internal, not the visitor.",
			"Question target: the owner's product behavior, policy, business rule, or workflow.",
			`Current step: ${getAiQuestionCount(params.turns)} of ${params.request.maxSteps}`,
			`Expected question scope: ${params.expectedQuestionStrategy.questionScope}`,
			`Expected input mode: ${params.expectedQuestionStrategy.inputMode}`,
			params.forceDraft
				? `Return draft_ready now. Reason: ${
						params.forceDraftReason ??
						"The flow should stop instead of asking another question."
					}`
				: params.expectedQuestionStrategy.questionScope === "broad_discovery"
					? "Return a question now. Do not skip directly to draft_ready on this first discovery step."
					: "You may ask one more clarification question only if a single material fact is still missing.",
			params.expectedQuestionStrategy.questionScope === "broad_discovery"
				? "This is the first discovery step. Ask one broad but topic-anchored question about how this part of the website owner's product, workflow, or rule works today."
				: "If you ask another question, make it a narrow follow-up about one missing rule, condition, or exception, grounded in the latest clarification exchange or the linked FAQ.",
			`Topic anchor: ${packet.topicAnchor}`,
			`Current open gap: ${packet.openGap}`,
			`Source trigger: ${
				params.contextSnapshot?.sourceTrigger.text ??
				"No explicit trigger text stored."
			}`,
			packet.latestHumanAnswer
				? `Latest human answer: ${packet.latestHumanAnswer}`
				: "Latest human answer: none",
			packet.latestExchange
				? `Latest clarification exchange:\n- Q: ${packet.latestExchange.question}\n- A: ${packet.latestExchange.answer}`
				: "Latest clarification exchange:\n- none",
			packet.linkedFaqSummary
				? `Linked FAQ snapshot:\n${packet.linkedFaqSummary}`
				: "Linked FAQ snapshot:\n- none",
			formatPromptList(
				"Transcript claims",
				packet.transcriptClaims,
				"No relevant transcript claims stored."
			),
			formatPromptList(
				"Search evidence",
				packet.searchEvidence,
				"No KB search evidence stored."
			),
			formatPromptList(
				"Grounded facts",
				packet.groundedFacts,
				"No grounded facts were extracted yet."
			),
			formatPromptList(
				"Answered clarification questions",
				packet.answeredQuestions.map(
					(entry) => `Q: ${entry.question} | A: ${entry.answer}`
				),
				"No prior clarification answers."
			),
			formatPromptList(
				"Disallowed questions",
				packet.disallowedQuestions,
				"No explicit disallowed questions."
			),
			"When returning draft_ready, continueClarifying should normally be false.",
		].join("\n\n"),
		temperature: params.aiAgent.temperature ?? 0.4,
		maxOutputTokens: Math.min(params.aiAgent.maxOutputTokens ?? 1200, 1200),
	});

	if (!result.output) {
		throw new NoOutputGeneratedError();
	}

	return {
		output: result.output,
		providerUsage: result.usage,
	};
}

function formatClarificationRetryErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.trim()) {
		return error.message.trim();
	}

	return "Clarification generation failed.";
}

function isLikelyProviderOrTransportError(error: Error): boolean {
	const message = error.message.toLowerCase();

	return [
		"provider",
		"transport",
		"network",
		"fetch",
		"connection",
		"gateway",
		"rate limit",
		"timeout",
		"timed out",
		"empty response",
		"no output generated",
		"service unavailable",
	].some((needle) => message.includes(needle));
}

function isRetryableClarificationGenerationError(error: unknown): boolean {
	return (
		NoOutputGeneratedError.isInstance(error) ||
		NoObjectGeneratedError.isInstance(error) ||
		APICallError.isInstance(error) ||
		EmptyResponseBodyError.isInstance(error) ||
		NoContentGeneratedError.isInstance(error) ||
		NoSuchModelError.isInstance(error) ||
		(error instanceof Error && isLikelyProviderOrTransportError(error))
	);
}

function logClarificationModelAttemptFailure(params: {
	requestId: string;
	modelId: string;
	attempt: number;
	error: unknown;
}) {
	const errorName =
		params.error instanceof Error
			? params.error.name
			: typeof params.error === "object" && params.error !== null
				? (params.error.constructor?.name ?? "UnknownError")
				: typeof params.error;
	const errorMessage = formatClarificationRetryErrorMessage(params.error);

	console.warn("[KnowledgeClarification] Model attempt failed", {
		requestId: params.requestId,
		modelId: params.modelId,
		attempt: params.attempt,
		errorClass: errorName,
		message: errorMessage,
	});
}

function buildClarificationFallbackModelSequence(
	aiAgentModelId: string
): string[] {
	const primaryResolution =
		resolveClarificationModelForExecution(aiAgentModelId);

	return [
		primaryResolution.modelIdResolved,
		...CLARIFICATION_FALLBACK_MODEL_IDS,
	].filter((modelId, index, values) => values.indexOf(modelId) === index);
}

async function callClarificationModelWithFallback(params: {
	request: KnowledgeClarificationRequestSelect;
	aiAgent: AiAgentSelect;
	contextSnapshot: KnowledgeClarificationContextSnapshot | null;
	turns: KnowledgeClarificationTurnSelect[];
	expectedQuestionStrategy: ClarificationQuestionStrategy;
	forceDraft: boolean;
	forceDraftReason?: string | null;
}): Promise<
	| {
			kind: "success";
			modelId: string;
			output: ClarificationModelOutput;
			providerUsage?:
				| {
						inputTokens?: number;
						outputTokens?: number;
						totalTokens?: number;
				  }
				| undefined;
	  }
	| ClarificationRetryRequiredResult
> {
	const candidateModelIds = buildClarificationFallbackModelSequence(
		params.aiAgent.model
	);
	let lastRetryableError: unknown = null;

	for (const [index, modelId] of candidateModelIds.entries()) {
		try {
			const result = await callClarificationModel({
				request: params.request,
				aiAgent: params.aiAgent,
				modelId,
				contextSnapshot: params.contextSnapshot,
				turns: params.turns,
				expectedQuestionStrategy: params.expectedQuestionStrategy,
				forceDraft: params.forceDraft,
				forceDraftReason: params.forceDraftReason,
			});

			return {
				kind: "success",
				modelId,
				output: result.output,
				providerUsage: result.providerUsage,
			};
		} catch (error) {
			if (!isRetryableClarificationGenerationError(error)) {
				throw error;
			}

			lastRetryableError = error;
			logClarificationModelAttemptFailure({
				requestId: params.request.id,
				modelId,
				attempt: index + 1,
				error,
			});
		}
	}

	return {
		kind: "retry_required",
		lastError: formatClarificationRetryErrorMessage(lastRetryableError),
	};
}

async function generateClarificationOutput(params: {
	db: Database;
	request: KnowledgeClarificationRequestSelect;
	aiAgent: AiAgentSelect;
	conversation?: ConversationSelect | null;
	targetKnowledge?: KnowledgeSelect | null;
	turns: KnowledgeClarificationTurnSelect[];
}): Promise<ClarificationGenerationResult | ClarificationRetryRequiredResult> {
	const aiQuestionCount = getAiQuestionCount(params.turns);
	const forceDraft = aiQuestionCount >= params.request.maxSteps;
	const expectedQuestionStrategy = resolveExpectedQuestionStrategy({
		request: params.request,
		turns: params.turns,
	});
	const contextSnapshot = await buildResolvedContextSnapshot({
		db: params.db,
		request: params.request,
		conversation: params.conversation ?? null,
		targetKnowledge: params.targetKnowledge ?? null,
	});

	const firstPass = await callClarificationModelWithFallback({
		request: params.request,
		aiAgent: params.aiAgent,
		contextSnapshot,
		turns: params.turns,
		expectedQuestionStrategy,
		forceDraft,
	});
	if (firstPass.kind === "retry_required") {
		return firstPass;
	}

	const firstPassOutput = firstPass.output;
	let output: ClarificationQuestionOutput | ClarificationDraftOutput;
	let providerUsage = firstPass.providerUsage;
	let successfulModelId = firstPass.modelId;

	if (forceDraft && firstPassOutput.kind !== "draft_ready") {
		throw new Error(
			"Clarification model returned a question after the draft-only limit."
		);
	}

	if (firstPassOutput.kind === "question") {
		let sanitizedQuestionOutput: ClarificationQuestionOutput | null = null;
		let fallbackDraftReason: string | null = null;

		try {
			const normalizedQuestionOutput =
				normalizeClarificationQuestionOutput(firstPassOutput);
			const candidateQuestionOutput: ClarificationQuestionOutput = {
				...normalizedQuestionOutput,
				question: sanitizeClarificationQuestion(
					normalizedQuestionOutput.question
				),
			};
			const packet = buildClarificationRelevancePacket({
				topicSummary: params.request.topicSummary,
				contextSnapshot,
				turns: params.turns,
			});
			const validation = validateClarificationQuestionCandidate({
				question: candidateQuestionOutput.question,
				missingFact: candidateQuestionOutput.missingFact,
				whyItMatters: candidateQuestionOutput.whyItMatters,
				inputMode: candidateQuestionOutput.inputMode,
				questionScope: candidateQuestionOutput.questionScope,
				expectedInputMode: expectedQuestionStrategy.inputMode,
				expectedQuestionScope: expectedQuestionStrategy.questionScope,
				groundingSource: candidateQuestionOutput.groundingSource,
				groundingSnippet: candidateQuestionOutput.groundingSnippet,
				packet,
			});

			if (validation.valid) {
				sanitizedQuestionOutput = candidateQuestionOutput;
			} else {
				fallbackDraftReason = validation.reason;
			}
		} catch (error) {
			fallbackDraftReason =
				error instanceof Error
					? error.message
					: "Clarification question output could not be normalized.";
		}

		if (sanitizedQuestionOutput) {
			output = sanitizedQuestionOutput;
		} else {
			const fallbackDraft = await callClarificationModelWithFallback({
				request: {
					...params.request,
					topicSummary: buildSpecificClarificationTopicSummary({
						triggerText: contextSnapshot?.sourceTrigger.text,
						searchEvidence: contextSnapshot?.kbSearchEvidence,
						linkedFaq: contextSnapshot?.linkedFaq,
						fallback:
							firstPassOutput.missingFact || params.request.topicSummary,
					}),
				},
				aiAgent: params.aiAgent,
				contextSnapshot,
				turns: params.turns,
				expectedQuestionStrategy,
				forceDraft: true,
				forceDraftReason:
					fallbackDraftReason ??
					"The clarification question could not be validated.",
			});
			if (fallbackDraft.kind === "retry_required") {
				return fallbackDraft;
			}

			output = normalizeClarificationDraftOutput(fallbackDraft.output);
			successfulModelId = fallbackDraft.modelId;
			providerUsage = mergeProviderUsage(
				firstPass.providerUsage,
				fallbackDraft.providerUsage
			);
		}
	} else {
		output = normalizeClarificationDraftOutput(firstPassOutput);
	}

	return {
		kind: "success",
		output,
		modelId: successfulModelId,
		modelIdOriginal: params.aiAgent.model,
		modelMigrationApplied: params.aiAgent.model !== successfulModelId,
		providerUsage,
	};
}

async function trackKnowledgeClarificationUsage(params: {
	db: Database;
	request: KnowledgeClarificationRequestSelect;
	conversation?: ConversationSelect | null;
	generation: ClarificationGenerationResult;
	phase: ClarificationUsagePhase;
	stepIndex: number;
}): Promise<void> {
	await trackGenerationUsage({
		db: params.db,
		organizationId: params.request.organizationId,
		websiteId: params.request.websiteId,
		conversationId: params.conversation?.id,
		visitorId: params.conversation?.visitorId,
		aiAgentId: params.request.aiAgentId,
		usageEventId: ulid(),
		triggerMessageId: params.request.id,
		modelId: params.generation.modelId,
		modelIdOriginal: params.generation.modelIdOriginal,
		modelMigrationApplied: params.generation.modelMigrationApplied,
		providerUsage: params.generation.providerUsage,
		source: "knowledge_clarification",
		phase: params.phase,
		knowledgeClarificationRequestId: params.request.id,
		knowledgeClarificationStepIndex: params.stepIndex,
	});
}

export async function runKnowledgeClarificationStep(
	params: RunKnowledgeClarificationStepParams
): Promise<KnowledgeClarificationStepResponse> {
	const turns = await listKnowledgeClarificationTurns(params.db, {
		requestId: params.request.id,
	});

	const generation = await generateClarificationOutput({
		db: params.db,
		request: params.request,
		aiAgent: params.aiAgent,
		conversation: params.conversation ?? null,
		targetKnowledge: params.targetKnowledge ?? null,
		turns,
	});

	if (generation.kind === "retry_required") {
		const updatedRequest = await updateKnowledgeClarificationRequest(
			params.db,
			{
				requestId: params.request.id,
				updates: {
					status: "retry_required",
					lastError: generation.lastError,
				},
			}
		);
		if (!updatedRequest) {
			throw new Error("Failed to update clarification request.");
		}
		const step = toKnowledgeClarificationStep({
			request: updatedRequest,
			turns,
		});
		if (!step || step.kind !== "retry_required") {
			throw new Error("Clarification retry step could not be created.");
		}
		return step;
	}

	const output = generation.output;

	if (output.kind === "question") {
		const nextStepIndex = getAiQuestionCount(turns) + 1;
		await trackKnowledgeClarificationUsage({
			db: params.db,
			request: params.request,
			conversation: params.conversation ?? null,
			generation,
			phase: "clarification_question",
			stepIndex: nextStepIndex,
		});
		await createKnowledgeClarificationTurn(params.db, {
			requestId: params.request.id,
			role: "ai_question",
			question: output.question.trim(),
			suggestedAnswers: output.suggestedAnswers,
		});

		const updatedRequest = await updateKnowledgeClarificationRequest(
			params.db,
			{
				requestId: params.request.id,
				updates: {
					status: "awaiting_answer",
					stepIndex: nextStepIndex,
					topicSummary: output.topicSummary.trim(),
					draftFaqPayload: null,
					lastError: null,
				},
			}
		);

		if (!updatedRequest) {
			throw new Error("Failed to update clarification request.");
		}

		const updatedTurns = await listKnowledgeClarificationTurns(params.db, {
			requestId: params.request.id,
		});
		const step = toKnowledgeClarificationStep({
			request: updatedRequest,
			turns: updatedTurns,
		});
		if (!step) {
			throw new Error("Clarification question step could not be created.");
		}
		return step;
	}

	const normalizedDraft = normalizeDraftFaq(output.draftFaqPayload);
	await trackKnowledgeClarificationUsage({
		db: params.db,
		request: params.request,
		conversation: params.conversation ?? null,
		generation,
		phase: "faq_draft_generation",
		stepIndex: params.request.stepIndex,
	});
	const updatedRequest = await updateKnowledgeClarificationRequest(params.db, {
		requestId: params.request.id,
		updates: {
			status: "draft_ready",
			topicSummary: output.topicSummary.trim(),
			draftFaqPayload: normalizedDraft,
			lastError: null,
		},
	});

	if (!updatedRequest) {
		throw new Error("Failed to store clarification draft.");
	}

	const step = toKnowledgeClarificationStep({
		request: updatedRequest,
		turns,
	});
	if (!step) {
		throw new Error("Clarification draft step could not be created.");
	}
	return step;
}

async function resolveConversationClarificationDuplicate(params: {
	db: Database;
	conversationId: string;
	websiteId: string;
	sourceTriggerMessageId: string | null;
	topicFingerprint: string | null;
}): Promise<{
	request: KnowledgeClarificationRequestSelect;
	resolution: ConversationClarificationStartResolution;
} | null> {
	if (params.sourceTriggerMessageId) {
		const request =
			await getLatestKnowledgeClarificationForConversationBySourceTriggerMessageId(
				params.db,
				{
					conversationId: params.conversationId,
					websiteId: params.websiteId,
					sourceTriggerMessageId: params.sourceTriggerMessageId,
				}
			);
		if (request) {
			return {
				request,
				resolution: isTerminalClarificationStatus(request.status)
					? "suppressed_duplicate"
					: "reused",
			};
		}
	}

	if (params.topicFingerprint) {
		const request =
			await getLatestKnowledgeClarificationForConversationByTopicFingerprint(
				params.db,
				{
					conversationId: params.conversationId,
					websiteId: params.websiteId,
					topicFingerprint: params.topicFingerprint,
					statuses: REUSABLE_CONVERSATION_TOPIC_FINGERPRINT_STATUSES,
				}
			);
		if (request) {
			return {
				request,
				resolution: "reused",
			};
		}
	}

	return null;
}

async function getConversationClarificationSeedStep(params: {
	db: Database;
	request: KnowledgeClarificationRequestSelect;
	aiAgent: AiAgentSelect;
	conversation: ConversationSelect;
}): Promise<KnowledgeClarificationStepResponse> {
	const turns = await listKnowledgeClarificationTurns(params.db, {
		requestId: params.request.id,
	});
	const existingStep = toKnowledgeClarificationStep({
		request: params.request,
		turns,
	});
	if (existingStep) {
		return existingStep;
	}

	await updateKnowledgeClarificationRequest(params.db, {
		requestId: params.request.id,
		updates: {
			status: "analyzing",
			lastError: null,
		},
	});

	return runKnowledgeClarificationStep({
		db: params.db,
		request: {
			...params.request,
			status: "analyzing",
			lastError: null,
		},
		aiAgent: params.aiAgent,
		conversation: params.conversation,
	});
}

export async function startConversationKnowledgeClarification(
	params: StartConversationKnowledgeClarificationParams
): Promise<ConversationClarificationStartResult> {
	const contextSnapshot =
		params.contextSnapshot ??
		buildConversationClarificationContextSnapshot({
			conversationHistory: await buildConversationTranscript(params.db, {
				conversationId: params.conversation.id,
				organizationId: params.organizationId,
				websiteId: params.websiteId,
			}),
		});
	const topicSummary = buildSpecificClarificationTopicSummary({
		triggerText: contextSnapshot.sourceTrigger.text,
		searchEvidence: contextSnapshot.kbSearchEvidence,
		linkedFaq: contextSnapshot.linkedFaq,
		fallback: params.topicSummary,
	});
	const sourceTriggerMessageId =
		params.creationMode === "automation"
			? getClarificationSourceTriggerMessageId(contextSnapshot)
			: null;
	const topicFingerprint = buildClarificationTopicFingerprint(topicSummary);
	const duplicate = await resolveConversationClarificationDuplicate({
		db: params.db,
		conversationId: params.conversation.id,
		websiteId: params.websiteId,
		sourceTriggerMessageId,
		topicFingerprint,
	});

	if (duplicate) {
		if (duplicate.resolution === "suppressed_duplicate") {
			const turns = await listKnowledgeClarificationTurns(params.db, {
				requestId: duplicate.request.id,
			});
			return {
				request: serializeKnowledgeClarificationRequest({
					request: duplicate.request,
					turns,
				}),
				step: null,
				created: false,
				resolution: "suppressed_duplicate",
			};
		}

		const step = await getConversationClarificationSeedStep({
			db: params.db,
			request: duplicate.request,
			aiAgent: params.aiAgent,
			conversation: params.conversation,
		});
		return {
			request: step.request,
			step,
			created: false,
			resolution: "reused",
		};
	}

	const existing = await getActiveKnowledgeClarificationForConversation(
		params.db,
		{
			conversationId: params.conversation.id,
			websiteId: params.websiteId,
		}
	);

	if (existing) {
		const step = await getConversationClarificationSeedStep({
			db: params.db,
			request: existing,
			aiAgent: params.aiAgent,
			conversation: params.conversation,
		});
		return {
			request: step.request,
			step,
			created: false,
			resolution: "reused",
		};
	}

	let request: KnowledgeClarificationRequestSelect;
	try {
		request = await createKnowledgeClarificationRequest(params.db, {
			organizationId: params.organizationId,
			websiteId: params.websiteId,
			aiAgentId: params.aiAgent.id,
			conversationId: params.conversation.id,
			source: "conversation",
			status: "analyzing",
			topicSummary,
			sourceTriggerMessageId,
			topicFingerprint,
			contextSnapshot,
			maxSteps: params.maxSteps ?? DEFAULT_MAX_CLARIFICATION_STEPS,
		});
	} catch (error) {
		if (
			!(
				isUniqueViolationError(
					error,
					"knowledge_clarification_request_conv_trigger_unique"
				) ||
				isUniqueViolationError(
					error,
					"knowledge_clarification_request_conv_topic_fingerprint_unique"
				)
			)
		) {
			throw error;
		}

		const winner = await resolveConversationClarificationDuplicate({
			db: params.db,
			conversationId: params.conversation.id,
			websiteId: params.websiteId,
			sourceTriggerMessageId,
			topicFingerprint,
		});
		if (!winner) {
			throw error;
		}

		if (winner.resolution === "suppressed_duplicate") {
			const turns = await listKnowledgeClarificationTurns(params.db, {
				requestId: winner.request.id,
			});
			return {
				request: serializeKnowledgeClarificationRequest({
					request: winner.request,
					turns,
				}),
				step: null,
				created: false,
				resolution: "suppressed_duplicate",
			};
		}

		const step = await getConversationClarificationSeedStep({
			db: params.db,
			request: winner.request,
			aiAgent: params.aiAgent,
			conversation: params.conversation,
		});
		return {
			request: step.request,
			step,
			created: false,
			resolution: "reused",
		};
	}

	await createKnowledgeClarificationAuditEntry({
		db: params.db,
		request,
		conversation: params.conversation,
		actor: params.actor,
		text: `Knowledge clarification started: ${request.topicSummary.trim()}`,
	});

	const step = await runKnowledgeClarificationStep({
		db: params.db,
		request,
		aiAgent: params.aiAgent,
		conversation: params.conversation,
	});

	return {
		request: step.request,
		step,
		created: true,
		resolution: "created",
	};
}

export async function startFaqKnowledgeClarification(
	params: StartFaqKnowledgeClarificationParams
): Promise<{
	request: KnowledgeClarificationRequest;
	step: KnowledgeClarificationStepResponse;
}> {
	const contextSnapshot =
		params.contextSnapshot ??
		buildFaqClarificationContextSnapshot({
			topicSummary: params.topicSummary,
			linkedFaq: extractLinkedFaqSnapshot(params.targetKnowledge),
		});
	const topicSummary = buildSpecificClarificationTopicSummary({
		triggerText: contextSnapshot.sourceTrigger.text,
		searchEvidence: contextSnapshot.kbSearchEvidence,
		linkedFaq: contextSnapshot.linkedFaq,
		fallback: params.topicSummary,
	});
	const request = await createKnowledgeClarificationRequest(params.db, {
		organizationId: params.organizationId,
		websiteId: params.websiteId,
		aiAgentId: params.aiAgent.id,
		source: "faq",
		status: "analyzing",
		topicSummary,
		contextSnapshot,
		maxSteps: params.maxSteps ?? DEFAULT_MAX_CLARIFICATION_STEPS,
		targetKnowledgeId: params.targetKnowledge.id,
	});

	const step = await runKnowledgeClarificationStep({
		db: params.db,
		request,
		aiAgent: params.aiAgent,
		targetKnowledge: params.targetKnowledge,
	});

	return {
		request: step.request,
		step,
	};
}

export async function loadKnowledgeClarificationRuntime(params: {
	db: Database;
	organizationId: string;
	websiteId: string;
	request: KnowledgeClarificationRequestSelect;
}): Promise<{
	aiAgent: AiAgentSelect;
	conversation: ConversationSelect | null;
	targetKnowledge: KnowledgeSelect | null;
}> {
	const [aiAgent, conversation, targetKnowledge] = await Promise.all([
		getAiAgentForWebsite(params.db, {
			websiteId: params.websiteId,
			organizationId: params.organizationId,
		}),
		params.request.conversationId
			? getConversationById(params.db, {
					conversationId: params.request.conversationId,
				})
			: Promise.resolve(null),
		params.request.targetKnowledgeId
			? getKnowledgeById(params.db, {
					id: params.request.targetKnowledgeId,
					websiteId: params.websiteId,
				})
			: Promise.resolve(null),
	]);

	if (!aiAgent) {
		throw new Error("AI agent not found for clarification request.");
	}

	return {
		aiAgent,
		conversation: conversation ?? null,
		targetKnowledge,
	};
}
