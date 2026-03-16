"use client";

import type {
	ApproveKnowledgeClarificationDraftResponse,
	KnowledgeClarificationDraftFaq,
	KnowledgeClarificationRequest,
	KnowledgeClarificationStepResponse,
} from "@cossistant/types";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { stepFromKnowledgeClarificationRequest } from "./helpers";
import { useKnowledgeClarificationQueryInvalidation } from "./use-query-invalidation";

type UseKnowledgeClarificationFlowOptions = {
	websiteSlug: string;
	initialStep?: KnowledgeClarificationStepResponse | null;
	initialRequest?: KnowledgeClarificationRequest | null;
	onApproved?: (
		result: ApproveKnowledgeClarificationDraftResponse
	) => void | Promise<void>;
	onDeferred?: (request: KnowledgeClarificationRequest) => void | Promise<void>;
	onDismissed?: (
		request: KnowledgeClarificationRequest
	) => void | Promise<void>;
};

export function useKnowledgeClarificationFlow({
	websiteSlug,
	initialStep = null,
	initialRequest = null,
	onApproved,
	onDeferred,
	onDismissed,
}: UseKnowledgeClarificationFlowOptions) {
	const trpc = useTRPC();
	const invalidateQueries =
		useKnowledgeClarificationQueryInvalidation(websiteSlug);
	const [step, setStep] = useState<KnowledgeClarificationStepResponse | null>(
		initialStep
	);
	const [requestFallback, setRequestFallback] =
		useState<KnowledgeClarificationRequest | null>(
			initialRequest ?? initialStep?.request ?? null
		);

	useEffect(() => {
		setStep(initialStep);
		setRequestFallback(initialRequest ?? initialStep?.request ?? null);
	}, [initialRequest, initialStep]);

	const answerMutation = useMutation(
		trpc.knowledgeClarification.answer.mutationOptions({
			onSuccess: async (result) => {
				setStep(result.step);
				setRequestFallback(result.step.request);
				await invalidateQueries({
					request: result.step.request,
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to submit clarification answer");
			},
		})
	);

	const deferMutation = useMutation(
		trpc.knowledgeClarification.defer.mutationOptions({
			onSuccess: async (request) => {
				await invalidateQueries({ request });
				await onDeferred?.(request);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to save clarification for later");
			},
		})
	);

	const dismissMutation = useMutation(
		trpc.knowledgeClarification.dismiss.mutationOptions({
			onSuccess: async (request) => {
				await invalidateQueries({ request });
				await onDismissed?.(request);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to remove clarification");
			},
		})
	);

	const retryMutation = useMutation(
		trpc.knowledgeClarification.retry.mutationOptions({
			onSuccess: async (result) => {
				setStep(result.step);
				setRequestFallback(result.step.request);
				await invalidateQueries({
					request: result.step.request,
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to retry clarification");
			},
		})
	);

	const approveMutation = useMutation(
		trpc.knowledgeClarification.approveDraft.mutationOptions({
			onSuccess: async (result) => {
				await invalidateQueries({
					request: result.request,
					includeKnowledgeQueries: true,
				});
				await onApproved?.(result);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to approve draft");
			},
		})
	);

	const currentRequest = step?.request ?? requestFallback;
	const fallbackStep = currentRequest
		? stepFromKnowledgeClarificationRequest(currentRequest)
		: null;

	return {
		currentRequest,
		currentStep: step,
		fallbackStep,
		answerMutation,
		deferMutation,
		dismissMutation,
		retryMutation,
		approveMutation,
		submitAnswer: async (
			requestId: string,
			payload: {
				selectedAnswer?: string;
				freeAnswer?: string;
			}
		) =>
			await answerMutation.mutateAsync({
				websiteSlug,
				requestId,
				...payload,
			}),
		deferRequest: async (requestId: string) =>
			await deferMutation.mutateAsync({
				websiteSlug,
				requestId,
			}),
		dismissRequest: async (requestId: string) =>
			await dismissMutation.mutateAsync({
				websiteSlug,
				requestId,
			}),
		retryRequest: async (requestId: string) =>
			await retryMutation.mutateAsync({
				websiteSlug,
				requestId,
			}),
		approveDraft: async (
			requestId: string,
			draft: KnowledgeClarificationDraftFaq
		) =>
			await approveMutation.mutateAsync({
				websiteSlug,
				requestId,
				draft,
			}),
	};
}

export type { UseKnowledgeClarificationFlowOptions };
