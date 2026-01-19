"use client";

import type {
	ArticleKnowledgePayload,
	KnowledgeResponse,
} from "@cossistant/types";
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

type EditFileDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	file: KnowledgeResponse | null;
	onSubmit: (
		id: string,
		params: {
			title: string;
			markdown: string;
			summary?: string;
		}
	) => Promise<void>;
	isSubmitting: boolean;
};

export function EditFileDialog({
	open,
	onOpenChange,
	file,
	onSubmit,
	isSubmitting,
}: EditFileDialogProps) {
	const [title, setTitle] = useState("");
	const [markdown, setMarkdown] = useState("");
	const [summary, setSummary] = useState("");

	// Check if form is valid
	const isValid = title.trim().length > 0 && markdown.trim().length > 0;

	// Populate form when file changes
	useEffect(() => {
		if (file && open) {
			const payload = file.payload as ArticleKnowledgePayload;
			setTitle(payload.title);
			setMarkdown(payload.markdown);
			setSummary(payload.summary ?? "");
		}
	}, [file, open]);

	// Reset form when dialog closes
	useEffect(() => {
		if (!open) {
			setTitle("");
			setMarkdown("");
			setSummary("");
		}
	}, [open]);

	const handleSubmit = useCallback(async () => {
		if (!(isValid && file)) {
			return;
		}

		await onSubmit(file.id, {
			title: title.trim(),
			markdown: markdown.trim(),
			summary: summary.trim() || undefined,
		});
	}, [isValid, file, title, markdown, summary, onSubmit]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-150">
				<DialogHeader>
					<DialogTitle>Edit File</DialogTitle>
					<DialogDescription>
						Update the content of this file.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="edit-title">Title</Label>
						<Input
							disabled={isSubmitting}
							id="edit-title"
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Getting Started Guide"
							value={title}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-summary">Summary (optional)</Label>
						<Input
							disabled={isSubmitting}
							id="edit-summary"
							onChange={(e) => setSummary(e.target.value)}
							placeholder="A brief overview of how to get started..."
							value={summary}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-markdown">Content (Markdown)</Label>
						<Textarea
							className="min-h-[200px] font-mono text-sm"
							disabled={isSubmitting}
							id="edit-markdown"
							onChange={(e) => setMarkdown(e.target.value)}
							placeholder="# Getting Started&#10;&#10;Welcome to our documentation..."
							value={markdown}
						/>
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

export type { EditFileDialogProps };
