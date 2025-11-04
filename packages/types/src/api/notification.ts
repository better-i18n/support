import { z } from "@hono/zod-openapi";

export const notificationChannelConfigSchema = z.record(
        z.string(),
        z.unknown()
);

export const notificationConditionSchema = z.record(z.string(), z.unknown());

export const memberNotificationChannelSchema = z.object({
        id: z.ulid().openapi({
                description: "Unique identifier for the notification channel configuration.",
        }),
        ruleId: z.ulid().openapi({
                description: "Identifier of the rule this channel belongs to.",
        }),
        channelType: z
                .string()
                .min(1)
                .openapi({
                        description:
                                "Channel identifier (e.g. email, browser_push, slack, sms, discord, custom integrations).",
                        example: "browser_push",
                }),
        config: notificationChannelConfigSchema
                .nullable()
                .openapi({
                        description:
                                "Channel specific configuration such as push subscriptions, webhook URLs, or credentials.",
                        example: {
                                devices: [
                                        {
                                                type: "ios",
                                                token: "apns-token",
                                        },
                                ],
                        },
                }),
        conditions: notificationConditionSchema
                .nullable()
                .openapi({
                        description:
                                "Optional delivery conditions (e.g. deliverOnlyIfUnread, escalateAfterSeconds).",
                        example: { deliverOnlyIfUnread: true },
                }),
        delaySeconds: z
                .number()
                .int()
                .min(0)
                .openapi({
                        description:
                                "Delay before attempting this channel, allowing for chained or fallback delivery flows.",
                        example: 300,
                }),
        orderIndex: z
                .number()
                .int()
                .min(0)
                .openapi({
                        description:
                                "Priority position of this channel within the rule. Lower numbers are executed first.",
                        example: 0,
                }),
        isEnabled: z.boolean().openapi({
                description: "Whether this channel is active for the owning member.",
        }),
        createdAt: z
                .string()
                .openapi({
                        description: "Timestamp when the channel preference was created.",
                        example: "2024-01-01T12:00:00.000Z",
                }),
        updatedAt: z
                .string()
                .openapi({
                        description: "Timestamp when the channel preference was last updated.",
                        example: "2024-01-01T12:05:00.000Z",
                }),
});

export const memberNotificationRuleSchema = z.object({
        id: z.ulid().openapi({
                description: "Unique identifier for the notification rule.",
        }),
        memberId: z.ulid().openapi({
                description: "Member (user within an organization) that owns these preferences.",
        }),
        notificationType: z
                .string()
                .min(1)
                .openapi({
                        description:
                                "Logical grouping for the rule (e.g. default, conversation.assigned, escalation).",
                        example: "default",
                }),
        isEnabled: z.boolean().openapi({
                description: "Whether this rule is active.",
        }),
        settings: notificationChannelConfigSchema
                .nullable()
                .openapi({
                        description:
                                "Additional structured settings shared by all channels in the rule (e.g. quiet hours).",
                        example: { quietHours: { from: "22:00", to: "07:00" } },
                }),
        createdAt: z
                .string()
                .openapi({
                        description: "Timestamp when the rule was created.",
                        example: "2024-01-01T12:00:00.000Z",
                }),
        updatedAt: z
                .string()
                .openapi({
                        description: "Timestamp when the rule was last updated.",
                        example: "2024-01-01T12:05:00.000Z",
                }),
        channels: z.array(memberNotificationChannelSchema).openapi({
                description: "Notification channels configured under this rule ordered by priority.",
        }),
});

export type MemberNotificationChannel = z.infer<typeof memberNotificationChannelSchema>;
export type MemberNotificationRule = z.infer<typeof memberNotificationRuleSchema>;

export const defaultMemberNotificationTypes = [
        "marketing.email",
        "inbox.unread.email_followup",
        "inbox.new_message.browser",
] as const;

export const memberNotificationRuleUpdateSchema = z.object({
        ruleId: z.ulid(),
        isEnabled: z.boolean().optional(),
        settings: notificationChannelConfigSchema.optional().nullable(),
        channels: z
                .array(
                        z.object({
                                channelId: z.ulid(),
                                isEnabled: z.boolean().optional(),
                                delaySeconds: z
                                        .number()
                                        .int()
                                        .min(0)
                                        .max(86_400)
                                        .optional(),
                                config: notificationChannelConfigSchema
                                        .optional()
                                        .nullable(),
                                conditions: notificationConditionSchema
                                        .optional()
                                        .nullable(),
                                orderIndex: z.number().int().min(0).optional(),
                        })
                )
                .optional(),
});

export type MemberNotificationRuleUpdate = z.infer<
        typeof memberNotificationRuleUpdateSchema
>;

export const memberNotificationSettingsResponseSchema = z.object({
        rules: z.array(memberNotificationRuleSchema),
});
