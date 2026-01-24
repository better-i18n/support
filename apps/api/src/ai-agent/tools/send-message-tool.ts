/**
 * Send Message Tool
 *
 * Sends a public message to the visitor.
 */

import { tool } from "ai";
import { z } from "zod";
import { sendMessage as sendMessageAction } from "../actions/send-message";
import type { ToolContext, ToolResult } from "./types";

const inputSchema = z.object({
	message: z
		.string()
		.describe(
			"The message text to send to the visitor. Keep each message to 1-2 sentences for readability."
		),
});

/**
 * Create the sendMessage tool
 *
 * Uses counters from ToolContext instead of module-level state to ensure
 * proper isolation in worker/serverless environments.
 */
export function createSendMessageTool(ctx: ToolContext) {
	return tool({
		description:
			"REQUIRED: Send a visible message to the visitor. The visitor ONLY sees messages sent through this tool. Call this BEFORE any action tool (respond, escalate, resolve). You can call multiple times for multi-part responses.",
		inputSchema,
		execute: async ({
			message,
		}): Promise<ToolResult<{ sent: boolean; messageId: string }>> => {
			try {
				// Defensive initialization for counters (handles hot reload edge cases)
				const counters = ctx.counters ?? {
					sendMessage: 0,
					sendPrivateMessage: 0,
				};
				if (!ctx.counters) {
					ctx.counters = counters;
				}

				// Increment counter in context (shared mutable object)
				counters.sendMessage++;
				const messageNumber = counters.sendMessage;
				const uniqueKey = `${ctx.triggerMessageId}-msg-${messageNumber}`;

				// CHECK: Is this workflow still active? Prevents duplicate messages
				// when a newer message has superseded this workflow during generation.
				if (ctx.checkWorkflowActive) {
					const isActive = await ctx.checkWorkflowActive();
					if (!isActive) {
						console.log(
							`[tool:sendMessage] conv=${ctx.conversationId} | Workflow superseded, skipping message #${messageNumber}`
						);
						return {
							success: false,
							error: "Workflow superseded by newer message",
							data: { sent: false, messageId: "" },
						};
					}
				}

				// Start typing indicator on first message (if callback provided)
				// This ensures typing only shows when AI is actually sending a message
				if (messageNumber === 1 && ctx.onTypingStart) {
					await ctx.onTypingStart();
				}

				console.log(
					`[tool:sendMessage] conv=${ctx.conversationId} | sending #${messageNumber}`
				);

				const result = await sendMessageAction({
					db: ctx.db,
					conversationId: ctx.conversationId,
					organizationId: ctx.organizationId,
					websiteId: ctx.websiteId,
					visitorId: ctx.visitorId,
					aiAgentId: ctx.aiAgentId,
					text: message,
					idempotencyKey: uniqueKey,
				});

				console.log(
					`[tool:sendMessage] conv=${ctx.conversationId} | sent=${result.created}`
				);

				return {
					success: true,
					data: { sent: result.created, messageId: result.messageId },
				};
			} catch (error) {
				console.error(
					`[tool:sendMessage] conv=${ctx.conversationId} | Failed:`,
					error
				);
				return {
					success: false,
					error:
						error instanceof Error ? error.message : "Failed to send message",
				};
			}
		},
	});
}
