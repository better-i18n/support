import {
        ensureDefaultMemberNotificationRules,
        updateMemberNotificationRules,
} from "@api/db/queries/notification";
import { getWebsiteBySlugWithAccess } from "@api/db/queries/website";
import { member } from "@api/db/schema";
import {
        memberNotificationRuleUpdateSchema,
        memberNotificationSettingsResponseSchema,
} from "@cossistant/types";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../init";

export const notificationRouter = createTRPCRouter({
        getMemberSettings: protectedProcedure
                .input(
                        z.object({
                                websiteSlug: z.string(),
                        })
                )
                .output(memberNotificationSettingsResponseSchema)
                .query(async ({ ctx, input }) => {
                        const website = await getWebsiteBySlugWithAccess(ctx.db, {
                                userId: ctx.user.id,
                                websiteSlug: input.websiteSlug,
                        });

                        if (!website) {
                                throw new TRPCError({
                                        code: "NOT_FOUND",
                                        message: "Website not found or access denied",
                                });
                        }

                        const membership = await ctx.db.query.member.findFirst({
                                where: and(
                                        eq(member.userId, ctx.user.id),
                                        eq(member.organizationId, website.organizationId)
                                ),
                                columns: { id: true },
                        });

                        if (!membership) {
                                throw new TRPCError({
                                        code: "FORBIDDEN",
                                        message: "You are not a member of this organization.",
                                });
                        }

                        const rules = await ensureDefaultMemberNotificationRules(ctx.db, {
                                memberId: membership.id,
                        });

                        return { rules };
                }),
        updateMemberSettings: protectedProcedure
                .input(
                        z.object({
                                websiteSlug: z.string(),
                                updates: memberNotificationRuleUpdateSchema.array(),
                        })
                )
                .output(memberNotificationSettingsResponseSchema)
                .mutation(async ({ ctx, input }) => {
                        const website = await getWebsiteBySlugWithAccess(ctx.db, {
                                userId: ctx.user.id,
                                websiteSlug: input.websiteSlug,
                        });

                        if (!website) {
                                throw new TRPCError({
                                        code: "NOT_FOUND",
                                        message: "Website not found or access denied",
                                });
                        }

                        const membership = await ctx.db.query.member.findFirst({
                                where: and(
                                        eq(member.userId, ctx.user.id),
                                        eq(member.organizationId, website.organizationId)
                                ),
                                columns: { id: true },
                        });

                        if (!membership) {
                                throw new TRPCError({
                                        code: "FORBIDDEN",
                                        message: "You are not a member of this organization.",
                                });
                        }

                        await ensureDefaultMemberNotificationRules(ctx.db, {
                                memberId: membership.id,
                        });

                        try {
                                const rules = await updateMemberNotificationRules(ctx.db, {
                                        memberId: membership.id,
                                        updates: input.updates,
                                });

                                return { rules };
                        } catch (error) {
                                if (error instanceof Error) {
                                        if (error.message === "RULE_NOT_FOUND") {
                                                throw new TRPCError({
                                                        code: "NOT_FOUND",
                                                        message: "Notification rule not found.",
                                                });
                                        }

                                        if (error.message === "CHANNEL_NOT_FOUND") {
                                                throw new TRPCError({
                                                        code: "NOT_FOUND",
                                                        message: "Notification channel not found.",
                                                });
                                        }
                                }

                                throw new TRPCError({
                                        code: "INTERNAL_SERVER_ERROR",
                                        message: "Failed to update notification settings.",
                                });
                        }
                }),
});
