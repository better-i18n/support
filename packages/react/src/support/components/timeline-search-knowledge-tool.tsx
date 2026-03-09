import type { TimelineItem } from "@cossistant/types/api/timeline-item";
import type React from "react";
import { extractToolPart } from "../../utils/timeline-tool";
import type {
	ConversationTimelineProcessingProps,
	ConversationTimelineToolProps,
} from "./timeline-tool-types";
import { WidgetToolActivityRow } from "./timeline-widget-tool";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractSourceCount(output: unknown): number | null {
	if (!isRecord(output)) {
		return null;
	}

	const data = isRecord(output.data) ? output.data : null;
	if (typeof data?.totalFound === "number") {
		return data.totalFound;
	}

	const articles = Array.isArray(data?.articles) ? data.articles : null;
	return articles ? articles.length : null;
}

function toCompactSourceLabel(article: unknown): string | null {
	if (!isRecord(article)) {
		return null;
	}

	if (typeof article.title === "string" && article.title.trim().length > 0) {
		return article.title.trim();
	}

	if (
		typeof article.sourceUrl === "string" &&
		article.sourceUrl.trim().length > 0
	) {
		try {
			const parsed = new URL(article.sourceUrl);
			const hostname = parsed.hostname.replace(/^www\./, "");
			const pathname =
				parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
			return `${hostname}${pathname}`;
		} catch {
			return article.sourceUrl.trim();
		}
	}

	return null;
}

function extractSourceLabels(output: unknown): string[] {
	if (!isRecord(output)) {
		return [];
	}

	const data = isRecord(output.data) ? output.data : null;
	const articles = Array.isArray(data?.articles) ? data.articles : [];
	return articles
		.map((article) => toCompactSourceLabel(article))
		.filter((label): label is string => Boolean(label))
		.slice(0, 3);
}

export function SearchKnowledgeTimelineTool({
	item,
}: ConversationTimelineToolProps) {
	const toolPart = extractToolPart(item);
	const state = toolPart?.state ?? "partial";

	const text =
		state === "partial"
			? "Searching knowledge base..."
			: state === "error"
				? "Knowledge base lookup failed"
				: (() => {
						const count = extractSourceCount(toolPart?.output);
						if (typeof count === "number") {
							return `Found ${count} source${count === 1 ? "" : "s"}`;
						}

						return item.text?.trim() || "Finished knowledge base search";
					})();

	const sourceLabels =
		state === "result" ? extractSourceLabels(toolPart?.output) : [];

	return (
		<WidgetToolActivityRow
			detailLabels={sourceLabels}
			iconName="search"
			state={state}
			text={text}
		/>
	);
}

export function SearchKnowledgeProcessingIndicator({
	message,
}: ConversationTimelineProcessingProps) {
	return (
		<WidgetToolActivityRow
			iconName="search"
			text={message?.trim() || "Searching knowledge base..."}
		/>
	);
}
