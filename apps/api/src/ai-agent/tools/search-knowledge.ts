/**
 * Search Knowledge Base Tool
 *
 * Allows the AI to search the knowledge base for relevant articles and documentation.
 */

import { tool } from "ai";
import { z } from "zod";
import { findSimilarKnowledge } from "../../utils/vector-search";
import type { ToolContext, ToolResult } from "./types";

export type KnowledgeResult = {
	content: string;
	similarity: number;
};

const inputSchema = z.object({
	query: z
		.string()
		.describe(
			"Search query based on what the visitor is asking about (e.g., 'password reset', 'billing', 'how to export data')"
		),
});

/**
 * Create the searchKnowledgeBase tool with bound context
 */
export function createSearchKnowledgeBaseTool(ctx: ToolContext) {
	return tool({
		description:
			"IMPORTANT: Search the knowledge base BEFORE answering factual questions about the product, company, pricing, features, or policies. Only provide information found in search results - never make up answers. Use for: product questions, troubleshooting, feature inquiries, pricing questions, company policies.",
		inputSchema,
		execute: async ({
			query,
		}): Promise<ToolResult<{ articles: KnowledgeResult[]; query: string }>> => {
			try {
				console.log(
					`[tool:searchKnowledgeBase] conv=${ctx.conversationId} | query="${query}"`
				);

				const results = await findSimilarKnowledge(
					ctx.db,
					query,
					ctx.websiteId,
					{
						limit: 3,
						minSimilarity: 0.6,
					}
				);

				const articles = results.map((r) => ({
					content: r.content,
					similarity: r.similarity,
				}));

				console.log(
					`[tool:searchKnowledgeBase] conv=${ctx.conversationId} | found=${articles.length} articles`
				);

				return {
					success: true,
					data: {
						articles,
						query,
					},
				};
			} catch (error) {
				console.error(
					`[tool:searchKnowledgeBase] conv=${ctx.conversationId} | Failed:`,
					error
				);
				return {
					success: false,
					error:
						error instanceof Error
							? error.message
							: "Failed to search knowledge base",
				};
			}
		},
	});
}
