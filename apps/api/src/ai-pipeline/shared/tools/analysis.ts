import { updatePriority } from "@api/ai-agent/actions/update-priority";
import { updateSentiment } from "@api/ai-agent/actions/update-sentiment";
import { updateTitle } from "@api/ai-agent/actions/update-title";
import { tool } from "ai";
import { z } from "zod";
import type { PipelineToolContext, PipelineToolResult } from "./contracts";
import { incrementToolCall } from "./helpers";

const updateTitleInputSchema = z.object({
	title: z.string().min(1).max(100),
});

const updateSentimentInputSchema = z.object({
	sentiment: z.enum(["positive", "neutral", "negative"]),
	reason: z.string().min(1),
});

const setPriorityInputSchema = z.object({
	priority: z.enum(["low", "normal", "high", "urgent"]),
	reason: z.string().min(1),
});

export function createUpdateConversationTitleTool(ctx: PipelineToolContext) {
	return tool({
		description: "Set or update the conversation title.",
		inputSchema: updateTitleInputSchema,
		execute: async ({
			title,
		}): Promise<PipelineToolResult<{ title: string }>> => {
			incrementToolCall(ctx, "updateConversationTitle");
			await updateTitle({
				db: ctx.db,
				conversation: ctx.conversation,
				organizationId: ctx.organizationId,
				websiteId: ctx.websiteId,
				aiAgentId: ctx.aiAgentId,
				title: title.trim(),
			});
			return {
				success: true,
				data: { title: title.trim() },
			};
		},
	});
}

export function createUpdateSentimentTool(ctx: PipelineToolContext) {
	return tool({
		description: "Update conversation sentiment when useful.",
		inputSchema: updateSentimentInputSchema,
		execute: async ({
			sentiment,
			reason,
		}): Promise<PipelineToolResult<{ sentiment: string; reason: string }>> => {
			incrementToolCall(ctx, "updateSentiment");
			await updateSentiment({
				db: ctx.db,
				conversation: ctx.conversation,
				organizationId: ctx.organizationId,
				websiteId: ctx.websiteId,
				aiAgentId: ctx.aiAgentId,
				sentiment,
				confidence: 0.9,
			});
			return {
				success: true,
				data: { sentiment, reason },
			};
		},
	});
}

export function createSetPriorityTool(ctx: PipelineToolContext) {
	return tool({
		description: "Set conversation priority.",
		inputSchema: setPriorityInputSchema,
		execute: async ({
			priority,
			reason,
		}): Promise<PipelineToolResult<{ priority: string; reason: string }>> => {
			incrementToolCall(ctx, "setPriority");
			await updatePriority({
				db: ctx.db,
				conversation: ctx.conversation,
				organizationId: ctx.organizationId,
				websiteId: ctx.websiteId,
				aiAgentId: ctx.aiAgentId,
				newPriority: priority,
			});
			return {
				success: true,
				data: { priority, reason },
			};
		},
	});
}
