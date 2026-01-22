/**
 * Typing Events
 *
 * Emits typing indicator events for the AI agent.
 * Includes a heartbeat mechanism to keep typing indicators alive during long operations.
 */

import type { ConversationSelect } from "@api/db/schema/conversation";
import { emitConversationTypingEvent } from "@api/utils/conversation-realtime";

type TypingParams = {
	conversation: ConversationSelect;
	aiAgentId: string;
};

/**
 * Emit typing start event
 */
export async function emitTypingStart(params: TypingParams): Promise<void> {
	await emitConversationTypingEvent({
		conversation: params.conversation,
		actor: { type: "ai_agent", aiAgentId: params.aiAgentId },
		isTyping: true,
	});
}

/**
 * Emit typing stop event
 */
export async function emitTypingStop(params: TypingParams): Promise<void> {
	await emitConversationTypingEvent({
		conversation: params.conversation,
		actor: { type: "ai_agent", aiAgentId: params.aiAgentId },
		isTyping: false,
	});
}

/**
 * Heartbeat interval in milliseconds.
 * Client-side TTL is 6 seconds, so we send heartbeats every 4 seconds
 * to ensure the typing indicator stays visible.
 */
const HEARTBEAT_INTERVAL_MS = 4000;

/**
 * Typing Heartbeat
 *
 * Keeps the typing indicator alive during long-running operations (like LLM generation).
 * Sends periodic typing events to prevent the client from timing out the indicator.
 *
 * Usage:
 * ```ts
 * const heartbeat = new TypingHeartbeat({ conversation, aiAgentId });
 * await heartbeat.start();
 * try {
 *   await longRunningOperation();
 * } finally {
 *   await heartbeat.stop();
 * }
 * ```
 */
export class TypingHeartbeat {
	private readonly conversation: ConversationSelect;
	private readonly aiAgentId: string;
	private intervalHandle: ReturnType<typeof setInterval> | null = null;
	private isRunning = false;

	constructor(params: TypingParams) {
		this.conversation = params.conversation;
		this.aiAgentId = params.aiAgentId;
	}

	/**
	 * Start the typing heartbeat.
	 * Immediately emits a typing event and schedules periodic heartbeats.
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			return;
		}
		this.isRunning = true;

		const convId = this.conversation.id;
		console.log(
			`[ai-agent:typing] conv=${convId} | Starting heartbeat | interval=${HEARTBEAT_INTERVAL_MS}ms`
		);

		// Emit immediately
		await this.emitTyping();

		// Schedule periodic heartbeats
		this.intervalHandle = setInterval(() => {
			console.log(`[ai-agent:typing] conv=${convId} | Heartbeat tick`);
			// Fire-and-forget, don't await in interval
			this.emitTyping().catch((err) => {
				console.warn(
					`[ai-agent:typing] conv=${convId} | Failed to emit heartbeat: ${err instanceof Error ? err.message : "Unknown error"}`
				);
			});
		}, HEARTBEAT_INTERVAL_MS);
	}

	/**
	 * Stop the typing heartbeat and emit typing stop event.
	 */
	async stop(): Promise<void> {
		if (!this.isRunning) {
			return;
		}
		this.isRunning = false;

		const convId = this.conversation.id;
		console.log(`[ai-agent:typing] conv=${convId} | Stopping heartbeat`);

		// Clear the interval
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}

		// Emit stop event
		await emitTypingStop({
			conversation: this.conversation,
			aiAgentId: this.aiAgentId,
		});
		console.log(`[ai-agent:typing] conv=${convId} | Typing stopped`);
	}

	/**
	 * Check if heartbeat is currently running.
	 */
	get running(): boolean {
		return this.isRunning;
	}

	private async emitTyping(): Promise<void> {
		const convId = this.conversation.id;
		const visitorId = this.conversation.visitorId;
		const websiteId = this.conversation.websiteId;
		console.log(
			`[ai-agent:typing] conv=${convId} | Emitting typing event | visitorId=${visitorId} | websiteId=${websiteId}`
		);
		await emitConversationTypingEvent({
			conversation: this.conversation,
			actor: { type: "ai_agent", aiAgentId: this.aiAgentId },
			isTyping: true,
		});
		console.log(
			`[ai-agent:typing] conv=${convId} | Typing event emitted successfully`
		);
	}
}
