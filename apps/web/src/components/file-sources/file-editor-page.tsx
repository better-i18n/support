"use client";

import type { ArticleKnowledgePayload } from "@cossistant/types";
import { useQuery } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/lib/trpc/client";
import {
	TrainingEntryDetailLayout,
	TrainingEntrySection,
	useTrainingPageState,
} from "../training-entries";
import { FileManualEntryFields } from "./file-manual-entry-fields";
import { FileUploadZone } from "./file-upload-zone";
import { useFileMutations } from "./hooks/use-file-mutations";

type FileEditorPageProps = {
	knowledgeId?: string;
};

export function FileEditorPage({ knowledgeId }: FileEditorPageProps) {
	const router = useRouter();
	const trpc = useTRPC();
	const [activeTab, setActiveTab] = useState<"manual" | "upload">("manual");
	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [markdown, setMarkdown] = useState("");
	const pageState = useTrainingPageState({
		highlightedFeatureKey: "ai-agent-training-files",
	});

	const isCreateMode = !knowledgeId;
	const listHref = `/${pageState.websiteSlug}/agent/training/files`;
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
		handleUpload,
		isCreating,
		isDeleting,
		isToggling,
		isUpdating,
		isUploading,
	} = useFileMutations({
		websiteSlug: pageState.websiteSlug,
		aiAgentId: pageState.aiAgentId,
		trainingControls: pageState.trainingControls,
	});

	useEffect(() => {
		if (!knowledge || knowledge.type !== "article") {
			return;
		}

		const payload = knowledge.payload as ArticleKnowledgePayload;
		setTitle(payload.title);
		setSummary(payload.summary ?? "");
		setMarkdown(payload.markdown);
	}, [knowledge]);

	const isAtFileLimit =
		pageState.stats?.planLimitFiles !== null &&
		pageState.stats?.articleKnowledgeCount !== undefined &&
		pageState.stats.articleKnowledgeCount >=
			(pageState.stats.planLimitFiles ?? 0);
	const isSaving = isCreateMode ? isCreating : isUpdating;
	const isValid = title.trim().length > 0 && markdown.trim().length > 0;
	const isUnavailable =
		!(isCreateMode || isLoadingKnowledge) &&
		(!knowledge || knowledge.type !== "article");
	const headerTitle = useMemo(() => {
		if (title.trim()) {
			return title.trim();
		}

		return isCreateMode ? "New file" : "Untitled file";
	}, [isCreateMode, title]);

	const handleSave = async () => {
		if (!isValid) {
			return;
		}

		if (isCreateMode && isAtFileLimit) {
			pageState.openUpgradeModal();
			return;
		}

		const payload = {
			title: title.trim(),
			summary: summary.trim() || undefined,
			markdown: markdown.trim(),
		};

		if (isCreateMode) {
			const created = await handleCreate(payload);
			router.push(
				`/${pageState.websiteSlug}/agent/training/files/${created.id}`
			);
			return;
		}

		if (!knowledgeId) {
			return;
		}

		await handleUpdate(knowledgeId, payload);
	};

	const handleUploadFiles = async (files: File[]) => {
		if (isAtFileLimit) {
			pageState.openUpgradeModal();
			return;
		}

		let lastUploadedId: string | null = null;
		for (const file of files) {
			const uploaded = await handleUpload(file);
			lastUploadedId = uploaded.id;
		}

		if (files.length === 1 && lastUploadedId) {
			router.push(
				`/${pageState.websiteSlug}/agent/training/files/${lastUploadedId}`
			);
			return;
		}

		router.push(listHref);
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
			{activeTab === "manual" ? (
				<Button
					disabled={!isValid || isSaving || (isCreateMode && isAtFileLimit)}
					onClick={handleSave}
					size="sm"
					type="button"
				>
					{isSaving ? (
						<Spinner className="size-4" />
					) : (
						<SaveIcon className="size-4" />
					)}
					{isCreateMode ? "Add file" : "Save changes"}
				</Button>
			) : null}
		</>
	);

	return (
		<>
			<TrainingEntryDetailLayout
				actions={actionButtons}
				backHref={listHref}
				sectionLabel="Files"
				title={headerTitle}
			>
				{isUnavailable ? (
					<TrainingEntrySection
						description="This file no longer exists or cannot be edited."
						title="Unavailable"
					/>
				) : isCreateMode ? (
					<Tabs
						onValueChange={(value) =>
							setActiveTab(value as "manual" | "upload")
						}
						value={activeTab}
					>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="manual">Manual Entry</TabsTrigger>
							<TabsTrigger value="upload">Upload File</TabsTrigger>
						</TabsList>
						<TabsContent className="space-y-6 pt-2" value="manual">
							<FileManualEntryFields
								disabled={isSaving}
								markdown={markdown}
								onMarkdownChange={setMarkdown}
								onSummaryChange={setSummary}
								onTitleChange={setTitle}
								summary={summary}
								title={title}
							/>
						</TabsContent>
						<TabsContent className="space-y-6 pt-2" value="upload">
							<TrainingEntrySection
								description="Upload markdown or text files and we will convert them into training entries."
								title="Upload"
							>
								<FileUploadZone
									disabled={isAtFileLimit}
									isUploading={isUploading}
									onUpload={handleUploadFiles}
								/>
							</TrainingEntrySection>
						</TabsContent>
					</Tabs>
				) : (
					<FileManualEntryFields
						disabled={isSaving || isLoadingKnowledge}
						markdown={markdown}
						onMarkdownChange={setMarkdown}
						onSummaryChange={setSummary}
						onTitleChange={setTitle}
						summary={summary}
						title={title}
					/>
				)}
			</TrainingEntryDetailLayout>
			{pageState.upgradeModal}
		</>
	);
}

export type { FileEditorPageProps };
