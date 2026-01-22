/**
 * Decision Events
 *
 * Emits events when the AI agent makes a decision about whether to act.
 */

import type { ConversationSelect } from "@api/db/schema/conversation";
import { realtime } from "@api/realtime/emitter";
import type { ResponseMode } from "../pipeline/2-decision";

type DecisionMadeParams = {
	conversation: ConversationSelect;
	aiAgentId: string;
	workflowRunId: string;
	shouldAct: boolean;
	reason: string;
	mode: ResponseMode;
};

/**
 * Emit decision made event
 *
 * Called after the AI agent decides whether to act.
 * - If shouldAct=true: Sent to both widget and dashboard
 * - If shouldAct=false: Dashboard only (visitor doesn't know AI decided not to reply)
 */
export async function emitDecisionMade(
	params: DecisionMadeParams
): Promise<void> {
	const { conversation, aiAgentId, workflowRunId, shouldAct, reason, mode } =
		params;

	// Audience depends on decision:
	// - AI will act: Tell the widget so it can show typing indicator
	// - AI won't act: Dashboard only, visitor shouldn't know AI evaluated and decided not to respond
	const audience = shouldAct ? "all" : "dashboard";

	await realtime.emit("aiAgentDecisionMade", {
		websiteId: conversation.websiteId,
		organizationId: conversation.organizationId,
		visitorId: conversation.visitorId,
		userId: null,
		conversationId: conversation.id,
		aiAgentId,
		workflowRunId,
		shouldAct,
		reason,
		mode,
		audience,
	});
}
