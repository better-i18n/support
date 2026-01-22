/**
 * Progress Events
 *
 * Emits progress events during AI agent generation.
 * These provide real-time updates about tool usage and generation phases.
 */

import type { ConversationSelect } from "@api/db/schema/conversation";
import { realtime } from "@api/realtime/emitter";

type ToolProgressParams = {
	conversation: ConversationSelect;
	aiAgentId: string;
	workflowRunId: string;
	toolCallId: string;
	toolName: string;
	state: "partial" | "result" | "error";
	/** Human-readable progress message (shown to widget) */
	progressMessage?: string | null;
};

/**
 * Emit tool progress event
 *
 * Called when a tool starts executing or completes.
 * Sent to both widget and dashboard with appropriate messaging.
 */
export async function emitToolProgress(
	params: ToolProgressParams
): Promise<void> {
	const {
		conversation,
		aiAgentId,
		workflowRunId,
		toolCallId,
		toolName,
		state,
		progressMessage,
	} = params;

	// Determine user-friendly message for widget
	let message = progressMessage ?? null;
	if (!message && state === "partial") {
		// Default progress messages for known tools
		message = getDefaultToolMessage(toolName);
	}

	await realtime.emit("aiAgentProcessingProgress", {
		websiteId: conversation.websiteId,
		organizationId: conversation.organizationId,
		visitorId: conversation.visitorId,
		userId: null,
		conversationId: conversation.id,
		aiAgentId,
		workflowRunId,
		phase: "tool",
		message,
		tool: {
			toolCallId,
			toolName,
			state,
		},
		audience: "all",
	});
}

/**
 * Get default user-friendly message for known tools
 */
function getDefaultToolMessage(toolName: string): string | null {
	const messages: Record<string, string> = {
		searchKnowledgeBase: "Searching knowledge base...",
		setConversationTitle: "Updating conversation...",
		updateSentiment: "Analyzing conversation...",
		setPriority: "Setting priority...",
	};

	return messages[toolName] ?? null;
}

type GenerationPhaseParams = {
	conversation: ConversationSelect;
	aiAgentId: string;
	workflowRunId: string;
	phase: "thinking" | "generating" | "finalizing";
	/** Human-readable message (optional) */
	message?: string | null;
};

/**
 * Emit generation phase progress
 *
 * Called during different phases of LLM generation.
 * Dashboard only - widget just sees typing indicator.
 */
export async function emitGenerationProgress(
	params: GenerationPhaseParams
): Promise<void> {
	const { conversation, aiAgentId, workflowRunId, phase, message } = params;

	await realtime.emit("aiAgentProcessingProgress", {
		websiteId: conversation.websiteId,
		organizationId: conversation.organizationId,
		visitorId: conversation.visitorId,
		userId: null,
		conversationId: conversation.id,
		aiAgentId,
		workflowRunId,
		phase,
		message: message ?? null,
		audience: "dashboard",
	});
}
