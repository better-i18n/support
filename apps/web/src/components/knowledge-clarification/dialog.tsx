"use client";

import type {
	ApproveKnowledgeClarificationDraftResponse,
	KnowledgeClarificationRequest,
	KnowledgeClarificationStepResponse,
} from "@cossistant/types";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { KnowledgeClarificationFlowContent } from "./flow-content";
import { useKnowledgeClarificationFlow } from "./use-clarification-flow";

type KnowledgeClarificationDialogProps = {
	websiteSlug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialStep: KnowledgeClarificationStepResponse | null;
	initialRequest?: KnowledgeClarificationRequest | null;
	onApproved?: (
		result: ApproveKnowledgeClarificationDraftResponse
	) => void | Promise<void>;
};

export function KnowledgeClarificationDialog({
	websiteSlug,
	open,
	onOpenChange,
	initialStep,
	initialRequest,
	onApproved,
}: KnowledgeClarificationDialogProps) {
	const flow = useKnowledgeClarificationFlow({
		websiteSlug,
		initialStep,
		initialRequest,
		onApproved: async (result) => {
			await onApproved?.(result);
			onOpenChange(false);
		},
		onDeferred: async () => {
			onOpenChange(false);
		},
		onDismissed: async () => {
			onOpenChange(false);
		},
	});

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-2xl" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Knowledge clarification</DialogTitle>
					<DialogDescription>
						Guide the AI toward a better FAQ draft without escalating the
						conversation.
					</DialogDescription>
				</DialogHeader>

				<KnowledgeClarificationFlowContent
					currentRequest={flow.currentRequest}
					currentStep={flow.currentStep}
					fallbackStep={flow.fallbackStep}
					isRetrying={flow.retryMutation.isPending}
					isSubmittingAnswer={flow.answerMutation.isPending}
					isSubmittingApproval={flow.approveMutation.isPending}
					onAnswer={flow.submitAnswer}
					onApprove={flow.approveDraft}
					onClose={() => onOpenChange(false)}
					onDefer={flow.deferRequest}
					onDismiss={flow.dismissRequest}
					onRetry={flow.retryRequest}
					variant="dialog"
				/>
			</DialogContent>
		</Dialog>
	);
}
