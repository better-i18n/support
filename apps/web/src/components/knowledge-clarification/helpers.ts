"use client";

import type {
	KnowledgeClarificationRequest,
	KnowledgeClarificationStepResponse,
} from "@cossistant/types";

export function stepFromKnowledgeClarificationRequest(
	request: KnowledgeClarificationRequest | null | undefined
): KnowledgeClarificationStepResponse | null {
	if (!request) {
		return null;
	}

	if (request.status === "draft_ready" && request.draftFaqPayload) {
		return {
			kind: "draft_ready",
			request,
			draftFaqPayload: request.draftFaqPayload,
		};
	}

	if (request.status === "retry_required") {
		return {
			kind: "retry_required",
			request,
		};
	}

	if (
		(request.status === "awaiting_answer" ||
			request.status === "deferred" ||
			request.status === "analyzing") &&
		request.currentQuestion &&
		request.currentSuggestedAnswers
	) {
		return {
			kind: "question",
			request,
			question: request.currentQuestion,
			suggestedAnswers: request.currentSuggestedAnswers,
			inputMode: request.currentQuestionInputMode ?? "suggested_answers",
			questionScope: request.currentQuestionScope ?? "narrow_detail",
		};
	}

	return null;
}

export function shouldPreferKnowledgeClarificationRequestState(params: {
	request: KnowledgeClarificationRequest | null | undefined;
	step: KnowledgeClarificationStepResponse | null | undefined;
}): boolean {
	if (!params.request) {
		return false;
	}

	if (!params.step) {
		return true;
	}

	if (params.step.request.id !== params.request.id) {
		return true;
	}

	const requestUpdatedAtMs = Date.parse(params.request.updatedAt);
	const stepUpdatedAtMs = Date.parse(params.step.request.updatedAt);

	if (Number.isFinite(requestUpdatedAtMs) && Number.isFinite(stepUpdatedAtMs)) {
		return requestUpdatedAtMs > stepUpdatedAtMs;
	}

	return params.request.updatedAt !== params.step.request.updatedAt;
}
