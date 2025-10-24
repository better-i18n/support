"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
	AvatarInput,
	type AvatarInputValue,
	uploadToPresignedUrl,
} from "@/components/ui/avatar-input";
import { BaseSubmitButton } from "@/components/ui/base-submit-button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SettingsRowFooter } from "@/components/ui/layout/settings-layout";
import { authClient } from "@/lib/auth/client";
import { useTRPC } from "@/lib/trpc/client";

const avatarValueSchema = z
        .union([
                z.string().min(1),
                z
                        .object({
                                previewUrl: z.string().min(1),
                                url: z.string().optional(),
                                mimeType: z.string(),
                                name: z.string().optional(),
                                size: z.number().optional(),
                                file: z.instanceof(File).optional(),
                        })
                        .passthrough(),
        ])
        .nullable();

const userProfileFormSchema = z.object({
	name: z
		.string({ message: "Enter your name." })
		.trim()
		.min(1, { message: "Enter your name." })
		.max(120, { message: "Name must be 120 characters or fewer." }),
	avatar: avatarValueSchema,
});

type UserProfileFormValues = z.infer<typeof userProfileFormSchema>;

type UserProfileFormProps = {
	initialName: string;
	initialAvatarUrl?: string | null;
	organizationId: string;
	userId: string;
	websiteId: string;
};

export function UserProfileForm({
	initialName,
	initialAvatarUrl,
	organizationId,
	userId,
	websiteId,
}: UserProfileFormProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const avatarProgressToastAtRef = useRef(0);

	const form = useForm<UserProfileFormValues>({
		resolver: zodResolver(userProfileFormSchema),
		mode: "onChange",
		defaultValues: {
			name: initialName,
			avatar: initialAvatarUrl
				? {
						previewUrl: initialAvatarUrl,
						url: initialAvatarUrl,
						mimeType: "image/jpeg", // Default mime type for existing avatars
					}
				: null,
		},
	});

	const avatarUploadToastId = useMemo(
		() => `profile-avatar-upload-${userId}`,
		[userId]
	);

	const { mutateAsync: updateProfile, isPending } = useMutation(
		trpc.user.updateProfile.mutationOptions({
			onSuccess: async (updatedUser) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.user.me.queryKey(),
				});
				form.reset({
					name: updatedUser.name ?? "",
					avatar: updatedUser.image ?? null,
				});
				toast.success("Profile updated.");
				authClient.$store.notify("$sessionSignal");
			},
			onError: () => {
				toast.error("Failed to update your profile. Please try again.");
			},
		})
	);

	const { mutateAsync: createSignedUrl } = useMutation(
		trpc.upload.createSignedUrl.mutationOptions()
	);

	const handleAvatarUpload = useCallback(
		async (file: File): Promise<Partial<AvatarInputValue>> => {
			try {
				toast.loading("Uploading profile picture…", {
					id: avatarUploadToastId,
				});
				avatarProgressToastAtRef.current = Date.now();

				const uploadDetails = await createSignedUrl({
					contentType: file.type,
					fileName: file.name,
					websiteId,
					path: `users/${userId}/avatars`,
					scope: {
						type: "user",
						userId,
						organizationId,
						websiteId,
					},
					useCdn: true,
				});

				await uploadToPresignedUrl({
					file,
					url: uploadDetails.uploadUrl,
					headers: { "Content-Type": file.type },
					onProgress: (progress) => {
						const now = Date.now();
						if (
							progress >= 1 ||
							now - avatarProgressToastAtRef.current >= 150
						) {
							avatarProgressToastAtRef.current = now;
							const percentage = Math.round(progress * 100);
							toast.loading(`Uploading profile picture… ${percentage}%`, {
								id: avatarUploadToastId,
							});
						}
					},
				});

				const publicUrl = uploadDetails.publicUrl;

				toast.success("Profile picture uploaded.", {
					id: avatarUploadToastId,
				});

				return {
					url: publicUrl,
					mimeType: file.type,
					name: file.name,
					size: file.size,
				};
			} catch (error) {
				const uploadError =
					error instanceof Error
						? error
						: new Error("Failed to upload avatar. Please try again.");

				toast.error(uploadError.message, {
					id: avatarUploadToastId,
				});
				(uploadError as Error & { handledByToast?: boolean }).handledByToast =
					true;
				throw uploadError;
			}
		},
		[createSignedUrl, organizationId, userId, websiteId]
	);

	const onSubmit = useCallback(
		async (values: UserProfileFormValues) => {
			const name = values.name.trim();
			const avatarValue = values.avatar;

			let imageUrl: string | null = null;

			if (typeof avatarValue === "string") {
				imageUrl = avatarValue;
			} else if (avatarValue && typeof avatarValue === "object") {
				if (!avatarValue.url) {
					toast.error(
						"Please wait for the avatar upload to finish before saving."
					);
					return;
				}
				imageUrl = avatarValue.url;
			}

			await updateProfile({
				userId,
				name,
				image: imageUrl,
			});
		},
		[updateProfile, userId]
	);

	const nameValue = form.watch("name");
	const fallbackInitials = useMemo(() => {
		const trimmed = nameValue?.trim();
		if (!trimmed) {
			return;
		}

		const [first] = trimmed;
		return first ? first.toUpperCase() : undefined;
	}, [nameValue]);

	const isSubmitting = isPending || isUploadingAvatar;

	return (
		<Form {...form}>
			<form className="flex flex-col" onSubmit={form.handleSubmit(onSubmit)}>
				<div className="space-y-6 px-4 py-6">
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Name</FormLabel>
								<FormControl>
									<Input
										autoComplete="name"
										placeholder="Ada Lovelace"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="avatar"
						render={({ field }) => (
							<FormItem className="flex flex-col gap-2">
								<FormLabel>Profile picture</FormLabel>
								<FormControl>
									<AvatarInput
										fallbackInitials={fallbackInitials}
										name={field.name}
										onBlur={field.onBlur}
										onChange={field.onChange}
										onError={(error) => {
											if (
												!(
													error as Error & {
														handledByToast?: boolean;
													}
												)?.handledByToast
											) {
												toast.error(error.message);
											}
											setIsUploadingAvatar(false);
										}}
										onUpload={handleAvatarUpload}
										onUploadComplete={() => setIsUploadingAvatar(false)}
										onUploadStart={() => setIsUploadingAvatar(true)}
										placeholder="Upload a square image at least 256×256px. SVG uploads are disabled by default for security."
										ref={field.ref}
										value={field.value}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				<SettingsRowFooter className="flex items-center justify-end gap-2">
					<BaseSubmitButton
						disabled={
							!(form.formState.isDirty && form.formState.isValid) ||
							isSubmitting
						}
						isSubmitting={isSubmitting}
						size="sm"
						type="submit"
					>
						Save profile
					</BaseSubmitButton>
				</SettingsRowFooter>
			</form>
		</Form>
	);
}
