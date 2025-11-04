import {
        type InferInsertModel,
        type InferSelectModel,
        relations,
} from "drizzle-orm";
import {
        boolean,
        index,
        integer,
        jsonb,
        pgTable,
        text,
        uniqueIndex,
} from "drizzle-orm/pg-core";

import { ulidPrimaryKey, ulidReference } from "../../utils/db/ids";
import { isoTimestamp as timestamp } from "../../utils/db/timestamp";
import { member } from "./auth";

export const memberNotificationRule = pgTable(
        "member_notification_rule",
        {
                id: ulidPrimaryKey("id"),
                memberId: ulidReference("member_id").references(() => member.id, {
                        onDelete: "cascade",
                }),
                notificationType: text("notification_type")
                        .default("default")
                        .notNull(),
                isEnabled: boolean("is_enabled")
                        .$defaultFn(() => true)
                        .notNull(),
                settings: jsonb("settings"),
                createdAt: timestamp("created_at")
                        .$defaultFn(() => new Date().toISOString())
                        .notNull(),
                updatedAt: timestamp("updated_at")
                        .$defaultFn(() => new Date().toISOString())
                        .notNull(),
        },
        (table) => [
                uniqueIndex("member_notification_rule_member_type_idx").on(
                        table.memberId,
                        table.notificationType
                ),
                index("member_notification_rule_member_idx").on(table.memberId),
        ]
);

export const memberNotificationChannel = pgTable(
        "member_notification_channel",
        {
                id: ulidPrimaryKey("id"),
                ruleId: ulidReference("rule_id").references(
                        () => memberNotificationRule.id,
                        { onDelete: "cascade" }
                ),
                channelType: text("channel_type").notNull(),
                config: jsonb("config"),
                conditions: jsonb("conditions"),
                delaySeconds: integer("delay_seconds")
                        .default(0)
                        .notNull(),
                orderIndex: integer("order_index")
                        .default(0)
                        .notNull(),
                isEnabled: boolean("is_enabled")
                        .$defaultFn(() => true)
                        .notNull(),
                createdAt: timestamp("created_at")
                        .$defaultFn(() => new Date().toISOString())
                        .notNull(),
                updatedAt: timestamp("updated_at")
                        .$defaultFn(() => new Date().toISOString())
                        .notNull(),
        },
        (table) => [
                index("member_notification_channel_rule_idx").on(table.ruleId),
                index("member_notification_channel_type_idx").on(table.channelType),
                uniqueIndex("member_notification_channel_order_idx").on(
                        table.ruleId,
                        table.orderIndex
                ),
        ]
);

export const memberNotificationRuleRelations = relations(
        memberNotificationRule,
        ({ many, one }) => ({
                member: one(member, {
                        fields: [memberNotificationRule.memberId],
                        references: [member.id],
                }),
                channels: many(memberNotificationChannel),
        })
);

export const memberNotificationChannelRelations = relations(
        memberNotificationChannel,
        ({ one }) => ({
                rule: one(memberNotificationRule, {
                        fields: [memberNotificationChannel.ruleId],
                        references: [memberNotificationRule.id],
                }),
        })
);

export type MemberNotificationRuleSelect = InferSelectModel<
        typeof memberNotificationRule
>;
export type MemberNotificationRuleInsert = InferInsertModel<
        typeof memberNotificationRule
>;

export type MemberNotificationChannelSelect = InferSelectModel<
        typeof memberNotificationChannel
>;
export type MemberNotificationChannelInsert = InferInsertModel<
        typeof memberNotificationChannel
>;
