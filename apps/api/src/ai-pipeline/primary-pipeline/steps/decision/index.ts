import type { Database } from "@api/db";
import { logAiPipeline } from "../../../logger";
import { resolveDecisionPolicy } from "./decision-policy";
import { runDeterministicDecision } from "./deterministic";
import { runSmartDecision } from "./smart";
import type { DecisionResult, DecisionStepInput } from "./types";

function mapSmartDecisionToDecisionResult(params: {
	input: DecisionStepInput;
	cleanedTriggerText: string;
	smartDecision: Awaited<ReturnType<typeof runSmartDecision>>;
}): DecisionResult {
	const { input, smartDecision, cleanedTriggerText } = params;
	const triggerMessage = input.triggerMessage;

	if (smartDecision.intent === "observe") {
		return {
			shouldAct: false,
			reason: `Smart decision: ${smartDecision.reasoning}`,
			mode: "background_only",
			humanCommand: null,
			isEscalated: input.conversationState.isEscalated,
			escalationReason: input.conversationState.escalationReason,
			smartDecision,
		};
	}

	if (smartDecision.intent === "assist_team") {
		return {
			shouldAct: true,
			reason: `Smart decision: ${smartDecision.reasoning}`,
			mode: "background_only",
			humanCommand:
				triggerMessage?.senderType === "human_agent"
					? cleanedTriggerText
					: null,
			isEscalated: input.conversationState.isEscalated,
			escalationReason: input.conversationState.escalationReason,
			smartDecision,
		};
	}

	if (triggerMessage?.senderType === "human_agent") {
		return {
			shouldAct: true,
			reason: `Smart decision: ${smartDecision.reasoning}`,
			mode: "respond_to_command",
			humanCommand: cleanedTriggerText,
			isEscalated: input.conversationState.isEscalated,
			escalationReason: input.conversationState.escalationReason,
			smartDecision,
		};
	}

	return {
		shouldAct: true,
		reason: `Smart decision: ${smartDecision.reasoning}`,
		mode: "respond_to_visitor",
		humanCommand: null,
		isEscalated: input.conversationState.isEscalated,
		escalationReason: input.conversationState.escalationReason,
		smartDecision,
	};
}

export async function runDecisionStep(params: {
	db: Database;
	input: DecisionStepInput;
}): Promise<DecisionResult> {
	const deterministicDecision = runDeterministicDecision(params.input);

	if (deterministicDecision.type === "final") {
		return deterministicDecision.result;
	}

	if (!params.input.triggerMessage) {
		return {
			shouldAct: false,
			reason: "No trigger message",
			mode: "background_only",
			humanCommand: null,
			isEscalated: params.input.conversationState.isEscalated,
			escalationReason: params.input.conversationState.escalationReason,
		};
	}

	const decisionPolicyResolution = await resolveDecisionPolicy({
		db: params.db,
		aiAgent: params.input.aiAgent,
	});

	if (decisionPolicyResolution.fallback === "error") {
		logAiPipeline({
			area: "decision",
			event: "policy_resolve_failed",
			level: "warn",
			conversationId: params.input.conversation.id,
			fields: {
				policy: "decision.md",
				fallback: decisionPolicyResolution.fallback,
			},
			error: decisionPolicyResolution.error,
		});
	}

	const smartDecision = await runSmartDecision({
		aiAgent: params.input.aiAgent,
		conversation: params.input.conversation,
		conversationHistory: params.input.conversationHistory,
		conversationState: params.input.conversationState,
		triggerMessage: params.input.triggerMessage,
		decisionPolicy: decisionPolicyResolution.policy,
	});

	return mapSmartDecisionToDecisionResult({
		input: params.input,
		cleanedTriggerText: deterministicDecision.cleanedTriggerText,
		smartDecision,
	});
}

export type { SmartDecisionResult } from "./smart";
export type { DecisionResult, DecisionStepInput, ResponseMode } from "./types";
