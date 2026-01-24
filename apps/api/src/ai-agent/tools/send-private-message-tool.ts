/**
 * Send Private Message Tool
 *
 * Sends a private note visible only to the team.
 */

import { tool } from "ai";
import { z } from "zod";
import { addInternalNote } from "../actions/internal-note";
import type { ToolContext, ToolResult } from "./types";

const inputSchema = z.object({
	message: z
		.string()
		.describe(
			"Internal note text for the support team. Include relevant context like order numbers, issue summaries, or handoff instructions."
		),
});

/**
 * Create the sendPrivateMessage tool
 *
 * Uses counters from ToolContext instead of module-level state to ensure
 * proper isolation in worker/serverless environments.
 */
export function createSendPrivateMessageTool(ctx: ToolContext) {
	return tool({
		description:
			"Send an internal note visible ONLY to the support team (visitor cannot see). Use when escalating to provide context, or to document important information for human agents.",
		inputSchema,
		execute: async ({
			message,
		}): Promise<ToolResult<{ sent: boolean; noteId: string }>> => {
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
				counters.sendPrivateMessage++;
				const noteNumber = counters.sendPrivateMessage;
				const uniqueKey = `${ctx.triggerMessageId}-private-${noteNumber}`;

				// CHECK: Is this workflow still active? Prevents duplicate notes
				// when a newer message has superseded this workflow during generation.
				if (ctx.checkWorkflowActive) {
					const isActive = await ctx.checkWorkflowActive();
					if (!isActive) {
						console.log(
							`[tool:sendPrivateMessage] conv=${ctx.conversationId} | Workflow superseded, skipping note #${noteNumber}`
						);
						return {
							success: false,
							error: "Workflow superseded by newer message",
							data: { sent: false, noteId: "" },
						};
					}
				}

				console.log(
					`[tool:sendPrivateMessage] conv=${ctx.conversationId} | sending #${noteNumber}`
				);

				const result = await addInternalNote({
					db: ctx.db,
					conversationId: ctx.conversationId,
					organizationId: ctx.organizationId,
					aiAgentId: ctx.aiAgentId,
					text: message,
					idempotencyKey: uniqueKey,
				});

				console.log(
					`[tool:sendPrivateMessage] conv=${ctx.conversationId} | sent=${result.created}`
				);

				return {
					success: true,
					data: { sent: result.created, noteId: result.noteId },
				};
			} catch (error) {
				console.error(
					`[tool:sendPrivateMessage] conv=${ctx.conversationId} | Failed:`,
					error
				);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Failed to send note",
				};
			}
		},
	});
}
