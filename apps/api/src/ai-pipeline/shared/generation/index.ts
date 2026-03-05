import { getBehaviorSettings } from "@api/ai-agent/settings";
import {
	createModel,
	hasToolCall,
	stepCountIs,
	ToolLoopAgent,
	type ToolSet,
} from "@api/lib/ai";
import { generateVisitorName } from "@cossistant/core";
import type { PrepareStepFunction } from "ai";
import { buildPipelineToolset } from "../tools";
import type { PipelineToolContext, ToolRuntimeState } from "../tools/contracts";
import type {
	CapturedFinalAction,
	GenerationRuntimeInput,
	GenerationRuntimeResult,
} from "./contracts";
import { formatHistoryForGeneration } from "./messages/format-history";
import { buildGenerationSystemPrompt } from "./prompt/builder";

const GENERATION_TIMEOUT_MS = 45_000;
const STOP_STEP_BUFFER = 6;

type ToolStepLike = {
	toolCalls?: Array<{ toolName?: string }>;
};

function countTotalToolCalls(toolCallsByName: Record<string, number>): number {
	return Object.values(toolCallsByName).reduce((sum, value) => {
		if (!Number.isFinite(value) || value <= 0) {
			return sum;
		}
		return sum + Math.floor(value);
	}, 0);
}

function countNonFinishToolCalls(params: {
	steps: readonly ToolStepLike[] | undefined;
	finishToolNames: Set<string>;
}): number {
	if (!(params.steps && params.steps.length > 0)) {
		return 0;
	}

	let total = 0;

	for (const step of params.steps) {
		for (const call of step.toolCalls ?? []) {
			const toolName = call?.toolName;
			if (!(toolName && typeof toolName === "string")) {
				continue;
			}
			if (params.finishToolNames.has(toolName)) {
				continue;
			}
			total += 1;
		}
	}

	return total;
}

function buildSafeSkipAction(reasoning: string): CapturedFinalAction {
	return {
		action: "skip",
		reasoning,
		confidence: 1,
	};
}

function toUsage(
	value:
		| {
				inputTokens?: number;
				outputTokens?: number;
				totalTokens?: number;
		  }
		| undefined
): GenerationRuntimeResult["usage"] {
	if (!value) {
		return;
	}

	const inputTokens =
		typeof value.inputTokens === "number" ? value.inputTokens : undefined;
	const outputTokens =
		typeof value.outputTokens === "number" ? value.outputTokens : undefined;
	const totalTokens =
		typeof value.totalTokens === "number" ? value.totalTokens : undefined;

	if (
		inputTokens === undefined &&
		outputTokens === undefined &&
		totalTokens === undefined
	) {
		return;
	}

	return {
		inputTokens,
		outputTokens,
		totalTokens,
	};
}

function createToolRuntimeState(): ToolRuntimeState {
	return {
		finalAction: null,
		publicMessagesSent: 0,
		toolCallCounts: {},
		publicSendSequence: 0,
		privateSendSequence: 0,
		sentPublicMessageIds: new Set<string>(),
		lastToolError: null,
	};
}

function buildToolContext(params: {
	input: GenerationRuntimeInput;
	runtimeState: ToolRuntimeState;
}): PipelineToolContext {
	const { input, runtimeState } = params;
	const visitorName =
		input.visitorContext?.name?.trim() ||
		generateVisitorName(input.conversation.visitorId);

	return {
		db: input.db,
		conversation: input.conversation,
		conversationId: input.conversation.id,
		organizationId: input.conversation.organizationId,
		websiteId: input.conversation.websiteId,
		visitorId: input.conversation.visitorId,
		aiAgentId: input.aiAgent.id,
		aiAgentName: input.aiAgent.name,
		visitorName,
		workflowRunId: input.workflowRunId,
		triggerMessageId: input.triggerMessageId,
		triggerMessageCreatedAt: input.triggerMessageCreatedAt,
		triggerSenderType: input.triggerSenderType,
		triggerVisibility: input.triggerVisibility,
		allowPublicMessages: input.allowPublicMessages,
		pipelineKind: input.pipelineKind,
		mode: input.mode,
		isEscalated: input.conversationState.isEscalated,
		startTyping: input.startTyping,
		stopTyping: input.stopTyping,
		runtimeState,
	};
}

