import { describe, expect, it } from "bun:test";
import type { TimelineItem } from "@cossistant/types/api/timeline-item";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	GenericWidgetToolProcessingIndicator,
	GenericWidgetToolTimelineTool,
} from "./timeline-widget-tool";

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

describe("GenericWidgetToolTimelineTool", () => {
	it("renders registered tools without a custom renderer", () => {
		const html = renderToStaticMarkup(
			<GenericWidgetToolTimelineTool
				conversationId="conv-1"
				item={createToolTimelineItem()}
			/>
		);

		expect(html).toContain("Searching knowledge base...");
	});

	it("returns null for unregistered tools", () => {
		const html = renderToStaticMarkup(
			<GenericWidgetToolTimelineTool
				conversationId="conv-1"
				item={createToolTimelineItem({
					text: "Analyzing conversation...",
					tool: "updateSentiment",
					parts: [
						{
							type: "tool-updateSentiment",
							toolCallId: "call-2",
							toolName: "updateSentiment",
							input: { mode: "auto" },
							state: "partial",
						},
					],
				})}
			/>
		);

		expect(html).toBe("");
	});
});

describe("GenericWidgetToolProcessingIndicator", () => {
	it("uses the registry default progress copy", () => {
		const html = renderToStaticMarkup(
			<GenericWidgetToolProcessingIndicator
				message={null}
				toolName="searchKnowledgeBase"
			/>
		);

		expect(html).toContain("Searching knowledge base...");
	});
});
