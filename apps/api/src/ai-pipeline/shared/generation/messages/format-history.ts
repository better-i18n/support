import type { RoleAwareMessage } from "../../../primary-pipeline/contracts";

export type GenerationHistoryMessage = {
	role: "user" | "assistant";
	content: string;
};

function normalizeText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function buildSpeakerPrefix(params: {
	message: RoleAwareMessage;
	visitorName: string | null;
}): string {
	const privatePrefix =
		params.message.visibility === "private" ? "[PRIVATE]" : "";

	switch (params.message.senderType) {
		case "visitor":
			return params.visitorName
				? `[VISITOR:${params.visitorName}]`
				: "[VISITOR]";
		case "human_agent":
			return `${privatePrefix}[TEAM:${params.message.senderName || "Team Member"}]`;
		case "ai_agent":
			return `${privatePrefix}[AI]`;
		default:
			return privatePrefix || "[UNKNOWN]";
	}
}

export function formatHistoryForGeneration(
	history: RoleAwareMessage[],
	visitorName: string | null
): GenerationHistoryMessage[] {
	const formatted: GenerationHistoryMessage[] = [];

	for (const message of history) {
		const normalizedContent = normalizeText(message.content);
		if (!normalizedContent) {
			continue;
		}

		const role = message.senderType === "visitor" ? "user" : "assistant";
		const prefix = buildSpeakerPrefix({
			message,
			visitorName,
		});

		formatted.push({
			role,
			content: `${prefix} ${normalizedContent}`.trim(),
		});
	}

	return formatted;
}
