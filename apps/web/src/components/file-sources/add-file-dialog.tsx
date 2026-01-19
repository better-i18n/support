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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadZone } from "./file-upload-zone";

type AddFileDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (params: {
		title: string;
		markdown: string;
		summary?: string;
	}) => Promise<void>;
	onUpload: (files: File[]) => Promise<void>;
	isSubmitting: boolean;
	isUploading: boolean;
	isAtLimit: boolean;
	fileLimit?: number | null;
	websiteSlug: string;
	onUpgradeClick: () => void;
};

export function AddFileDialog({
	open,
	onOpenChange,
	onSubmit,
	onUpload,
	isSubmitting,
	isUploading,
	isAtLimit,
	fileLimit,
	websiteSlug,
	onUpgradeClick,
}: AddFileDialogProps) {
	const [title, setTitle] = useState("");
	const [markdown, setMarkdown] = useState("");
	const [summary, setSummary] = useState("");
	const [activeTab, setActiveTab] = useState<"manual" | "upload">("manual");

	// Check if form is valid
	const isValid = title.trim().length > 0 && markdown.trim().length > 0;

	// Reset form when dialog closes
	useEffect(() => {
		if (!open) {
			setTitle("");
			setMarkdown("");
			setSummary("");
			setActiveTab("manual");
		}
	}, [open]);

	const handleSubmit = useCallback(async () => {
		if (!isValid) {
			return;
		}

		await onSubmit({
			title: title.trim(),
			markdown: markdown.trim(),
			summary: summary.trim() || undefined,
		});
	}, [isValid, title, markdown, summary, onSubmit]);

	const handleUpload = useCallback(
		async (files: File[]) => {
			for (const file of files) {
				await onUpload([file]);
			}
		},
		[onUpload]
	);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-150">
				<DialogHeader>
					<DialogTitle>Add File</DialogTitle>
					<DialogDescription>
						Add markdown content to train your AI agent on your documentation.
					</DialogDescription>
				</DialogHeader>

				<Tabs
					onValueChange={(v) => setActiveTab(v as "manual" | "upload")}
					value={activeTab}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="manual">Manual Entry</TabsTrigger>
						<TabsTrigger value="upload">Upload File</TabsTrigger>
					</TabsList>

					<TabsContent className="mt-4 space-y-4" value="manual">
						<div className="space-y-2">
							<Label htmlFor="title">Title</Label>
							<Input
								disabled={isSubmitting}
								id="title"
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Getting Started Guide"
								value={title}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="summary">Summary (optional)</Label>
							<Input
								disabled={isSubmitting}
								id="summary"
								onChange={(e) => setSummary(e.target.value)}
								placeholder="A brief overview of how to get started..."
								value={summary}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="markdown">Content (Markdown)</Label>
							<Textarea
								className="min-h-[200px] font-mono text-sm"
								disabled={isSubmitting}
								id="markdown"
								onChange={(e) => setMarkdown(e.target.value)}
								placeholder="# Getting Started&#10;&#10;Welcome to our documentation...&#10;&#10;## Installation&#10;&#10;Run the following command..."
								value={markdown}
							/>
						</div>

						{isAtLimit && (
							<p className="text-destructive text-sm">
								You've reached your plan's limit of {fileLimit} files.{" "}
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
										Add File
									</>
								)}
							</Button>
						</DialogFooter>
					</TabsContent>

					<TabsContent className="mt-4 space-y-4" value="upload">
						<FileUploadZone
							disabled={isAtLimit}
							isUploading={isUploading}
							onUpload={handleUpload}
						/>

						{isAtLimit && (
							<p className="text-destructive text-sm">
								You've reached your plan's limit of {fileLimit} files.{" "}
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

						<DialogFooter>
							<Button onClick={() => onOpenChange(false)} variant="outline">
								Close
							</Button>
						</DialogFooter>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}

export type { AddFileDialogProps };
