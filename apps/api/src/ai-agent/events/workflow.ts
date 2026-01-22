/**
 * Workflow Events
 *
 * Emits workflow lifecycle events for the AI agent.
 * These events track the start, completion, and cancellation of AI workflows.
 */

import type { ConversationSelect } from "@api/db/schema/conversation";
import { realtime } from "@api/realtime/emitter";

type WorkflowStartedParams = {
	conversation: ConversationSelect;
	aiAgentId: string;
	workflowRunId: string;
	triggerMessageId: string;
};

/**
 * Emit workflow started event
 *
 * Called at the beginning of the AI agent pipeline.
 * Dashboard only - visitors don't see this.
 */
export async function emitWorkflowStarted(
	params: WorkflowStartedParams
): Promise<void> {
	const { conversation, aiAgentId, workflowRunId, triggerMessageId } = params;

	await realtime.emit("aiAgentProcessingStarted", {
		websiteId: conversation.websiteId,
		organizationId: conversation.organizationId,
		visitorId: conversation.visitorId,
		userId: null,
		conversationId: conversation.id,
		aiAgentId,
		workflowRunId,
		triggerMessageId,
		phase: "starting",
		audience: "dashboard",
	});
}

type WorkflowCompletedParams = {
	conversation: ConversationSelect;
	aiAgentId: string;
	workflowRunId: string;
	status: "success" | "skipped" | "cancelled" | "error";
	action?: string | null;
	reason?: string | null;
	/** If true, send to widget as well. Default: only if status is 'success' */
	notifyWidget?: boolean;
};

/**
 * Emit workflow completed event
 *
 * Called when the AI agent pipeline finishes.
 * - success: Sent to both widget and dashboard
 * - skipped/cancelled/error: Dashboard only (unless notifyWidget=true)
 */
export async function emitWorkflowCompleted(
	params: WorkflowCompletedParams
): Promise<void> {
	const {
		conversation,
		aiAgentId,
		workflowRunId,
		status,
		action,
		reason,
		notifyWidget,
	} = params;

	// Determine audience
	// - success: notify widget (visitor sees AI finished)
	// - skipped/cancelled/error: dashboard only (visitor doesn't need to know)
	const shouldNotifyWidget = notifyWidget ?? status === "success";
	const audience = shouldNotifyWidget ? "all" : "dashboard";

	await realtime.emit("aiAgentProcessingCompleted", {
		websiteId: conversation.websiteId,
		organizationId: conversation.organizationId,
		visitorId: conversation.visitorId,
		userId: null,
		conversationId: conversation.id,
		aiAgentId,
		workflowRunId,
		status,
		action: action ?? null,
		reason: reason ?? null,
		audience,
	});
}

type WorkflowCancelledParams = {
	conversation: ConversationSelect;
	aiAgentId: string;
	workflowRunId: string;
	reason: string;
};

/**
 * Emit workflow cancelled event
 *
 * Called when a workflow is superseded by a newer message.
 * Dashboard only - visitors don't see this.
 */
export async function emitWorkflowCancelled(
	params: WorkflowCancelledParams
): Promise<void> {
	await emitWorkflowCompleted({
		conversation: params.conversation,
		aiAgentId: params.aiAgentId,
		workflowRunId: params.workflowRunId,
		status: "cancelled",
		reason: params.reason,
		notifyWidget: false,
	});
}
