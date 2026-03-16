"use client";

import type { UrlKnowledgePayload } from "@cossistant/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ExternalLinkIcon,
	EyeIcon,
	EyeOffIcon,
	RefreshCwIcon,
	SaveIcon,
	Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useWebsite } from "@/contexts/website";
import { useTRPC } from "@/lib/trpc/client";
import {
	TrainingEntryDetailLayout,
	TrainingEntryField,
	TrainingEntryMarkdownField,
	TrainingEntrySection,
} from "../training-entries";

type WebPageDetailProps = {
	knowledgeId: string;
};

export function WebPageDetail({ knowledgeId }: WebPageDetailProps) {
	const website = useWebsite();
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [sourceTitle, setSourceTitle] = useState("");
	const [markdown, setMarkdown] = useState("");

	const listHref = `/${website.slug}/agent/training/web`;

	const { data: knowledge, isLoading } = useQuery(
		trpc.knowledge.get.queryOptions({
			websiteSlug: website.slug,
			id: knowledgeId,
		})
	);

	const saveMutation = useMutation(
		trpc.knowledge.update.mutationOptions({
			onSuccess: async (updated) => {
				toast.success("Page updated");
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.knowledge.get.queryKey({
							websiteSlug: website.slug,
							id: updated.id,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.knowledge.list.queryKey({
							websiteSlug: website.slug,
							type: "url",
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.linkSource.getTrainingStats.queryKey({
							websiteSlug: website.slug,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.aiAgent.getTrainingReadiness.queryKey({
							websiteSlug: website.slug,
						}),
					}),
				]);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to update page");
			},
		})
	);

	const toggleIncludedMutation = useMutation(
		trpc.knowledge.toggleIncluded.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.knowledge.get.queryKey({
							websiteSlug: website.slug,
							id: knowledgeId,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.linkSource.getTrainingStats.queryKey({
							websiteSlug: website.slug,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.aiAgent.getTrainingReadiness.queryKey({
							websiteSlug: website.slug,
						}),
					}),
				]);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to toggle inclusion");
			},
		})
	);

	const deleteMutation = useMutation(
		trpc.knowledge.delete.mutationOptions({
			onSuccess: async () => {
				toast.success("Page deleted");
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.knowledge.list.queryKey({
							websiteSlug: website.slug,
							type: "url",
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.linkSource.getTrainingStats.queryKey({
							websiteSlug: website.slug,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.aiAgent.getTrainingReadiness.queryKey({
							websiteSlug: website.slug,
						}),
					}),
				]);
				router.push(listHref);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to delete page");
			},
		})
	);

	const reindexMutation = useMutation(
		trpc.linkSource.reindexPage.mutationOptions({
			onSuccess: async (data) => {
				toast.success(`Re-indexed: ${data.sourceTitle ?? data.sourceUrl}`);
				if (!knowledge?.linkSourceId) {
					return;
				}

				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.knowledge.get.queryKey({
							websiteSlug: website.slug,
							id: knowledgeId,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.linkSource.listKnowledgeByLinkSource.queryKey({
							websiteSlug: website.slug,
							linkSourceId: knowledge.linkSourceId,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.linkSource.getTrainingStats.queryKey({
							websiteSlug: website.slug,
						}),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.aiAgent.getTrainingReadiness.queryKey({
							websiteSlug: website.slug,
						}),
					}),
				]);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to re-index page");
			},
		})
	);

	useEffect(() => {
		if (!knowledge || knowledge.type !== "url") {
			return;
		}

		const payload = knowledge.payload as UrlKnowledgePayload;
		setSourceTitle(knowledge.sourceTitle ?? "");
		setMarkdown(payload.markdown);
	}, [knowledge]);

	const headerTitle = useMemo(() => {
		if (sourceTitle.trim()) {
			return sourceTitle.trim();
		}

		return knowledge?.sourceUrl ?? "Web page";
	}, [knowledge?.sourceUrl, sourceTitle]);
	const isSaving = saveMutation.isPending;
	const canSave = markdown.trim().length > 0;

	const handleSave = async () => {
		if (!(knowledge && knowledge.type === "url" && canSave)) {
			return;
		}

		const payload = knowledge.payload as UrlKnowledgePayload;
		await saveMutation.mutateAsync({
			websiteSlug: website.slug,
			id: knowledge.id,
			sourceTitle: sourceTitle.trim() || null,
			payload: {
				...payload,
				markdown: markdown.trim(),
			},
		});
	};

	const handleToggleIncluded = async () => {
		if (!knowledge) {
			return;
		}

		await toggleIncludedMutation.mutateAsync({
			websiteSlug: website.slug,
			id: knowledge.id,
			isIncluded: !knowledge.isIncluded,
		});
	};

	const handleDelete = async () => {
		await deleteMutation.mutateAsync({
			websiteSlug: website.slug,
			id: knowledgeId,
		});
	};

	const handleReindex = async () => {
		if (!knowledge?.linkSourceId) {
			return;
		}

		await reindexMutation.mutateAsync({
			websiteSlug: website.slug,
			linkSourceId: knowledge.linkSourceId,
			knowledgeId: knowledge.id,
		});
	};

	if (!isLoading && (!knowledge || knowledge.type !== "url")) {
		return (
			<TrainingEntryDetailLayout
				backHref={listHref}
				sectionLabel="Web Sources"
				title="Page not found"
			>
				<TrainingEntrySection
					description="This crawled page no longer exists or cannot be opened."
					title="Unavailable"
				/>
			</TrainingEntryDetailLayout>
		);
	}

	return (
		<TrainingEntryDetailLayout
			actions={
				<>
					{knowledge ? (
						<Button
							disabled={toggleIncludedMutation.isPending}
							onClick={handleToggleIncluded}
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
					<Button
						disabled={reindexMutation.isPending || !knowledge?.linkSourceId}
						onClick={handleReindex}
						size="sm"
						type="button"
						variant="ghost"
					>
						{reindexMutation.isPending ? (
							<Spinner className="size-4" />
						) : (
							<RefreshCwIcon className="size-4" />
						)}
						Re-index
					</Button>
					<Button
						disabled={deleteMutation.isPending}
						onClick={handleDelete}
						size="sm"
						type="button"
						variant="ghost"
					>
						<Trash2Icon className="size-4" />
						Delete
					</Button>
					<Button
						disabled={!canSave || isSaving}
						onClick={handleSave}
						size="sm"
						type="button"
					>
						{isSaving ? (
							<Spinner className="size-4" />
						) : (
							<SaveIcon className="size-4" />
						)}
						Save changes
					</Button>
				</>
			}
			backHref={listHref}
			sectionLabel="Web Sources"
			title={headerTitle}
		>
			<TrainingEntrySection
				description="Edit the page title or open the original source URL."
				title="Source"
			>
				<TrainingEntryField
					disabled={isLoading || isSaving}
					id="web-source-title"
					label="Page title"
					onChange={setSourceTitle}
					placeholder="Getting Started"
					value={sourceTitle}
				/>
				<div className="space-y-2">
					<div className="font-medium text-sm">Source URL</div>
					{knowledge?.sourceUrl ? (
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<a
								className="min-w-0 truncate text-primary underline"
								href={knowledge.sourceUrl}
								rel="noopener noreferrer"
								target="_blank"
							>
								{knowledge.sourceUrl}
							</a>
							<Button asChild size="sm" variant="ghost">
								<a
									href={knowledge.sourceUrl}
									rel="noopener noreferrer"
									target="_blank"
								>
									<ExternalLinkIcon className="size-4" />
									Open original
								</a>
							</Button>
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							No source URL saved.
						</p>
					)}
				</div>
			</TrainingEntrySection>
			<TrainingEntrySection
				description="Edit the crawled markdown content directly."
				title="Content"
			>
				<TrainingEntryMarkdownField
					disabled={isLoading || isSaving}
					id="web-markdown"
					label="Markdown"
					onChange={setMarkdown}
					placeholder="# Page content"
					value={markdown}
				/>
			</TrainingEntrySection>
		</TrainingEntryDetailLayout>
	);
}

export type { WebPageDetailProps };
