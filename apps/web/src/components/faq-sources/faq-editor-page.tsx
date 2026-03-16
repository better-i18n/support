"use client";

import type { FaqKnowledgePayload } from "@cossistant/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	BotIcon,
	EyeIcon,
	EyeOffIcon,
	SaveIcon,
	Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc/client";
import {
	TrainingEntryDetailLayout,
	TrainingEntryField,
	TrainingEntryMarkdownField,
	TrainingEntrySection,
	TrainingEntryTagsField,
	useTrainingPageState,
} from "../training-entries";
import { useFaqMutations } from "./hooks/use-faq-mutations";

type FaqEditorPageProps = {
	knowledgeId?: string;
};

function splitCommaSeparated(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function FaqEditorPage({ knowledgeId }: FaqEditorPageProps) {
	const router = useRouter();
	const trpc = useTRPC();
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState("");
	const [categories, setCategories] = useState("");
	const [relatedQuestions, setRelatedQuestions] = useState("");
	const pageState = useTrainingPageState({
		highlightedFeatureKey: "ai-agent-training-faqs",
	});

	const isCreateMode = !knowledgeId;
	const listHref = `/${pageState.websiteSlug}/agent/training/faq`;
	const { data: knowledge, isLoading: isLoadingKnowledge } = useQuery({
		...trpc.knowledge.get.queryOptions({
			websiteSlug: pageState.websiteSlug,
			id: knowledgeId ?? "",
		}),
		enabled: Boolean(knowledgeId),
	});

	const {
		handleCreate,
		handleDelete,
		handleToggleIncluded,
		handleUpdate,
		isCreating,
		isDeleting,
		isToggling,
		isUpdating,
	} = useFaqMutations({
		websiteSlug: pageState.websiteSlug,
		aiAgentId: pageState.aiAgentId,
		trainingControls: pageState.trainingControls,
	});

	const startClarificationMutation = useMutation(
		trpc.knowledgeClarification.startFromFaq.mutationOptions({
			onError: (error) => {
				toast.error(error.message || "Failed to start FAQ clarification");
			},
		})
	);

	useEffect(() => {
		if (!knowledge || knowledge.type !== "faq") {
			return;
		}

		const payload = knowledge.payload as FaqKnowledgePayload;
		setQuestion(payload.question);
		setAnswer(payload.answer);
		setCategories(payload.categories.join(", "));
		setRelatedQuestions(payload.relatedQuestions.join(", "));
	}, [knowledge]);

	const isAtFaqLimit =
		pageState.stats?.planLimitFaqs !== null &&
		pageState.stats?.faqKnowledgeCount !== undefined &&
		pageState.stats.faqKnowledgeCount >= (pageState.stats.planLimitFaqs ?? 0);
	const isSaving = isCreateMode ? isCreating : isUpdating;
	const isValid = question.trim().length > 0 && answer.trim().length > 0;
	const isUnavailable =
		!(isCreateMode || isLoadingKnowledge) &&
		(!knowledge || knowledge.type !== "faq");
	const title = useMemo(() => {
		if (question.trim()) {
			return question.trim();
		}

		return isCreateMode ? "New FAQ" : "Untitled FAQ";
	}, [isCreateMode, question]);

	const handleSave = async () => {
		if (!isValid) {
			return;
		}

		if (isCreateMode && isAtFaqLimit) {
			pageState.openUpgradeModal();
			return;
		}

		const payload = {
			question: question.trim(),
			answer: answer.trim(),
			categories: splitCommaSeparated(categories),
			relatedQuestions: splitCommaSeparated(relatedQuestions),
		};

		if (isCreateMode) {
			const created = await handleCreate(payload);
			router.push(`/${pageState.websiteSlug}/agent/training/faq/${created.id}`);
			return;
		}

		if (!knowledgeId) {
			return;
		}

		await handleUpdate(knowledgeId, payload);
	};

	const handleDeleteEntry = async () => {
		if (!knowledgeId) {
			return;
		}

		await handleDelete(knowledgeId);
		router.push(listHref);
	};

	const handleToggleEntryIncluded = async () => {
		if (!(knowledgeId && knowledge)) {
			return;
		}

		await handleToggleIncluded(knowledgeId, !knowledge.isIncluded);
	};

	const handleDeepen = async () => {
		if (!knowledgeId) {
			return;
		}

		const result = await startClarificationMutation.mutateAsync({
			websiteSlug: pageState.websiteSlug,
			knowledgeId,
		});
		router.push(
			`/${pageState.websiteSlug}/agent/training/faq/proposals/${result.step.request.id}`
		);
	};

	const actionButtons = isUnavailable ? null : (
		<>
			{!isCreateMode && knowledge ? (
				<Button
					disabled={isToggling}
					onClick={handleToggleEntryIncluded}
					size="sm"
					type="button"
					variant="ghost"
				>
					{knowledge.isIncluded ? (
						<>
							<EyeOffIcon className="size-4" />
							Exclude
						</>
					) : (
						<>
							<EyeIcon className="size-4" />
							Include
						</>
					)}
				</Button>
			) : null}
			{isCreateMode ? null : (
				<Button
					disabled={startClarificationMutation.isPending || isLoadingKnowledge}
					onClick={handleDeepen}
					size="sm"
					type="button"
					variant="ghost"
				>
					{startClarificationMutation.isPending ? (
						<Spinner className="size-4" />
					) : (
						<BotIcon className="size-4" />
					)}
					Deepen with AI
				</Button>
			)}
			{isCreateMode ? null : (
				<Button
					disabled={isDeleting}
					onClick={handleDeleteEntry}
					size="sm"
					type="button"
					variant="ghost"
				>
					<Trash2Icon className="size-4" />
					Delete
				</Button>
			)}
			<Button
				disabled={!isValid || isSaving || (isCreateMode && isAtFaqLimit)}
				onClick={handleSave}
				size="sm"
				type="button"
			>
				{isSaving ? (
					<Spinner className="size-4" />
				) : (
					<SaveIcon className="size-4" />
				)}
				{isCreateMode ? "Add FAQ" : "Save changes"}
			</Button>
		</>
	);

	return (
		<>
			<TrainingEntryDetailLayout
				actions={actionButtons}
				backHref={listHref}
				sectionLabel="FAQ"
				title={title}
			>
				{isUnavailable ? (
					<TrainingEntrySection
						description="This FAQ no longer exists or cannot be edited."
						title="Unavailable"
					/>
				) : (
					<>
						<TrainingEntrySection
							description="Set the question, labels, and related topics for this knowledge entry."
							title="Details"
						>
							<TrainingEntryField
								description="This becomes the entry name in the FAQ list."
								disabled={isSaving || isLoadingKnowledge}
								id="faq-question"
								label="Question"
								onChange={setQuestion}
								placeholder="How do I reset my password?"
								value={question}
							/>
							<TrainingEntryTagsField
								description="Separate categories with commas."
								disabled={isSaving || isLoadingKnowledge}
								id="faq-categories"
								label="Categories"
								onChange={setCategories}
								placeholder="Account, Security, Getting Started"
								value={categories}
							/>
							<TrainingEntryTagsField
								description="Optional extra questions this FAQ should help cover."
								disabled={isSaving || isLoadingKnowledge}
								id="faq-related-questions"
								label="Related questions"
								onChange={setRelatedQuestions}
								placeholder="How can I change my email?, Where do I update my login?"
								value={relatedQuestions}
							/>
						</TrainingEntrySection>
						<TrainingEntrySection
							description="Write the answer in the shared markdown editor."
							title="Answer"
						>
							<TrainingEntryMarkdownField
								description="Markdown is supported, but plain text works well too."
								disabled={isSaving || isLoadingKnowledge}
								id="faq-answer"
								label="Answer"
								onChange={setAnswer}
								placeholder="To reset your password, go to Settings > Security and click Reset Password..."
								rows={12}
								value={answer}
							/>
						</TrainingEntrySection>
					</>
				)}
			</TrainingEntryDetailLayout>
			{pageState.upgradeModal}
		</>
	);
}

export type { FaqEditorPageProps };
