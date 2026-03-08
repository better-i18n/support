import type { Database } from "@api/db";
import { getConversationTimelineItems } from "@api/db/queries/conversation";
import {
	ConversationTimelineType,
	TimelineItemVisibility,
} from "@cossistant/types";
import type { TimelineItem } from "@cossistant/types/api/timeline-item";
import type {
	ConversationToolAction,
	ConversationTranscriptEntry,
	RoleAwareMessage,
	SenderType,
} from "../../contracts";

const MAX_CONTEXT_MESSAGES = 50;
const MAX_CONTEXT_TRANSCRIPT_ENTRIES = 80;
const TIMELINE_PAGE_SIZE = 120;
const MAX_TIMELINE_PAGES = 12;

const EXCLUDED_TRANSCRIPT_TOOL_NAMES = new Set<string>([
	"aiCreditUsage",
	"respond",
	"escalate",
	"resolve",
	"markSpam",
	"skip",
	"sendMessage",
	"sendPrivateMessage",
	"sendAcknowledgeMessage",
	"sendFollowUpMessage",
]);

type BuildHistoryParams = {
	conversationId: string;
	organizationId: string;
	websiteId: string;
	maxCreatedAt?: string | null;
	maxId?: string | null;
};

type ToolPart = {
	type: `tool-${string}`;
	toolName: string;
	state: "partial" | "result" | "error";
	input: Record<string, unknown>;
	output?: unknown;
	errorText?: string;
};

function normalizeText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapSenderType(item: {
	visitorId: string | null;
	userId: string | null;
	aiAgentId: string | null;
}): SenderType {
	if (item.visitorId) {
		return "visitor";
	}
	if (item.userId) {
		return "human_agent";
	}
	if (item.aiAgentId) {
		return "ai_agent";
	}
	return "visitor";
}

function getStringField(
	record: Record<string, unknown>,
	key: string
): string | null {
	const value = record[key];
	return typeof value === "string" ? value.trim() || null : null;
}

