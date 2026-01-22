/**
 * Pipeline Step 2: Decision
 *
 * This step determines if and how the AI agent should respond.
 * It applies behavior settings and checks various conditions.
 *
 * Decision factors:
 * - Response mode (always, when_no_human, on_mention, manual)
 * - Human agent activity (recent replies, assignments)
 * - Escalation status
 * - Human commands (@ai prefix)
 * - Pause state
 */

import type { AiAgentSelect } from "@api/db/schema/ai-agent";
import type { ConversationSelect } from "@api/db/schema/conversation";
import type { RoleAwareMessage } from "../context/conversation";
import type { ConversationState } from "../context/state";
import { type AiAgentBehaviorSettings, getBehaviorSettings } from "../settings";

export type ResponseMode =
	| "respond_to_visitor"
	| "respond_to_command"
	| "background_only";

export type DecisionResult = {
	shouldAct: boolean;
	reason: string;
	mode: ResponseMode;
	humanCommand: string | null;
};

type DecisionInput = {
	aiAgent: AiAgentSelect;
	conversation: ConversationSelect;
	conversationHistory: RoleAwareMessage[];
	conversationState: ConversationState;
	triggerMessage: RoleAwareMessage | null;
};

/**
 * Determine if and how the AI agent should act
 */
export async function decide(input: DecisionInput): Promise<DecisionResult> {
	const settings = getBehaviorSettings(input.aiAgent);
	const { triggerMessage, conversationHistory, conversationState } = input;
	const convId = input.conversation.id;

	// Check for human command first (highest priority)
	const humanCommand = detectHumanCommand(triggerMessage);

	if (humanCommand) {
		console.log(
			`[ai-agent:decision] conv=${convId} | Human command detected: "${humanCommand.slice(0, 50)}${humanCommand.length > 50 ? "..." : ""}"`
		);
		return {
			shouldAct: true,
			reason: "Human agent issued a command",
			mode: "respond_to_command",
			humanCommand,
		};
	}

	// Check if AI is paused for this conversation
	if (isAiPaused(input.conversation)) {
		return {
			shouldAct: false,
			reason: "AI is paused for this conversation",
			mode: "background_only",
			humanCommand: null,
		};
	}

	// Check escalation status
	if (conversationState.isEscalated) {
		return {
			shouldAct: false,
			reason: "Conversation is escalated to human",
			mode: "background_only",
			humanCommand: null,
		};
	}

	// Apply response mode logic
	const responseModeResult = applyResponseMode(
		settings,
		triggerMessage,
		conversationHistory,
		conversationState
	);

	console.log(
		`[ai-agent:decision] conv=${convId} | mode=${settings.responseMode} | shouldAct=${responseModeResult.shouldAct} | reason="${responseModeResult.reason}"`
	);

	return {
		...responseModeResult,
		humanCommand: null,
	};
}

/**
 * Detect if the message is a human command to the AI
 * Commands start with @ai or /ai
 */
function detectHumanCommand(message: RoleAwareMessage | null): string | null {
	if (!message) {
		return null;
	}

	// Only human agents can issue commands
	if (message.senderType !== "human_agent") {
		return null;
	}

	const text = message.content.trim();
	const lowerText = text.toLowerCase();

	// Check for @ai prefix
	if (lowerText.startsWith("@ai ")) {
		return text.slice(4).trim();
	}

	// Check for /ai prefix
	if (lowerText.startsWith("/ai ")) {
		return text.slice(4).trim();
	}

	return null;
}

/**
 * Check if AI is paused for this conversation
 */
function isAiPaused(conversation: ConversationSelect): boolean {
	if (!conversation.aiPausedUntil) {
		return false;
	}

	return new Date(conversation.aiPausedUntil) > new Date();
}

/**
 * Apply response mode settings to determine if AI should respond
 */
function applyResponseMode(
	settings: AiAgentBehaviorSettings,
	triggerMessage: RoleAwareMessage | null,
	conversationHistory: RoleAwareMessage[],
	conversationState: ConversationState
): Omit<DecisionResult, "humanCommand"> {
	// Manual mode - only respond to explicit commands
	if (settings.responseMode === "manual") {
		return {
			shouldAct: false,
			reason: "Response mode is manual, waiting for command",
			mode: "background_only",
		};
	}

	// On mention mode - only respond when explicitly mentioned
	if (settings.responseMode === "on_mention") {
		const isMentioned = checkForAiMention(triggerMessage);
		if (!isMentioned) {
			return {
				shouldAct: false,
				reason: "AI not mentioned in message",
				mode: "background_only",
			};
		}
	}

	// When no human mode - check for recent human activity
	if (settings.responseMode === "when_no_human") {
		const humanActivityResult = checkHumanActivity(
			settings,
			conversationHistory,
			conversationState
		);
		if (!humanActivityResult.shouldRespond) {
			return {
				shouldAct: false,
				reason: humanActivityResult.reason,
				mode: "background_only",
			};
		}
	}

	// Check if trigger is from visitor (AI responds to visitor messages)
	if (triggerMessage?.senderType !== "visitor") {
		return {
			shouldAct: false,
			reason: "Trigger message is not from visitor",
			mode: "background_only",
		};
	}

	// All checks passed - AI should respond
	return {
		shouldAct: true,
		reason: "All conditions met for AI response",
		mode: "respond_to_visitor",
	};
}

/**
 * Check if the AI is mentioned in the message
 */
function checkForAiMention(message: RoleAwareMessage | null): boolean {
	if (!message) {
		return false;
	}

	const text = message.content.toLowerCase();
	return text.includes("@ai") || text.includes("ai agent");
}

/**
 * Check for recent human agent activity
 */
function checkHumanActivity(
	settings: AiAgentBehaviorSettings,
	conversationHistory: RoleAwareMessage[],
	conversationState: ConversationState
): { shouldRespond: boolean; reason: string } {
	// If pause on human reply is enabled, check for recent human messages
	if (settings.pauseOnHumanReply) {
		const lastHumanMessage = findLastMessageByType(
			conversationHistory,
			"human_agent"
		);

		if (lastHumanMessage?.timestamp) {
			const pauseMinutes = settings.pauseDurationMinutes ?? 60; // Default 60 min
			const pauseMs = pauseMinutes * 60 * 1000;
			const messageAge =
				Date.now() - new Date(lastHumanMessage.timestamp).getTime();

			if (messageAge < pauseMs) {
				return {
					shouldRespond: false,
					reason: `Human agent replied ${Math.round(messageAge / 60_000)} minutes ago, pausing for ${pauseMinutes} minutes`,
				};
			}
		}
	}

	// Check if there's an active human assignee
	if (conversationState.hasHumanAssignee) {
		return {
			shouldRespond: false,
			reason: "Conversation has an active human assignee",
		};
	}

	return {
		shouldRespond: true,
		reason: "No recent human activity",
	};
}

/**
 * Find the last message from a specific sender type
 */
function findLastMessageByType(
	messages: RoleAwareMessage[],
	senderType: RoleAwareMessage["senderType"]
): RoleAwareMessage | null {
	// Messages are in chronological order, so iterate backwards
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].senderType === senderType) {
			return messages[i];
		}
	}
	return null;
}
