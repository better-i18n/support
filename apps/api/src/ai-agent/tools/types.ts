/**
 * Tool Types
 *
 * Shared types for AI agent tools.
 */

import type { Database } from "@api/db";
import type { ConversationSelect } from "@api/db/schema/conversation";

/**
 * Mutable counters for message idempotency within a single generation.
 * Using an object allows counters to be shared and mutated across tool calls.
 */
export type MessageCounters = {
	sendMessage: number;
	sendPrivateMessage: number;
};

/**
 * Callback for managing typing indicator.
 * Called when first message is about to be sent.
 */
export type OnTypingStartCallback = () => Promise<void>;

/**
 * Callback to check if this workflow run is still active.
 * Used to prevent duplicate messages when a newer workflow supersedes this one.
 */
export type CheckWorkflowActiveCallback = () => Promise<boolean>;

/**
 * Context passed to all tools via experimental_context
 */
export type ToolContext = {
	db: Database;
	conversation: ConversationSelect;
	conversationId: string;
	organizationId: string;
	websiteId: string;
	visitorId: string;
	aiAgentId: string;
	/** Trigger message ID - used for idempotency keys in send-message tool */
	triggerMessageId: string;
	/**
	 * Mutable counters for message idempotency - shared across tool calls.
	 * May be undefined in edge cases (hot reload), tools should initialize defensively.
	 */
	counters?: MessageCounters;
	/** Callback to start typing indicator - called on first sendMessage */
	onTypingStart?: OnTypingStartCallback;
	/**
	 * Callback to check if workflow is still active before sending messages.
	 * Prevents duplicate messages when a newer message supersedes this workflow.
	 */
	checkWorkflowActive?: CheckWorkflowActiveCallback;
};

/**
 * Result returned by side-effect tools
 */
export type ToolResult<T = unknown> = {
	success: boolean;
	error?: string;
	data?: T;
};