export async function runGenerationRuntime(
	input: GenerationRuntimeInput
): Promise<GenerationRuntimeResult> {
	const runtimeState = createToolRuntimeState();
	const toolContext = buildToolContext({
		input,
		runtimeState,
	});

	const toolsetResolution = buildPipelineToolset({
		aiAgent: input.aiAgent,
		context: toolContext,
	});

	if (toolsetResolution.toolNames.length === 0) {
		return {
			status: "completed",
			action: buildSafeSkipAction("No tools available after policy gating"),
			publicMessagesSent: runtimeState.publicMessagesSent,
			toolCallsByName: runtimeState.toolCallCounts,
			totalToolCalls: 0,
		};
	}

	if (toolsetResolution.finishToolNames.length === 0) {
		return {
			status: "completed",
			action: buildSafeSkipAction("No finish tools available"),
			publicMessagesSent: runtimeState.publicMessagesSent,
			toolCallsByName: runtimeState.toolCallCounts,
			totalToolCalls: 0,
		};
	}

	const systemPrompt = buildGenerationSystemPrompt({
		input,
		toolset: toolsetResolution.tools,
		toolNames: toolsetResolution.toolNames,
	});
	const messages = formatHistoryForGeneration(
		input.conversationHistory,
		input.visitorContext?.name ?? null
	);

	const behaviorSettings = getBehaviorSettings(input.aiAgent);
	const nonFinishToolBudget = Math.max(
		1,
		Math.floor(behaviorSettings.maxToolInvocationsPerRun)
	);
	const finishToolNameSet = new Set<string>(toolsetResolution.finishToolNames);

	const prepareStep: PrepareStepFunction<ToolSet> = ({ steps }) => {
		const usedNonFinishCalls = countNonFinishToolCalls({
			steps: steps as readonly ToolStepLike[] | undefined,
			finishToolNames: finishToolNameSet,
		});

		if (usedNonFinishCalls >= nonFinishToolBudget) {
			return {
				system: systemPrompt,
				activeTools: toolsetResolution.finishToolNames,
			};
		}

		return {
			system: systemPrompt,
		};
	};

	const stopWhen = [
		...toolsetResolution.finishToolNames.map((toolName) =>
			hasToolCall(toolName)
		),
		(params: { steps: readonly ToolStepLike[] }) =>
			countNonFinishToolCalls({
				steps: params.steps,
				finishToolNames: finishToolNameSet,
			}) >= nonFinishToolBudget,
		stepCountIs(nonFinishToolBudget + STOP_STEP_BUFFER),
	];

	const generationAbortController = new AbortController();
	let abortReason: "timeout" | "signal" | null = null;

	const onExternalAbort = () => {
		abortReason = "signal";
		generationAbortController.abort();
	};

	if (input.abortSignal) {
		if (input.abortSignal.aborted) {
			abortReason = "signal";
			generationAbortController.abort();
		} else {
			input.abortSignal.addEventListener("abort", onExternalAbort);
		}
	}

	const timeout = setTimeout(() => {
		abortReason = "timeout";
		generationAbortController.abort();
	}, GENERATION_TIMEOUT_MS);

	try {
		const agent = new ToolLoopAgent({
			model: createModel(input.aiAgent.model),
			instructions: systemPrompt,
			tools: toolsetResolution.tools,
			prepareStep,
			toolChoice: "required",
			stopWhen,
			temperature: 0,
		});

		const result = await agent.generate({
			messages,
			abortSignal: generationAbortController.signal,
		});

		const toolCallsByName = { ...runtimeState.toolCallCounts };
		const totalToolCalls = countTotalToolCalls(toolCallsByName);
		const action =
			runtimeState.finalAction ??
			buildSafeSkipAction(
				"No finish action was captured; defaulting to safe skip"
			);

		if (runtimeState.lastToolError?.fatal) {
			return {
				status: "error",
				action,
				error: runtimeState.lastToolError.error,
				publicMessagesSent: runtimeState.publicMessagesSent,
				toolCallsByName,
				totalToolCalls,
				usage: toUsage(result.usage),
			};
		}

		return {
			status: "completed",
			action,
			publicMessagesSent: runtimeState.publicMessagesSent,
			toolCallsByName,
			totalToolCalls,
			usage: toUsage(result.usage),
		};
	} catch (error) {
		const toolCallsByName = { ...runtimeState.toolCallCounts };
		const totalToolCalls = countTotalToolCalls(toolCallsByName);

		if (
			generationAbortController.signal.aborted ||
			(error instanceof Error && error.name === "AbortError")
		) {
			const reason =
				abortReason === "signal"
					? "Generation aborted by cancellation signal; safe skip"
					: "Generation timed out; safe skip";
			return {
				status: "completed",
				action: buildSafeSkipAction(reason),
				aborted: true,
				publicMessagesSent: runtimeState.publicMessagesSent,
				toolCallsByName,
				totalToolCalls,
			};
		}

		const message =
			error instanceof Error ? error.message : "Generation runtime failed";

		return {
			status: "error",
			action: buildSafeSkipAction("Generation runtime error"),
			error: message,
			publicMessagesSent: runtimeState.publicMessagesSent,
			toolCallsByName,
			totalToolCalls,
		};
	} finally {
		clearTimeout(timeout);
		if (input.abortSignal) {
			input.abortSignal.removeEventListener("abort", onExternalAbort);
		}
	}
}

export type {
	CapturedFinalAction,
	GenerationMode,
	GenerationRuntimeInput,
	GenerationRuntimeResult,
	GenerationTokenUsage,
	PipelineKind,
} from "./contracts";
