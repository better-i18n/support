import {
	type ConversationTranscriptEntry,
	isConversationMessage,
	isConversationToolAction,
	type RoleAwareMessage,
} from "../../../contracts";
import type { DecisionSignals, SmartDecisionInput } from "./types";

const MESSAGE_CHAR_LIMIT = 220;
const MAX_MESSAGES = 14;
const MAX_HUMAN_CONTEXT_MESSAGES = 4;
const MAX_TRANSCRIPT_ENTRIES = 22;

function normalizeText(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function clipText(text: string, maxChars: number): string {
	const normalized = normalizeText(text);
	if (normalized.length <= maxChars) {
		return normalized;
	}
	return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
}

function formatPromptMessage(message: RoleAwareMessage): string {
	const privatePrefix = message.visibility === "private" ? "[PRIVATE] " : "";
	const senderPrefix =
		message.senderType === "visitor"
			? "[VISITOR]"
			: message.senderType === "human_agent"
				? "[TEAM]"
				: "";

	return [
		privatePrefix.trim(),
		senderPrefix,
		clipText(message.content, MESSAGE_CHAR_LIMIT),
	]
		.filter(Boolean)
		.join(" ");
}

function formatTranscriptEntry(entry: ConversationTranscriptEntry): string {
	if (isConversationToolAction(entry)) {
		return clipText(entry.content, MESSAGE_CHAR_LIMIT);
	}

	return formatPromptMessage(entry);
}

function selectRelevantTranscript(
	history: ConversationTranscriptEntry[],
	triggerMessage: RoleAwareMessage
): ConversationTranscriptEntry[] {
	const messages = history.filter(isConversationMessage);
	if (messages.length === 0 || history.length === 0) {
		return [];
	}

	const selected: RoleAwareMessage[] = [];
	const seenMessageIds = new Set<string>();
	const messageIndexes = new Map<string, number>();
	const transcriptIndexes = new Map<string, number>();

	for (let index = 0; index < messages.length; index++) {
		const message = messages[index];
		if (!message) {
			continue;
		}
		messageIndexes.set(message.messageId, index);
	}

	for (let index = 0; index < history.length; index++) {
		const entry = history[index];
		if (entry && isConversationMessage(entry)) {
			transcriptIndexes.set(entry.messageId, index);
		}
	}

	const addMessage = (message: RoleAwareMessage) => {
		if (seenMessageIds.has(message.messageId)) {
			return;
		}
		seenMessageIds.add(message.messageId);
		selected.push(message);
	};

	const currentBurst: RoleAwareMessage[] = [];
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!message) {
			continue;
		}
		if (message.senderType !== triggerMessage.senderType) {
			break;
		}
		currentBurst.unshift(message);
	}

	const currentBurstStartIndex = messages.length - currentBurst.length;
	const exchangeContext: RoleAwareMessage[] = [];
	let senderSwitches = 0;
	let previousSenderType: RoleAwareMessage["senderType"] | null = null;

	for (
		let index = currentBurstStartIndex - 1;
		index >= 0 && senderSwitches < 4;
		index--
	) {
		const message = messages[index];
		if (!message) {
			continue;
		}

		exchangeContext.unshift(message);
		if (message.senderType !== previousSenderType) {
			senderSwitches++;
			previousSenderType = message.senderType;
		}
	}

	const recentHumanMessages: RoleAwareMessage[] = [];
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!message || message.senderType !== "human_agent") {
			continue;
		}
		recentHumanMessages.unshift(message);
		if (recentHumanMessages.length >= MAX_HUMAN_CONTEXT_MESSAGES) {
			break;
		}
	}

	for (const message of recentHumanMessages) {
		addMessage(message);
	}
	for (const message of exchangeContext) {
		addMessage(message);
	}
	for (const message of currentBurst) {
		addMessage(message);
	}

	const selectedMessages = selected
		.sort((a, b) => {
			const aIndex = messageIndexes.get(a.messageId) ?? 0;
			const bIndex = messageIndexes.get(b.messageId) ?? 0;
			return aIndex - bIndex;
		})
		.slice(-MAX_MESSAGES);

	if (selectedMessages.length === 0) {
		return [];
	}

	const transcriptRangeIndexes = selectedMessages
		.map((message) => transcriptIndexes.get(message.messageId))
		.filter((index): index is number => typeof index === "number");
	const rangeStart = Math.min(...transcriptRangeIndexes);
	const rangeEnd = Math.max(...transcriptRangeIndexes);

	return history.slice(rangeStart, rangeEnd + 1).slice(-MAX_TRANSCRIPT_ENTRIES);
}

export function buildSmartDecisionPrompt(
	input: SmartDecisionInput,
	signals: DecisionSignals
): string {
	const historyWithoutTrigger = input.conversationHistory.filter(
		(entry) =>
			!(
				isConversationMessage(entry) &&
				entry.messageId === input.triggerMessage.messageId
			)
	);

	const relevantEntries = selectRelevantTranscript(
		historyWithoutTrigger,
		input.triggerMessage
	);

	const formattedHistory =
		relevantEntries.length > 0
			? relevantEntries.map(formatTranscriptEntry).join("\n")
			: "- (none)";

	return `You are the decision gate for a support AI.

Pick one intent:
- respond: AI should take this turn now
- observe: AI should not act this turn
- assist_team: internal/private help only (no visitor-facing message)

Intent guidance:
- For visitor triggers, "respond" means reply to the visitor.
- For human-agent triggers, "respond" means execute the teammate's request (can be public or private as needed).
- "assist_team" means leave internal guidance only.

Decision policy (from decision.md):
${input.decisionPolicy}

Signals:
- triggerSender=${input.triggerMessage.senderType}
- triggerVisibility=${input.triggerMessage.visibility}
- triggerLooksLikeHumanCommand=${signals.triggerLooksLikeHumanCommand}
- humanActive=${signals.humanActive}
- lastHumanSecondsAgo=${signals.lastHumanSecondsAgo ?? "none"}
- messagesSinceHuman=${signals.messagesSinceHuman >= 0 ? signals.messagesSinceHuman : "none"}
- hasHumanAssignee=${input.conversationState.hasHumanAssignee}
- escalated=${input.conversationState.isEscalated}
- visitorBurst=${signals.visitorBurstCount}
- recentTurns=${signals.recentTurnPattern || "none"}

Conversation:
${formattedHistory}

Latest trigger:
${formatPromptMessage(input.triggerMessage)}

Return concise reasoning (max 1 sentence).`;
}
