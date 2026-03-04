import type { Database } from "@api/db";
import { getAiAgentById } from "@api/db/queries/ai-agent";
import type { PrimaryPipelineInput } from "../../contracts";
import { loadConversationSeed, loadIntakeContext } from "./load-context";
import { resolveAndPersistModel } from "./model-resolution";
import type { IntakeStepResult } from "./types";

export async function runIntakeStep(params: {
	db: Database;
	input: PrimaryPipelineInput;
}): Promise<IntakeStepResult> {
	const aiAgent = await getAiAgentById(params.db, {
		aiAgentId: params.input.aiAgentId,
	});

	if (!aiAgent) {
		return {
			status: "skipped",
			reason: `AI agent ${params.input.aiAgentId} not found`,
		};
	}

	if (!aiAgent.isActive) {
		return {
			status: "skipped",
			reason: `AI agent ${params.input.aiAgentId} is not active`,
		};
	}

	const { aiAgent: resolvedAiAgent, modelResolution } =
		await resolveAndPersistModel({
			db: params.db,
			aiAgent,
			conversationId: params.input.conversationId,
		});

	const { conversation, triggerMetadata } = await loadConversationSeed(
		params.db,
		{
			conversationId: params.input.conversationId,
			messageId: params.input.messageId,
			organizationId: params.input.organizationId,
		}
	);

	if (!conversation) {
		return {
			status: "skipped",
			reason: `Conversation ${params.input.conversationId} not found`,
		};
	}

	if (!triggerMetadata) {
		return {
			status: "skipped",
			reason: `Trigger message ${params.input.messageId} not found`,
		};
	}

	if (triggerMetadata.conversationId !== params.input.conversationId) {
		return {
			status: "skipped",
			reason: `Trigger message ${params.input.messageId} does not belong to conversation ${params.input.conversationId}`,
		};
	}

	const context = await loadIntakeContext(params.db, {
		conversationId: params.input.conversationId,
		organizationId: params.input.organizationId,
		websiteId: params.input.websiteId,
		visitorId: params.input.visitorId,
		conversation,
		triggerMetadata,
	});

	console.log(
		`[ai-pipeline:intake] conv=${params.input.conversationId} | messages=${context.conversationHistory.length} | hasVisitor=${Boolean(context.visitorContext)} | trigger=${context.triggerMessage?.senderType ?? "unknown"} | modelOriginal=${modelResolution.modelIdOriginal} | modelResolved=${modelResolution.modelIdResolved} | migration=${modelResolution.modelMigrationApplied}`
	);

	return {
		status: "ready",
		data: {
			aiAgent: resolvedAiAgent,
			modelResolution,
			conversation,
			conversationHistory: context.conversationHistory,
			visitorContext: context.visitorContext,
			conversationState: context.conversationState,
			triggerMessage: context.triggerMessage,
		},
	};
}
