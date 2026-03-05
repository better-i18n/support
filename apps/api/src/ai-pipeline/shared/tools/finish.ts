import { escalate as escalateAction } from "@api/ai-agent/actions/escalate";
import { updateStatus } from "@api/ai-agent/actions/update-status";
import { tool } from "ai";
import { z } from "zod";
import type { PipelineToolContext, PipelineToolResult } from "./contracts";
import { incrementToolCall, setFinalAction, setToolError } from "./helpers";

const respondSchema = z.object({
	reasoning: z.string().min(1),
	confidence: z.number().min(0).max(1),
});

const escalateSchema = z.object({
	reason: z.string().min(1),
	urgency: z.enum(["normal", "high", "urgent"]).optional(),
	reasoning: z.string().min(1),
	confidence: z.number().min(0).max(1),
});

const resolveSchema = z.object({
	reasoning: z.string().min(1),
	confidence: z.number().min(0).max(1),
});

const markSpamSchema = z.object({
	reasoning: z.string().min(1),
	confidence: z.number().min(0).max(1),
});

const skipSchema = z.object({
	reasoning: z.string().min(1),
});

export function createRespondTool(ctx: PipelineToolContext) {
	return tool({
		description: "Finish the run with a normal response outcome.",
		inputSchema: respondSchema,
		execute: async ({
			reasoning,
			confidence,
		}): Promise<PipelineToolResult<{ action: "respond" }>> => {
			incrementToolCall(ctx, "respond");
			setFinalAction(ctx, {
				action: "respond",
				reasoning,
				confidence,
			});
			return {
				success: true,
				data: { action: "respond" },
			};
		},
	});
}

export function createEscalateTool(ctx: PipelineToolContext) {
	return tool({
		description: "Escalate this conversation to human support and finish.",
		inputSchema: escalateSchema,
		execute: async ({
			reason,
			reasoning,
			confidence,
			urgency,
		}): Promise<PipelineToolResult<{ action: "escalate" | "respond" }>> => {
			incrementToolCall(ctx, "escalate");

			if (ctx.isEscalated) {
				setFinalAction(ctx, {
					action: "respond",
					reasoning:
						"Conversation already escalated; converted escalate request into respond outcome.",
					confidence,
				});
				return {
					success: true,
					data: { action: "respond" },
				};
			}

			try {
				await escalateAction({
					db: ctx.db,
					conversation: ctx.conversation,
					organizationId: ctx.organizationId,
					websiteId: ctx.websiteId,
					aiAgentId: ctx.aiAgentId,
					aiAgentName: ctx.aiAgentName,
					reason,
					visitorMessage: null,
					visitorName: ctx.visitorName,
					urgency: urgency ?? "normal",
				});

				setFinalAction(ctx, {
					action: "escalate",
					reasoning,
					confidence,
					escalation: {
						reason,
						urgency: urgency ?? "normal",
					},
				});

				return {
					success: true,
					data: { action: "escalate" },
				};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to escalate";
				setToolError(ctx, {
					toolName: "escalate",
					error: message,
					fatal: true,
				});
				return {
					success: false,
					error: message,
				};
			}
		},
	});
}

export function createResolveTool(ctx: PipelineToolContext) {
	return tool({
		description: "Resolve the conversation and finish.",
		inputSchema: resolveSchema,
		execute: async ({
			reasoning,
			confidence,
		}): Promise<PipelineToolResult<{ action: "resolve" }>> => {
			incrementToolCall(ctx, "resolve");

			try {
				await updateStatus({
					db: ctx.db,
					conversation: ctx.conversation,
					organizationId: ctx.organizationId,
					websiteId: ctx.websiteId,
					aiAgentId: ctx.aiAgentId,
					newStatus: "resolved",
				});

				setFinalAction(ctx, {
					action: "resolve",
					reasoning,
					confidence,
				});

				return {
					success: true,
					data: { action: "resolve" },
				};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to resolve";
				setToolError(ctx, {
					toolName: "resolve",
					error: message,
					fatal: true,
				});
				return {
					success: false,
					error: message,
				};
			}
		},
	});
}

export function createMarkSpamTool(ctx: PipelineToolContext) {
	return tool({
		description: "Mark the conversation as spam and finish.",
		inputSchema: markSpamSchema,
		execute: async ({
			reasoning,
			confidence,
		}): Promise<PipelineToolResult<{ action: "mark_spam" }>> => {
			incrementToolCall(ctx, "markSpam");

			try {
				await updateStatus({
					db: ctx.db,
					conversation: ctx.conversation,
					organizationId: ctx.organizationId,
					websiteId: ctx.websiteId,
					aiAgentId: ctx.aiAgentId,
					newStatus: "spam",
				});

				setFinalAction(ctx, {
					action: "mark_spam",
					reasoning,
					confidence,
				});

				return {
					success: true,
					data: { action: "mark_spam" },
				};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to mark spam";
				setToolError(ctx, {
					toolName: "markSpam",
					error: message,
					fatal: true,
				});
				return {
					success: false,
					error: message,
				};
			}
		},
	});
}

export function createSkipTool(ctx: PipelineToolContext) {
	return tool({
		description: "Finish the run without public response.",
		inputSchema: skipSchema,
		execute: async ({
			reasoning,
		}): Promise<PipelineToolResult<{ action: "skip" }>> => {
			incrementToolCall(ctx, "skip");
			setFinalAction(ctx, {
				action: "skip",
				reasoning,
				confidence: 1,
			});
			return {
				success: true,
				data: { action: "skip" },
			};
		},
	});
}
