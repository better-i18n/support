import { describe, expect, it } from "bun:test";
import type { TimelineItem } from "@cossistant/types/api/timeline-item";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	SearchKnowledgeProcessingIndicator,
	SearchKnowledgeTimelineTool,
} from "./timeline-search-knowledge-tool";

function createToolTimelineItem(
	overrides: Partial<TimelineItem> = {}
): TimelineItem {
	return {
		id: "tool-1",
		conversationId: "conv-1",
		organizationId: "org-1",
		visibility: "public",
		type: "tool",
		text: "Searching knowledge base...",
		parts: [
			{
				type: "tool-searchKnowledgeBase",
				toolCallId: "call-1",
				toolName: "searchKnowledgeBase",
				input: { query: "pricing" },
				state: "partial",
			},
		],
		userId: null,
		visitorId: null,
		aiAgentId: "ai-1",
		createdAt: "2026-03-08T10:00:00.000Z",
		deletedAt: null,
		tool: "searchKnowledgeBase",
		...overrides,
	};
}

describe("SearchKnowledgeTimelineTool", () => {
	it("renders the partial state with the knowledge search label", () => {
		const html = renderToStaticMarkup(
			<SearchKnowledgeTimelineTool
				conversationId="conv-1"
				item={createToolTimelineItem()}
			/>
		);

		expect(html).toContain("Searching knowledge base...");
		expect(html).toContain("search");
	});

	it("renders result state with a source count and compact source labels", () => {
		const html = renderToStaticMarkup(
			<SearchKnowledgeTimelineTool
				conversationId="conv-1"
				item={createToolTimelineItem({
					text: "Found 2 sources",
					parts: [
						{
							type: "tool-searchKnowledgeBase",
							toolCallId: "call-1",
							toolName: "searchKnowledgeBase",
							input: { query: "pricing" },
							state: "result",
							output: {
								success: true,
								data: {
									totalFound: 2,
									articles: [
										{
											title: "Billing FAQ",
											sourceUrl: "https://example.com/billing",
										},
										{
											sourceUrl: "https://docs.example.com/pricing",
										},
									],
								},
							},
						},
					],
				})}
			/>
		);

		expect(html).toContain("Found 2 sources");
		expect(html).toContain("Billing FAQ");
		expect(html).toContain("docs.example.com/pricing");
	});
});

describe("SearchKnowledgeProcessingIndicator", () => {
	it("renders the live processing message", () => {
		const html = renderToStaticMarkup(
			<SearchKnowledgeProcessingIndicator
				message="Searching knowledge base..."
				toolName="searchKnowledgeBase"
			/>
		);

		expect(html).toContain("Searching knowledge base...");
	});
});
