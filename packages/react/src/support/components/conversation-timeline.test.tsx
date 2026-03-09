import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { TimelineItem } from "@cossistant/types/api/timeline-item";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

type MockTimelineState = {
	groupedMessages: {
		items: unknown[];
		getMessageSeenBy: (_messageId: string) => readonly string[];
	};
	processing: {
		message: string | null;
		tool: {
			toolName: string;
			state: "partial" | "result" | "error";
		} | null;
	} | null;
	typingParticipants: Array<{ id: string; type: "team_member" | "ai" }>;
	lastVisitorMessageGroupIndex: number;
};

const useConversationTimelineMock = mock(() => currentTimelineState);
const useTypingSoundMock = mock(() => {});
const useSupportTextMock = mock(
	() => (key: string) =>
		key === "common.fallbacks.supportTeam" ? "Support team" : key
);

mock.module("../../hooks/use-conversation-timeline", () => ({
	useConversationTimeline: useConversationTimelineMock,
}));

mock.module("../../hooks/use-typing-sound", () => ({
	useTypingSound: useTypingSoundMock,
}));

mock.module("../../primitives/conversation-timeline", () => ({
	ConversationTimeline: ({
		children,
	}: {
		children?:
			| React.ReactNode
			| ((props: { isEmpty: boolean }) => React.ReactNode);
	}) =>
		React.createElement(
			"div",
			{ "data-timeline-shell": "true" },
			typeof children === "function" ? children({ isEmpty: true }) : children
		),
	ConversationTimelineContainer: ({
		children,
	}: {
		children?: React.ReactNode;
	}) =>
		React.createElement("div", { "data-timeline-container": "true" }, children),
}));

mock.module("../text", () => ({
	useSupportText: useSupportTextMock,
}));

mock.module("./typing-indicator", () => ({
	TypingIndicator: ({
		participants,
	}: {
		participants: Array<{ id: string; type: string }>;
	}) =>
		React.createElement("div", {
			"data-typing-indicator": participants
				.map((participant) => `${participant.type}:${participant.id}`)
				.join(","),
		}),
}));

const conversationTimelineModulePromise = import("./conversation-timeline");

let currentTimelineState: MockTimelineState;

async function renderTimeline() {
	const { ConversationTimelineList } = await conversationTimelineModulePromise;

	return renderToStaticMarkup(
		React.createElement(ConversationTimelineList, {
			conversationId: "conv-1",
			items: [] satisfies TimelineItem[],
			availableAIAgents: [],
			availableHumanAgents: [],
			currentVisitorId: "visitor-1",
		})
	);
}

describe("ConversationTimelineList live activity", () => {
	beforeEach(() => {
		currentTimelineState = {
			groupedMessages: {
				items: [],
				getMessageSeenBy: () => [],
			},
			processing: null,
			typingParticipants: [],
			lastVisitorMessageGroupIndex: -1,
		};

		useConversationTimelineMock.mockClear();
		useTypingSoundMock.mockClear();
		useSupportTextMock.mockClear();
	});

	it("renders knowledge search status instead of AI typing dots", async () => {
		currentTimelineState = {
			...currentTimelineState,
			processing: {
				message: "Searching knowledge base...",
				tool: {
					toolName: "searchKnowledgeBase",
					state: "partial",
				},
			},
			typingParticipants: [{ id: "ai-1", type: "ai" }],
		};

		const html = await renderTimeline();

		expect(html).toContain("Searching knowledge base...");
		expect(html).not.toContain("data-typing-indicator");
		expect(useTypingSoundMock).toHaveBeenCalledWith(false, {
			volume: 1,
			playbackRate: 1.3,
		});
	});

	it("hides generic typing when only the AI is typing", async () => {
		currentTimelineState = {
			...currentTimelineState,
			typingParticipants: [{ id: "ai-1", type: "ai" }],
		};

		const html = await renderTimeline();

		expect(html).not.toContain("Searching knowledge base...");
		expect(html).not.toContain("data-typing-indicator");
		expect(useTypingSoundMock).toHaveBeenCalledWith(false, {
			volume: 1,
			playbackRate: 1.3,
		});
	});

	it("keeps unregistered tool progress hidden in the widget footer", async () => {
		currentTimelineState = {
			...currentTimelineState,
			processing: {
				message: "Analyzing conversation...",
				tool: {
					toolName: "updateSentiment",
					state: "partial",
				},
			},
		};

		const html = await renderTimeline();

		expect(html).not.toContain("Analyzing conversation...");
		expect(useTypingSoundMock).toHaveBeenCalledWith(false, {
			volume: 1,
			playbackRate: 1.3,
		});
	});

	it("keeps human typing visible when a team member is typing", async () => {
		currentTimelineState = {
			...currentTimelineState,
			typingParticipants: [{ id: "user-1", type: "team_member" }],
		};

		const html = await renderTimeline();

		expect(html).toContain('data-typing-indicator="team_member:user-1"');
		expect(useTypingSoundMock).toHaveBeenCalledWith(true, {
			volume: 1,
			playbackRate: 1.3,
		});
	});
});
