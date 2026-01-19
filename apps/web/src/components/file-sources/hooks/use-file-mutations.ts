"use client";

import type { ArticleKnowledgePayload } from "@cossistant/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

// Regex for removing file extensions
const FILE_EXTENSION_REGEX = /\.(md|txt)$/;

type UseFileMutationsOptions = {
	websiteSlug: string;
	aiAgentId: string | null;
	onCreateSuccess?: () => void;
	onUpdateSuccess?: () => void;
	onUploadSuccess?: () => void;
};

export function useFileMutations({
	websiteSlug,
	aiAgentId,
	onCreateSuccess,
	onUpdateSuccess,
	onUploadSuccess,
}: UseFileMutationsOptions) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Create file mutation (manual entry) with optimistic updates
	const createMutation = useMutation(
		trpc.knowledge.create.mutationOptions({
			onMutate: async (newData) => {
				// Cancel outgoing refetches
				await queryClient.cancelQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});

				// Snapshot previous value
				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					})
				);

				// Optimistically add the new file
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					}),
					(old) => {
						if (!old) {
							return old;
						}

						const articlePayload = newData.payload as ArticleKnowledgePayload;
						const optimisticFile = {
							id: `optimistic-${Date.now()}`,
							organizationId: "",
							websiteId: "",
							aiAgentId: aiAgentId ?? null,
							linkSourceId: null,
							type: "article" as const,
							sourceUrl: null,
							sourceTitle: articlePayload.title,
							origin: "manual",
							createdBy: "",
							contentHash: "",
							payload: articlePayload,
							metadata: undefined,
							isIncluded: true,
							sizeBytes: 0,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							deletedAt: null,
						};

						return {
							...old,
							items: [optimisticFile, ...old.items],
							pagination: {
								...old.pagination,
								total: old.pagination.total + 1,
							},
						};
					}
				);

				return { previousData };
			},
			onError: (_error, _variables, context) => {
				// Rollback on error
				if (context?.previousData) {
					queryClient.setQueryData(
						trpc.knowledge.list.queryKey({
							websiteSlug,
							type: "article",
							aiAgentId,
						}),
						context.previousData
					);
				}
				toast.error(_error.message || "Failed to add file");
			},
			onSuccess: () => {
				toast.success("File added");
				onCreateSuccess?.();
			},
			onSettled: () => {
				// Refetch after mutation
				void queryClient.invalidateQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});
				void queryClient.invalidateQueries({
					queryKey: trpc.linkSource.getTrainingStats.queryKey({
						websiteSlug,
					}),
				});
			},
		})
	);

	// Upload file mutation
	const uploadMutation = useMutation(
		trpc.knowledge.uploadFile.mutationOptions({
			onMutate: async (newData) => {
				// Cancel outgoing refetches
				await queryClient.cancelQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});

				// Snapshot previous value
				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					})
				);

				// Optimistically add the new file
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					}),
					(old) => {
						if (!old) {
							return old;
						}

						const optimisticFile = {
							id: `optimistic-${Date.now()}`,
							organizationId: "",
							websiteId: "",
							aiAgentId: aiAgentId ?? null,
							linkSourceId: null,
							type: "article" as const,
							sourceUrl: null,
							sourceTitle: newData.fileName.replace(FILE_EXTENSION_REGEX, ""),
							origin: "file-upload",
							createdBy: "",
							contentHash: "",
							payload: {
								title: newData.fileName.replace(FILE_EXTENSION_REGEX, ""),
								summary: null,
								markdown: newData.fileContent,
								keywords: [],
							},
							metadata: undefined,
							isIncluded: true,
							sizeBytes: new TextEncoder().encode(newData.fileContent).length,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							deletedAt: null,
						};

						return {
							...old,
							items: [optimisticFile, ...old.items],
							pagination: {
								...old.pagination,
								total: old.pagination.total + 1,
							},
						};
					}
				);

				return { previousData };
			},
			onError: (_error, _variables, context) => {
				// Rollback on error
				if (context?.previousData) {
					queryClient.setQueryData(
						trpc.knowledge.list.queryKey({
							websiteSlug,
							type: "article",
							aiAgentId,
						}),
						context.previousData
					);
				}
				toast.error(_error.message || "Failed to upload file");
			},
			onSuccess: (data) => {
				toast.success(`File uploaded: ${data.sourceTitle}`);
				onUploadSuccess?.();
			},
			onSettled: () => {
				// Refetch after mutation
				void queryClient.invalidateQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});
				void queryClient.invalidateQueries({
					queryKey: trpc.linkSource.getTrainingStats.queryKey({
						websiteSlug,
					}),
				});
			},
		})
	);

	// Update file mutation
	const updateMutation = useMutation(
		trpc.knowledge.update.mutationOptions({
			onMutate: async ({ id, payload }) => {
				await queryClient.cancelQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});

				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					})
				);

				// Optimistically update the file
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					}),
					(old) => {
						if (!old) {
							return old;
						}

						return {
							...old,
							items: old.items.map((item) =>
								item.id === id
									? {
											...item,
											payload: payload ?? item.payload,
											sourceTitle:
												(payload as ArticleKnowledgePayload | undefined)
													?.title ?? item.sourceTitle,
											updatedAt: new Date().toISOString(),
										}
									: item
							),
						} as typeof old;
					}
				);

				return { previousData };
			},
			onError: (_error, _variables, context) => {
				if (context?.previousData) {
					queryClient.setQueryData(
						trpc.knowledge.list.queryKey({
							websiteSlug,
							type: "article",
							aiAgentId,
						}),
						context.previousData
					);
				}
				toast.error(_error.message || "Failed to update file");
			},
			onSuccess: () => {
				toast.success("File updated");
				onUpdateSuccess?.();
			},
			onSettled: () => {
				void queryClient.invalidateQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});
				void queryClient.invalidateQueries({
					queryKey: trpc.linkSource.getTrainingStats.queryKey({
						websiteSlug,
					}),
				});
			},
		})
	);

	// Delete file mutation with optimistic updates
	const deleteMutation = useMutation(
		trpc.knowledge.delete.mutationOptions({
			onMutate: async ({ id }) => {
				await queryClient.cancelQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});

				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					})
				);

				// Optimistically remove the file
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					}),
					(old) => {
						if (!old) {
							return old;
						}

						return {
							...old,
							items: old.items.filter((item) => item.id !== id),
							pagination: {
								...old.pagination,
								total: Math.max(0, old.pagination.total - 1),
							},
						};
					}
				);

				return { previousData };
			},
			onError: (_error, _variables, context) => {
				if (context?.previousData) {
					queryClient.setQueryData(
						trpc.knowledge.list.queryKey({
							websiteSlug,
							type: "article",
							aiAgentId,
						}),
						context.previousData
					);
				}
				toast.error(_error.message || "Failed to delete file");
			},
			onSuccess: () => {
				toast.success("File deleted");
			},
			onSettled: () => {
				void queryClient.invalidateQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});
				void queryClient.invalidateQueries({
					queryKey: trpc.linkSource.getTrainingStats.queryKey({
						websiteSlug,
					}),
				});
			},
		})
	);

	// Toggle included mutation
	const toggleIncludedMutation = useMutation(
		trpc.knowledge.toggleIncluded.mutationOptions({
			onMutate: async ({ id, isIncluded }) => {
				await queryClient.cancelQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
					}),
				});

				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					})
				);

				// Optimistically toggle the inclusion
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "article",
						aiAgentId,
					}),
					(old) => {
						if (!old) {
							return old;
						}

						return {
							...old,
							items: old.items.map((item) =>
								item.id === id ? { ...item, isIncluded } : item
							),
						};
					}
				);

				return { previousData };
			},
			onError: (_error, _variables, context) => {
				if (context?.previousData) {
					queryClient.setQueryData(
						trpc.knowledge.list.queryKey({
							websiteSlug,
							type: "article",
							aiAgentId,
						}),
						context.previousData
					);
				}
				toast.error(_error.message || "Failed to toggle inclusion");
			},
			onSettled: () => {
				void queryClient.invalidateQueries({
					queryKey: trpc.linkSource.getTrainingStats.queryKey({
						websiteSlug,
					}),
				});
			},
		})
	);

	// Callback handlers
	const handleCreate = useCallback(
		async (params: { title: string; markdown: string; summary?: string }) => {
			const payload: ArticleKnowledgePayload = {
				title: params.title,
				summary: params.summary ?? null,
				markdown: params.markdown,
				keywords: [],
			};

			await createMutation.mutateAsync({
				websiteSlug,
				aiAgentId: aiAgentId ?? undefined,
				type: "article",
				sourceTitle: params.title,
				origin: "manual",
				payload,
			});
		},
		[createMutation, websiteSlug, aiAgentId]
	);

	const handleUpload = useCallback(
		async (file: File) => {
			const content = await file.text();
			const match = file.name.match(FILE_EXTENSION_REGEX);
			if (!match) {
				throw new Error(
					"Unsupported file type. Only .md and .txt files are allowed."
				);
			}
			const extension = match[1] as "md" | "txt";

			await uploadMutation.mutateAsync({
				websiteSlug,
				aiAgentId: aiAgentId ?? undefined,
				fileName: file.name,
				fileContent: content,
				fileExtension: extension,
			});
		},
		[uploadMutation, websiteSlug, aiAgentId]
	);

	const handleUpdate = useCallback(
		async (
			id: string,
			params: { title: string; markdown: string; summary?: string }
		) => {
			const payload: ArticleKnowledgePayload = {
				title: params.title,
				summary: params.summary ?? null,
				markdown: params.markdown,
				keywords: [],
			};

			await updateMutation.mutateAsync({
				websiteSlug,
				id,
				sourceTitle: params.title,
				payload,
			});
		},
		[updateMutation, websiteSlug]
	);

	const handleDelete = useCallback(
		async (id: string) => {
			await deleteMutation.mutateAsync({
				websiteSlug,
				id,
			});
		},
		[deleteMutation, websiteSlug]
	);

	const handleToggleIncluded = useCallback(
		async (id: string, isIncluded: boolean) => {
			await toggleIncludedMutation.mutateAsync({
				websiteSlug,
				id,
				isIncluded,
			});
		},
		[toggleIncludedMutation, websiteSlug]
	);

	return {
		// Mutations
		createMutation,
		uploadMutation,
		updateMutation,
		deleteMutation,
		toggleIncludedMutation,

		// Handlers
		handleCreate,
		handleUpload,
		handleUpdate,
		handleDelete,
		handleToggleIncluded,

		// States
		isCreating: createMutation.isPending,
		isUploading: uploadMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
		isToggling: toggleIncludedMutation.isPending,
	};
}
