import { describe, expect, it } from "bun:test";
import type { KnowledgeClarificationRequest } from "@cossistant/types";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KnowledgeClarificationFlowContent } from "./flow-content";

function createRequest(
	overrides: Partial<KnowledgeClarificationRequest> = {}
): KnowledgeClarificationRequest {
	return {
		id: "req_1",
		organizationId: "org_1",
		websiteId: "site_1",
		aiAgentId: "agent_1",
		conversationId: "conv_1",
		source: "conversation",
		status: "awaiting_answer",
		topicSummary: "Clarify billing timing",
		stepIndex: 1,
		maxSteps: 3,
		targetKnowledgeId: null,
		currentQuestion: null,
		currentSuggestedAnswers: null,
		currentQuestionInputMode: null,
		currentQuestionScope: null,
		draftFaqPayload: null,
		lastError: null,
		createdAt: "2026-03-17T10:00:00.000Z",
		updatedAt: "2026-03-17T10:00:00.000Z",
		...overrides,
	};
}

describe("KnowledgeClarificationFlowContent terminal states", () => {
	it("renders a read-only applied state for already-approved clarifications", () => {
		const html = renderToStaticMarkup(
			<KnowledgeClarificationFlowContent
				currentRequest={createRequest({
					status: "applied",
					draftFaqPayload: {
						title: "Billing timing",
						question: "When does billing change take effect?",
						answer: "At the next billing cycle.",
						categories: ["Billing"],
						relatedQuestions: [],
					},
				})}
				currentStep={null}
				fallbackStep={null}
				onAnswer={() => {}}
				onApprove={() => {}}
				onClose={() => {}}
				onDefer={() => {}}
				onDismiss={() => {}}
				onRetry={() => {}}
				variant="page"
			/>
		);

		expect(html).toContain("Already applied");
		expect(html).not.toContain("Approve");
		expect(html).not.toContain("Retry");
	});

	it("renders a read-only dismissed state for removed clarifications", () => {
		const html = renderToStaticMarkup(
			<KnowledgeClarificationFlowContent
				currentRequest={createRequest({
					status: "dismissed",
				})}
				currentStep={null}
				fallbackStep={null}
				onAnswer={() => {}}
				onApprove={() => {}}
				onClose={() => {}}
				onDefer={() => {}}
				onDismiss={() => {}}
				onRetry={() => {}}
				variant="page"
			/>
		);

		expect(html).toContain("Dismissed");
		expect(html).not.toContain("Approve");
		expect(html).not.toContain("Retry");
	});
});