function getNumberField(
	record: Record<string, unknown>,
	key: string
): number | null {
	const value = record[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapTimelineMessage(item: TimelineItem): RoleAwareMessage | null {
	if (item.type !== ConversationTimelineType.MESSAGE || !item.id) {
		return null;
	}

	const content = normalizeText(item.text ?? "");
	if (!content) {
		return null;
	}

	return {
		messageId: item.id,
		content,
		senderType: mapSenderType(item),
		senderId: item.userId ?? item.visitorId ?? item.aiAgentId ?? null,
		senderName: null,
		timestamp: item.createdAt,
		visibility:
			item.visibility === TimelineItemVisibility.PUBLIC ? "public" : "private",
	};
}

function getToolPart(item: TimelineItem): ToolPart | null {
	for (let index = item.parts.length - 1; index >= 0; index--) {
		const rawPart = item.parts[index];
		if (!isRecord(rawPart)) {
			continue;
		}
		const partRecord = rawPart as Record<string, unknown>;

		const type = getStringField(partRecord, "type");
		const toolName = getStringField(partRecord, "toolName");
		const state = getStringField(partRecord, "state");

		if (
			!(
				type?.startsWith("tool-") &&
				toolName &&
				(state === "partial" || state === "result" || state === "error")
			)
		) {
			continue;
		}

		return {
			type: type as ToolPart["type"],
			toolName,
			state,
			input: isRecord(partRecord.input) ? partRecord.input : {},
			output: partRecord.output,
			errorText: getStringField(partRecord, "errorText") ?? undefined,
		};
	}

	return null;
}

function summarizeSearchKnowledgeBase(toolPart: ToolPart): string | null {
	const query = getStringField(toolPart.input, "query");
	const output = isRecord(toolPart.output) ? toolPart.output : null;
	const data = output && isRecord(output.data) ? output.data : null;
	const totalFound =
		(data && getNumberField(data, "totalFound")) ??
		(Array.isArray(data?.articles) ? data.articles.length : null);

	const fragments = [
		query ? `query="${truncateText(query, 80)}"` : null,
		typeof totalFound === "number" ? `results=${totalFound}` : null,
	];

	return fragments.filter(Boolean).join(" | ") || null;
}

function summarizeIdentifyVisitor(toolPart: ToolPart): string | null {
	const email = getStringField(toolPart.input, "email");
	const name = getStringField(toolPart.input, "name");
	const fragments = [
		name ? `name="${truncateText(name, 60)}"` : null,
		email ? `email="${truncateText(email, 80)}"` : null,
	];

	return fragments.filter(Boolean).join(" | ") || null;
}

function summarizeUpdateConversationTitle(toolPart: ToolPart): string | null {
	const output = isRecord(toolPart.output) ? toolPart.output : null;
	const data = output && isRecord(output.data) ? output.data : null;
	const title =
		(data && getStringField(data, "title")) ??
		getStringField(toolPart.input, "title");

	return title ? `title="${truncateText(title, 100)}"` : null;
}

function summarizeUpdateSentiment(toolPart: ToolPart): string | null {
	const output = isRecord(toolPart.output) ? toolPart.output : null;
	const data = output && isRecord(output.data) ? output.data : null;
	const sentiment =
		(data && getStringField(data, "sentiment")) ??
		getStringField(toolPart.input, "sentiment");

	return sentiment ? `sentiment=${sentiment}` : null;
}

function summarizeSetPriority(toolPart: ToolPart): string | null {
	const output = isRecord(toolPart.output) ? toolPart.output : null;
	const data = output && isRecord(output.data) ? output.data : null;
	const priority =
		(data && getStringField(data, "priority")) ??
		getStringField(toolPart.input, "priority");

	return priority ? `priority=${priority}` : null;
}

function summarizeToolPart(toolPart: ToolPart): string | null {
	switch (toolPart.toolName) {
		case "searchKnowledgeBase":
			return summarizeSearchKnowledgeBase(toolPart);
		case "identifyVisitor":
			return summarizeIdentifyVisitor(toolPart);
		case "updateConversationTitle":
			return summarizeUpdateConversationTitle(toolPart);
		case "updateSentiment":
			return summarizeUpdateSentiment(toolPart);
		case "setPriority":
			return summarizeSetPriority(toolPart);
		default:
			return null;
	}
}

function buildFallbackToolSummary(toolPart: ToolPart): string {
	if (toolPart.state === "error") {
		return `Failed ${toolPart.toolName}`;
	}

	if (toolPart.state === "partial") {
		return `Running ${toolPart.toolName}`;
	}

	return `Completed ${toolPart.toolName}`;
}

function mapTimelineToolAction(
	item: TimelineItem
): ConversationToolAction | null {
	if (
		item.type !== ConversationTimelineType.TOOL ||
		!(item.aiAgentId && item.id)
	) {
		return null;
	}

	const toolPart = getToolPart(item);
	if (!toolPart || EXCLUDED_TRANSCRIPT_TOOL_NAMES.has(toolPart.toolName)) {
		return null;
	}

	const visibility =
		item.visibility === TimelineItemVisibility.PUBLIC ? "public" : "private";
	const prefix =
		visibility === "private"
			? `[PRIVATE][TOOL:${toolPart.toolName}]`
			: `[TOOL:${toolPart.toolName}]`;
	const baseSummary =
		normalizeText(item.text ?? "") || buildFallbackToolSummary(toolPart);
	const detailSummary = summarizeToolPart(toolPart);
	const content = [prefix, baseSummary, detailSummary]
		.filter((segment) => Boolean(segment && segment.trim().length > 0))
		.join(" ");

	return {
		kind: "tool",
		itemId: item.id,
		toolName: toolPart.toolName,
		content,
		timestamp: item.createdAt,
		visibility,
	};
}

function countContextMessages(items: TimelineItem[]): number {
	let total = 0;

	for (const item of items) {
		if (mapTimelineMessage(item)) {
			total += 1;
		}
	}

	return total;
}

function trimTranscriptEntries(
	entries: ConversationTranscriptEntry[]
): ConversationTranscriptEntry[] {
	if (entries.length <= MAX_CONTEXT_TRANSCRIPT_ENTRIES) {
		return entries;
	}

	const trimmed: Array<ConversationTranscriptEntry | null> = [...entries];
	let overflow = trimmed.length - MAX_CONTEXT_TRANSCRIPT_ENTRIES;

	for (let index = 0; index < trimmed.length && overflow > 0; index++) {
		const entry = trimmed[index];
		if (entry && "kind" in entry && entry.kind === "tool") {
			trimmed[index] = null;
			overflow -= 1;
		}
	}

	return trimmed.filter(
		(entry): entry is ConversationTranscriptEntry => entry !== null
	);
}

async function loadTimelineWindow(
	db: Database,
	params: BuildHistoryParams
): Promise<TimelineItem[]> {
	const collected: TimelineItem[] = [];
	let cursor: string | undefined;

	for (let page = 0; page < MAX_TIMELINE_PAGES; page++) {
		const batch = await getConversationTimelineItems(db, {
			organizationId: params.organizationId,
			conversationId: params.conversationId,
			websiteId: params.websiteId,
			limit: TIMELINE_PAGE_SIZE,
			cursor,
			maxCreatedAt: params.maxCreatedAt ?? null,
			maxId: params.maxId ?? null,
			visibility: [
				TimelineItemVisibility.PUBLIC,
				TimelineItemVisibility.PRIVATE,
			],
		});

		if (batch.items.length === 0) {
			break;
		}

		collected.unshift(...batch.items);

		if (
			countContextMessages(collected) >= MAX_CONTEXT_MESSAGES ||
			!batch.hasNextPage ||
			!batch.nextCursor
		) {
			break;
		}

		cursor = batch.nextCursor;
	}

	return collected;
}

export async function buildConversationTranscript(
	db: Database,
	params: BuildHistoryParams
): Promise<ConversationTranscriptEntry[]> {
	const timelineItems = await loadTimelineWindow(db, params);
	const selected: ConversationTranscriptEntry[] = [];
	let messageCount = 0;

	for (let index = timelineItems.length - 1; index >= 0; index--) {
		const item = timelineItems[index];
		if (!item) {
			continue;
		}

		const message = mapTimelineMessage(item);
		if (message) {
			selected.push(message);
			messageCount += 1;
			if (messageCount >= MAX_CONTEXT_MESSAGES) {
				break;
			}
			continue;
		}

		const toolAction = mapTimelineToolAction(item);
		if (toolAction) {
			selected.push(toolAction);
		}
	}

	return trimTranscriptEntries(selected.reverse());
}
