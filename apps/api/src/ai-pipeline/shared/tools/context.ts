import {
	identifyContact,
	linkVisitorToContact,
	updateContact,
} from "@api/db/queries/contact";
import { getCompleteVisitorWithContact } from "@api/db/queries/visitor";
import { findSimilarKnowledge } from "@api/utils/vector-search";
import { tool } from "ai";
import { z } from "zod";
import type { PipelineToolContext, PipelineToolResult } from "./contracts";
import { incrementToolCall } from "./helpers";

const searchKnowledgeInputSchema = z.object({
	query: z
		.string()
		.min(1)
		.describe("Short keyword query for knowledge search."),
});

const identifyVisitorInputSchema = z
	.object({
		email: z.string().email().optional(),
		name: z.string().min(1).max(100).optional(),
	})
	.refine((value) => Boolean(value.email || value.name), {
		message: "Provide at least one of email or name",
	});

export function createSearchKnowledgeBaseTool(ctx: PipelineToolContext) {
	return tool({
		description:
			"Search the knowledge base for relevant snippets and source metadata.",
		inputSchema: searchKnowledgeInputSchema,
		execute: async ({
			query,
		}): Promise<
			PipelineToolResult<{
				results: Array<{
					content: string;
					similarity: number;
					title: string | null;
					sourceUrl: string | null;
					sourceType: string | null;
				}>;
			}>
		> => {
			incrementToolCall(ctx, "searchKnowledgeBase");

			const results = await findSimilarKnowledge(ctx.db, query, ctx.websiteId, {
				limit: 5,
				minSimilarity: 0.3,
			});

			return {
				success: true,
				data: {
					results: results.map((item) => {
						const metadata =
							typeof item.metadata === "object" && item.metadata !== null
								? (item.metadata as Record<string, unknown>)
								: null;

						return {
							content: item.content,
							similarity: Math.round(item.similarity * 100) / 100,
							title:
								typeof metadata?.title === "string"
									? metadata.title
									: typeof metadata?.question === "string"
										? metadata.question
										: null,
							sourceUrl:
								typeof metadata?.url === "string" ? metadata.url : null,
							sourceType:
								typeof metadata?.sourceType === "string"
									? metadata.sourceType
									: null,
						};
					}),
				},
			};
		},
	});
}

export function createIdentifyVisitorTool(ctx: PipelineToolContext) {
	return tool({
		description:
			"Identify or update visitor profile details (email/name) for this conversation.",
		inputSchema: identifyVisitorInputSchema,
		execute: async ({
			email,
			name,
		}): Promise<
			PipelineToolResult<{ visitorId: string; contactId: string }>
		> => {
			incrementToolCall(ctx, "identifyVisitor");

			const visitor = await getCompleteVisitorWithContact(ctx.db, {
				visitorId: ctx.visitorId,
			});

			if (!visitor) {
				return {
					success: false,
					error: "Visitor not found",
				};
			}

			const trimmedEmail = email?.trim();
			const trimmedName = name?.trim();
			let contact = visitor.contact ?? null;

			if (contact) {
				const updates: Record<string, string> = {};
				if (trimmedEmail && trimmedEmail !== contact.email) {
					updates.email = trimmedEmail;
				}
				if (trimmedName && trimmedName !== contact.name) {
					updates.name = trimmedName;
				}

				if (Object.keys(updates).length > 0) {
					const updated = await updateContact(ctx.db, {
						contactId: contact.id,
						websiteId: ctx.websiteId,
						data: updates,
					});
					if (!updated) {
						return {
							success: false,
							error: "Failed to update contact",
						};
					}
					contact = updated;
				}
			} else {
				if (!trimmedEmail) {
					return {
						success: false,
						error:
							"Email is required for first-time identification in this phase",
					};
				}

				contact = await identifyContact(ctx.db, {
					websiteId: ctx.websiteId,
					organizationId: ctx.organizationId,
					email: trimmedEmail,
					name: trimmedName,
				});

				await linkVisitorToContact(ctx.db, {
					visitorId: ctx.visitorId,
					contactId: contact.id,
					websiteId: ctx.websiteId,
				});
			}

			return {
				success: true,
				data: {
					visitorId: ctx.visitorId,
					contactId: contact.id,
				},
			};
		},
	});
}
