"use client";

import { PlusIcon } from "lucide-react";
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

type AddFaqDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (params: {
		question: string;
		answer: string;
		categories?: string[];
	}) => Promise<void>;
	isSubmitting: boolean;
	isAtLimit: boolean;
	faqLimit?: number | null;
	websiteSlug: string;
	onUpgradeClick: () => void;
};

export function AddFaqDialog({
	open,
	onOpenChange,
	onSubmit,
	isSubmitting,
	isAtLimit,
	faqLimit,
	websiteSlug,
	onUpgradeClick,
}: AddFaqDialogProps) {
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState("");
	const [categories, setCategories] = useState("");

	// Check if form is valid
	const isValid = question.trim().length > 0 && answer.trim().length > 0;

	// Reset form when dialog closes
	useEffect(() => {
		if (!open) {
			setQuestion("");
			setAnswer("");
			setCategories("");
		}
	}, [open]);

	const handleSubmit = useCallback(async () => {
		if (!isValid) {
			return;
		}

		const categoriesArray = categories
			.split(",")
			.map((c) => c.trim())
			.filter(Boolean);

		await onSubmit({
			question: question.trim(),
			answer: answer.trim(),
			categories: categoriesArray.length > 0 ? categoriesArray : undefined,
		});
	}, [isValid, question, answer, categories, onSubmit]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-125">
				<DialogHeader>
					<DialogTitle>Add FAQ</DialogTitle>
					<DialogDescription>
						Create a frequently asked question and answer to train your AI
						agent.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="question">Question</Label>
						<Input
							disabled={isSubmitting}
							id="question"
							onChange={(e) => setQuestion(e.target.value)}
							placeholder="How do I reset my password?"
							value={question}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="answer">Answer</Label>
						<Textarea
							disabled={isSubmitting}
							id="answer"
							onChange={(e) => setAnswer(e.target.value)}
							placeholder="To reset your password, go to Settings > Security and click 'Reset Password'..."
							rows={5}
							value={answer}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="categories">Categories (optional)</Label>
						<Input
							disabled={isSubmitting}
							id="categories"
							onChange={(e) => setCategories(e.target.value)}
							placeholder="Account, Security, Getting Started"
							value={categories}
						/>
						<p className="text-muted-foreground text-xs">
							Separate categories with commas.
						</p>
					</div>

					{isAtLimit && (
						<p className="text-destructive text-sm">
							You've reached your plan's limit of {faqLimit} FAQs.{" "}
							<button
								className="underline hover:text-destructive/80"
								onClick={onUpgradeClick}
								type="button"
							>
								Upgrade your plan
							</button>{" "}
							to add more.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button
						disabled={!isValid || isSubmitting || isAtLimit}
						onClick={handleSubmit}
					>
						{isSubmitting ? (
							<>
								<Spinner className="mr-2 h-4 w-4" />
								Adding...
							</>
						) : (
							<>
								<PlusIcon className="mr-2 h-4 w-4" />
								Add FAQ
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export type { AddFaqDialogProps };
