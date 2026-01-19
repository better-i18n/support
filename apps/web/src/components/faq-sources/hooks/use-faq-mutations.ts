"use client";

import type { FaqKnowledgePayload } from "@cossistant/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

type UseFaqMutationsOptions = {
	websiteSlug: string;
	aiAgentId: string | null;
	onCreateSuccess?: () => void;
	onUpdateSuccess?: () => void;
};

export function useFaqMutations({
	websiteSlug,
	aiAgentId,
	onCreateSuccess,
	onUpdateSuccess,
}: UseFaqMutationsOptions) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Create FAQ mutation with optimistic updates
	const createMutation = useMutation(
		trpc.knowledge.create.mutationOptions({
			onMutate: async (newData) => {
				// Cancel outgoing refetches
				await queryClient.cancelQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
					}),
				});

				// Snapshot previous value
				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
						aiAgentId,
					})
				);

				// Optimistically add the new FAQ
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
						aiAgentId,
					}),
					(old) => {
						if (!old) {
							return old;
						}

						const faqPayload = newData.payload as FaqKnowledgePayload;
						const optimisticFaq = {
							id: `optimistic-${Date.now()}`,
							organizationId: "",
							websiteId: "",
							aiAgentId: aiAgentId ?? null,
							linkSourceId: null,
							type: "faq" as const,
							sourceUrl: null,
							sourceTitle: faqPayload.question,
							origin: "manual",
							createdBy: "",
							contentHash: "",
							payload: faqPayload,
							metadata: undefined,
							isIncluded: true,
							sizeBytes: 0,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							deletedAt: null,
						};

						return {
							...old,
							items: [optimisticFaq, ...old.items],
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
							type: "faq",
							aiAgentId,
						}),
						context.previousData
					);
				}
				toast.error(_error.message || "Failed to add FAQ");
			},
			onSuccess: () => {
				toast.success("FAQ added");
				onCreateSuccess?.();
			},
			onSettled: () => {
				// Refetch after mutation
				void queryClient.invalidateQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
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

	// Update FAQ mutation
	const updateMutation = useMutation(
		trpc.knowledge.update.mutationOptions({
			onMutate: async ({ id, payload }) => {
				await queryClient.cancelQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
					}),
				});

				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
						aiAgentId,
					})
				);

				// Optimistically update the FAQ
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
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
												(payload as FaqKnowledgePayload | undefined)
													?.question ?? item.sourceTitle,
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
							type: "faq",
							aiAgentId,
						}),
						context.previousData
					);
				}
				toast.error(_error.message || "Failed to update FAQ");
			},
			onSuccess: () => {
				toast.success("FAQ updated");
				onUpdateSuccess?.();
			},
			onSettled: () => {
				void queryClient.invalidateQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
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

	// Delete FAQ mutation with optimistic updates
	const deleteMutation = useMutation(
		trpc.knowledge.delete.mutationOptions({
			onMutate: async ({ id }) => {
				await queryClient.cancelQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
					}),
				});

				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
						aiAgentId,
					})
				);

				// Optimistically remove the FAQ
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
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
							type: "faq",
							aiAgentId,
						}),
						context.previousData
					);
				}
				toast.error(_error.message || "Failed to delete FAQ");
			},
			onSuccess: () => {
				toast.success("FAQ deleted");
			},
			onSettled: () => {
				void queryClient.invalidateQueries({
					queryKey: trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
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
						type: "faq",
					}),
				});

				const previousData = queryClient.getQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
						aiAgentId,
					})
				);

				// Optimistically toggle the inclusion
				queryClient.setQueryData(
					trpc.knowledge.list.queryKey({
						websiteSlug,
						type: "faq",
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
							type: "faq",
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
		async (params: {
			question: string;
			answer: string;
			categories?: string[];
		}) => {
			const payload: FaqKnowledgePayload = {
				question: params.question,
				answer: params.answer,
				categories: params.categories ?? [],
				relatedQuestions: [],
			};

			await createMutation.mutateAsync({
				websiteSlug,
				aiAgentId: aiAgentId ?? undefined,
				type: "faq",
				sourceTitle: params.question,
				origin: "manual",
				payload,
			});
		},
		[createMutation, websiteSlug, aiAgentId]
	);

	const handleUpdate = useCallback(
		async (
			id: string,
			params: {
				question: string;
				answer: string;
				categories?: string[];
			}
		) => {
			const payload: FaqKnowledgePayload = {
				question: params.question,
				answer: params.answer,
				categories: params.categories ?? [],
				relatedQuestions: [],
			};

			await updateMutation.mutateAsync({
				websiteSlug,
				id,
				sourceTitle: params.question,
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
		updateMutation,
		deleteMutation,
		toggleIncludedMutation,

		// Handlers
		handleCreate,
		handleUpdate,
		handleDelete,
		handleToggleIncluded,

		// States
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
		isToggling: toggleIncludedMutation.isPending,
	};
}
