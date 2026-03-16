"use client";

import type { KnowledgeClarificationDraftFaq } from "@cossistant/types";
import { useEffect, useState } from "react";
import {
	TrainingEntryField,
	TrainingEntryMarkdownField,
	TrainingEntrySection,
	TrainingEntryTagsField,
} from "@/components/training-entries";
import { Button } from "@/components/ui/button";

type KnowledgeClarificationDraftReviewProps = {
	draft: KnowledgeClarificationDraftFaq;
	onApprove: (draft: KnowledgeClarificationDraftFaq) => void | Promise<void>;
	onDismiss?: () => void | Promise<void>;
	isSubmitting?: boolean;
	title?: string;
	description?: string;
};

export function KnowledgeClarificationDraftReview({
	draft,
	onApprove,
	onDismiss,
	isSubmitting = false,
	title = "Review FAQ draft",
	description = "Tweak the proposed FAQ before adding it to the knowledge base.",
}: KnowledgeClarificationDraftReviewProps) {
	const [draftTitle, setDraftTitle] = useState(draft.title ?? "");
	const [question, setQuestion] = useState(draft.question);
	const [answer, setAnswer] = useState(draft.answer);
	const [categories, setCategories] = useState(draft.categories.join(", "));
	const [relatedQuestions, setRelatedQuestions] = useState(
		draft.relatedQuestions.join(", ")
	);

	useEffect(() => {
		setDraftTitle(draft.title ?? "");
		setQuestion(draft.question);
		setAnswer(draft.answer);
		setCategories(draft.categories.join(", "));
		setRelatedQuestions(draft.relatedQuestions.join(", "));
	}, [draft]);

	return (
		<div className="space-y-4">
			<TrainingEntrySection description={description} title={title}>
				<TrainingEntryField
					id="clarification-draft-title"
					label="Proposal title"
					onChange={setDraftTitle}
					placeholder="Optional internal title"
					value={draftTitle}
				/>
				<TrainingEntryField
					id="clarification-draft-question"
					label="FAQ question"
					onChange={setQuestion}
					placeholder="How does this work?"
					value={question}
				/>
				<TrainingEntryMarkdownField
					id="clarification-draft-answer"
					label="FAQ answer"
					onChange={setAnswer}
					rows={10}
					value={answer}
				/>
				<TrainingEntryTagsField
					id="clarification-draft-categories"
					label="Categories"
					onChange={setCategories}
					placeholder="Billing, Plans, Limits"
					value={categories}
				/>
				<TrainingEntryTagsField
					id="clarification-draft-related"
					label="Related questions"
					onChange={setRelatedQuestions}
					placeholder="Comma-separated related questions"
					value={relatedQuestions}
				/>
			</TrainingEntrySection>
			<div className="flex items-center justify-between gap-3">
				<Button
					disabled={isSubmitting}
					onClick={() => {
						void onDismiss?.();
					}}
					type="button"
					variant="ghost"
				>
					Close
				</Button>
				<Button
					disabled={isSubmitting || !question.trim() || !answer.trim()}
					onClick={() => {
						void onApprove({
							title: draftTitle.trim() || null,
							question: question.trim(),
							answer: answer.trim(),
							categories: categories
								.split(",")
								.map((value) => value.trim())
								.filter(Boolean),
							relatedQuestions: relatedQuestions
								.split(",")
								.map((value) => value.trim())
								.filter(Boolean),
						});
					}}
					type="button"
				>
					{isSubmitting ? "Applying..." : "Approve draft"}
				</Button>
			</div>
		</div>
	);
}
