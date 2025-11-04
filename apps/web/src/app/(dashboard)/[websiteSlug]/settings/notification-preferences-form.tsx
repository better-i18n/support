"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@cossistant/api/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { BaseSubmitButton } from "@/components/ui/base-submit-button";
import {
        Form,
        FormControl,
        FormDescription,
        FormField,
        FormItem,
        FormLabel,
        FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SettingsRowFooter } from "@/components/ui/layout/settings-layout";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useTRPC } from "@/lib/trpc/client";

const channelSchema = z.object({
        channelId: z.string(),
        isEnabled: z.boolean(),
        delaySeconds: z.coerce
                .number({ invalid_type_error: "Enter a delay in seconds." })
                .int()
                .min(0, { message: "Delay must be 0 or greater." })
                .max(86_400, { message: "Delay must be 24 hours or less." }),
});

const notificationFormSchema = z.object({
        rules: z.array(
                z.object({
                        ruleId: z.string(),
                        notificationType: z.string(),
                        isEnabled: z.boolean(),
                        channels: z.array(channelSchema),
                })
        ),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

type NotificationPreferencesFormProps = {
        websiteSlug: string;
};

type NotificationRule = RouterOutputs["notification"]["getMemberSettings"]["rules"][number];

const NOTIFICATION_METADATA: Record<
        string,
        {
                title: string;
                description: string;
                delayLabel: string;
                delayDescription?: string;
        }
> = {
        "marketing.email": {
                title: "Marketing emails",
                description:
                        "Stay informed about new product features, best practices, and announcements.",
                delayLabel: "Send after (seconds)",
                delayDescription: "Use 0 seconds to deliver immediately.",
        },
        "inbox.unread.email_followup": {
                title: "Unread message reminders",
                description:
                        "Receive a follow-up email if a conversation stays unread for too long.",
                delayLabel: "Send reminder after (seconds)",
                delayDescription: "Default is 300 seconds (5 minutes).",
        },
        "inbox.new_message.browser": {
                title: "Browser push notifications",
                description:
                        "Show a desktop notification shortly after new messages arrive.",
                delayLabel: "Show notification after (seconds)",
                delayDescription:
                        "Requires a browser push subscription. Keep disabled until your browser keys are configured.",
        },
};

function toFormValues(rules: NotificationRule[]): NotificationFormValues {
        return {
                rules: rules.map((rule) => ({
                        ruleId: rule.id,
                        notificationType: rule.notificationType,
                        isEnabled: rule.isEnabled,
                        channels: rule.channels.map((channel) => ({
                                channelId: channel.id,
                                isEnabled: channel.isEnabled,
                                delaySeconds: channel.delaySeconds,
                        })),
                })),
        };
}

export function NotificationPreferencesForm({
        websiteSlug,
}: NotificationPreferencesFormProps) {
        const trpc = useTRPC();
        const queryClient = useQueryClient();

        const { data, isLoading } = useQuery({
                ...trpc.notification.getMemberSettings.queryOptions({
                        websiteSlug,
                }),
        });

        const form = useForm<NotificationFormValues>({
                resolver: zodResolver(notificationFormSchema),
                defaultValues: { rules: [] },
        });

        useEffect(() => {
                if (data) {
                        form.reset(toFormValues(data.rules));
                }
        }, [data, form]);

        const updateMutation = useMutation(
                trpc.notification.updateMemberSettings.mutationOptions({
                        onSuccess: (response) => {
                                queryClient.setQueryData(
                                        trpc.notification.getMemberSettings.queryKey({
                                                websiteSlug,
                                        }),
                                        response
                                );

                                form.reset(toFormValues(response.rules));
                                toast.success("Notification preferences updated.");
                        },
                        onError: (error) => {
                                toast.error(
                                        error instanceof Error
                                                ? error.message
                                                : "Failed to update notification preferences."
                                );
                        },
                })
        );

        const rules = form.watch("rules");

        const isSaving = updateMutation.isPending;

        const onSubmit = (values: NotificationFormValues) =>
                updateMutation.mutate({
                        websiteSlug,
                        updates: values.rules.map((rule) => ({
                                ruleId: rule.ruleId,
                                isEnabled: rule.isEnabled,
                                channels: rule.channels.map((channel) => ({
                                        channelId: channel.channelId,
                                        isEnabled: channel.isEnabled,
                                        delaySeconds: channel.delaySeconds,
                                })),
                        })),
                });

        const isBusy = isLoading || isSaving;

        if (isLoading) {
                return (
                        <div className="flex h-36 items-center justify-center">
                                <Spinner />
                        </div>
                );
        }

        if (!data) {
                return (
                        <div className="flex h-36 items-center justify-center text-muted-foreground text-sm">
                                Unable to load notification preferences.
                        </div>
                );
        }

        if (rules.length === 0) {
                return (
                        <div className="flex h-36 items-center justify-center text-muted-foreground text-sm">
                                No notification preferences found.
                        </div>
                );
        }

        return (
                <Form {...form}>
                        <form className="flex flex-col" onSubmit={form.handleSubmit(onSubmit)}>
                                <div className="divide-y border-b border-primary/10 dark:border-primary/5">
                                        {rules.map((rule, ruleIndex) => {
                                                const metadata =
                                                        NOTIFICATION_METADATA[rule.notificationType] ?? {
                                                                title: rule.notificationType,
                                                                description: "Manage this notification.",
                                                                delayLabel: "Delay (seconds)",
                                                        };

                                                return (
                                                        <div
                                                                className="flex flex-col gap-4 p-4"
                                                                key={rule.ruleId}
                                                        >
                                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                        <div className="flex-1">
                                                                                <h3 className="font-medium text-sm text-primary">
                                                                                        {metadata.title}
                                                                                </h3>
                                                                                <p className="text-muted-foreground text-xs">
                                                                                        {metadata.description}
                                                                                </p>
                                                                        </div>
                                                                        <FormField
                                                                                control={form.control}
                                                                                name={`rules.${ruleIndex}.isEnabled`}
                                                                                render={({ field }) => (
                                                                                        <FormItem className="flex items-center gap-2">
                                                                                                <FormLabel className="text-muted-foreground text-xs">
                                                                                                        Enabled
                                                                                                </FormLabel>
                                                                                                <FormControl>
                                                                                                        <Switch
                                                                                                                checked={field.value}
                                                                                                                disabled={isBusy}
                                                                                                                onCheckedChange={(checked) => {
                                                                                                                        field.onChange(checked);
                                                                                                                        const channelPath = `rules.${ruleIndex}.channels` as const;
                                                                                                                        const channelValues = form.getValues(channelPath);
                                                                                                                        channelValues.forEach((_, channelIndex) => {
                                                                                                                                form.setValue(
                                                                                                                                        `${channelPath}.${channelIndex}.isEnabled` as const,
                                                                                                                                        checked,
                                                                                                                                        { shouldDirty: true }
                                                                                                                                );
                                                                                                                        });
                                                                                                                }}
                                                                                                        />
                                                                                                </FormControl>
                                                                                        </FormItem>
                                                                                )}
                                                                        />
                                                                </div>
                                                                <div className="grid gap-3 sm:grid-cols-2">
                                                                        {rule.channels.map((channel, channelIndex) => (
                                                                                <div
                                                                                        className="flex flex-col gap-3"
                                                                                        key={channel.channelId}
                                                                                >
                                                                                        <FormField
                                                                                                control={form.control}
                                                                                                name={`rules.${ruleIndex}.channels.${channelIndex}.isEnabled`}
                                                                                                render={({ field }) => (
                                                                                                        <FormItem className="flex items-center justify-between gap-2">
                                                                                                                <FormLabel className="text-muted-foreground text-xs">
                                                                                                                        Channel enabled
                                                                                                                </FormLabel>
                                                                                                                <FormControl>
                                                                                                                        <Switch
                                                                                                                                checked={field.value}
                                                                                                                                disabled={isBusy}
                                                                                                                                onCheckedChange={field.onChange}
                                                                                                                        />
                                                                                                                </FormControl>
                                                                                                        </FormItem>
                                                                                                )}
                                                                                        />
                                                                                        <FormField
                                                                                                control={form.control}
                                                                                                name={`rules.${ruleIndex}.channels.${channelIndex}.delaySeconds`}
                                                                                                render={({ field }) => (
                                                                                                        <FormItem>
                                                                                                                <FormLabel className="text-muted-foreground text-xs">
                                                                                                                        {metadata.delayLabel}
                                                                                                                </FormLabel>
                                                                                                                <FormControl>
                                                                                                                        <Input
                                                                                                                                inputMode="numeric"
                                                                                                                                min={0}
                                                                                                                                step={1}
                                                                                                                                type="number"
                                                                                                                                value={Number.isNaN(field.value) ? 0 : field.value}
                                                                                                                                onChange={(event) => {
                                                                                                                                        const value = event.target.value;
                                                                                                                                        field.onChange(
                                                                                                                                                value === ""
                                                                                                                                                        ? 0
                                                                                                                                                        : Number.parseInt(value, 10)
                                                                                                                                        );
                                                                                                                                }}
                                                                                                                                disabled={isBusy}
                                                                                                                        />
                                                                                                                </FormControl>
                                                                                                                {metadata.delayDescription ? (
                                                                                                                        <FormDescription className="text-xs">
                                                                                                                                {metadata.delayDescription}
                                                                                                                        </FormDescription>
                                                                                                                ) : null}
                                                                                                                <FormMessage />
                                                                                                        </FormItem>
                                                                                                )}
                                                                                        />
                                                                                </div>
                                                                        ))}
                                                                </div>
                                                        </div>
                                                );
                                        })}
                                </div>
                                <SettingsRowFooter>
                                        <BaseSubmitButton
                                                className="ml-auto"
                                                isSubmitting={isSaving}
                                                type="submit"
                                        >
                                                Save notification preferences
                                        </BaseSubmitButton>
                                </SettingsRowFooter>
                        </form>
                </Form>
        );
}
