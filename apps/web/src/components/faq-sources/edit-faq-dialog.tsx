"use client";

import type { FaqKnowledgePayload, KnowledgeResponse } from "@cossistant/types";
import { SaveIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type EditFaqDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	faq: KnowledgeResponse | null;
	onSubmit: (
		id: string,
		params: {
			question: string;
			answer: string;
			categories?: string[];
		}
	) => Promise<void>;
	isSubmitting: boolean;
};

export function EditFaqDialog({
	open,
	onOpenChange,
	faq,
	onSubmit,
	isSubmitting,
}: EditFaqDialogProps) {
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState("");
	const [categories, setCategories] = useState("");

	// Check if form is valid
	const isValid = question.trim().length > 0 && answer.trim().length > 0;

	// Populate form when FAQ changes
	useEffect(() => {
		if (faq && open) {
			const payload = faq.payload as FaqKnowledgePayload;
			setQuestion(payload.question);
			setAnswer(payload.answer);
			setCategories(payload.categories?.join(", ") ?? "");
		}
	}, [faq, open]);

	// Reset form when dialog closes
	useEffect(() => {
		if (!open) {
			setQuestion("");
			setAnswer("");
			setCategories("");
		}
	}, [open]);

	const handleSubmit = useCallback(async () => {
		if (!(isValid && faq)) {
			return;
		}

		const categoriesArray = categories
			.split(",")
			.map((c) => c.trim())
			.filter(Boolean);

		await onSubmit(faq.id, {
			question: question.trim(),
			answer: answer.trim(),
			categories: categoriesArray.length > 0 ? categoriesArray : undefined,
		});
	}, [isValid, faq, question, answer, categories, onSubmit]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-125">
				<DialogHeader>
					<DialogTitle>Edit FAQ</DialogTitle>
					<DialogDescription>
						Update this frequently asked question and answer.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="edit-question">Question</Label>
						<Input
							disabled={isSubmitting}
							id="edit-question"
							onChange={(e) => setQuestion(e.target.value)}
							placeholder="How do I reset my password?"
							value={question}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-answer">Answer</Label>
						<Textarea
							disabled={isSubmitting}
							id="edit-answer"
							onChange={(e) => setAnswer(e.target.value)}
							placeholder="To reset your password, go to Settings > Security and click 'Reset Password'..."
							rows={5}
							value={answer}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-categories">Categories (optional)</Label>
						<Input
							disabled={isSubmitting}
							id="edit-categories"
							onChange={(e) => setCategories(e.target.value)}
							placeholder="Account, Security, Getting Started"
							value={categories}
						/>
						<p className="text-muted-foreground text-xs">
							Separate categories with commas.
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button disabled={!isValid || isSubmitting} onClick={handleSubmit}>
						{isSubmitting ? (
							<>
								<Spinner className="mr-2 h-4 w-4" />
								Saving...
							</>
						) : (
							<>
								<SaveIcon className="mr-2 h-4 w-4" />
								Save Changes
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export type { EditFaqDialogProps };
