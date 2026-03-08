import type { ModelMessage } from "@api/lib/ai";
import {
	type ConversationTranscriptEntry,
	isConversationToolAction,
	type RoleAwareMessage,
} from "../../../primary-pipeline/contracts";

function normalizeText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function buildMessagePrefix(message: RoleAwareMessage): string {
	const privatePrefix = message.visibility === "private" ? "[PRIVATE]" : "";

	switch (message.senderType) {
		case "visitor":
			return `${privatePrefix}[VISITOR]`;
		case "human_agent":
			return `${privatePrefix}[TEAM]`;
		case "ai_agent":
			return privatePrefix;
		default:
			return privatePrefix;
	}
}

export function buildGenerationMessages(
	history: ConversationTranscriptEntry[]
): ModelMessage[] {
	const formatted: ModelMessage[] = [];

	for (const entry of history) {
		const normalizedContent = normalizeText(entry.content);
		if (!normalizedContent) {
			continue;
		}

		if (isConversationToolAction(entry)) {
			formatted.push({
				role: "assistant",
				content: normalizedContent,
			});
			continue;
		}

		const prefix = buildMessagePrefix(entry);
		const content = [prefix, normalizedContent].filter(Boolean).join(" ");
		const role = entry.senderType === "ai_agent" ? "assistant" : "user";

		formatted.push({
			role,
			content,
		});
	}

	return formatted;
}
