import { resolvePromptBundle } from "@api/ai-agent/prompts/resolver";
import { PROMPT_TEMPLATES } from "@api/ai-agent/prompts/templates";
import type { Database } from "@api/db";
import type { AiAgentSelect } from "@api/db/schema/ai-agent";

export type DecisionPolicyResolution = {
	policy: string;
	fallback: "none" | "missing" | "error";
	error?: unknown;
};

const DEFAULT_DECISION_POLICY = PROMPT_TEMPLATES.DECISION_POLICY;

export async function resolveDecisionPolicy(params: {
	db: Database;
	aiAgent: AiAgentSelect;
}): Promise<DecisionPolicyResolution> {
	try {
		const promptBundle = await resolvePromptBundle({
			db: params.db,
			aiAgent: params.aiAgent,
			mode: "background_only",
		});

		const overriddenPolicy =
			promptBundle.coreDocuments["decision.md"]?.content?.trim() ?? "";

		if (!overriddenPolicy) {
			return {
				policy: DEFAULT_DECISION_POLICY,
				fallback: "missing",
			};
		}

		return {
			policy: overriddenPolicy,
			fallback: "none",
		};
	} catch (error) {
		return {
			policy: DEFAULT_DECISION_POLICY,
			fallback: "error",
			error,
		};
	}
}
