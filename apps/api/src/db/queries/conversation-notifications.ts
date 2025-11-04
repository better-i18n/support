import type { Database } from "@api/db";
import {
        conversation,
        conversationAssignee,
        conversationParticipant,
        conversationSeen,
        conversationTimelineItem,
} from "@api/db/schema";
import { member, user } from "@api/db/schema/auth";
import { website } from "@api/db/schema/website";
import {
        ConversationParticipationStatus,
        ConversationTimelineType,
        TimelineItemVisibility,
} from "@cossistant/types";
import { and, desc, eq, isNull } from "drizzle-orm";

export type ConversationTimelineMessage = {
        id: string;
        text: string | null;
        parts: unknown;
        createdAt: Date;
        userId: string | null;
        visitorId: string | null;
        aiAgentId: string | null;
};

export type ConversationDigestMember = {
        userId: string;
        email: string;
        name: string | null;
};

export type ConversationUnseenDigestQueryResult = {
        conversation: {
                id: string;
                title: string | null;
                websiteSlug: string | null;
        };
        messages: ConversationTimelineMessage[];
        seen: Array<{ userId: string; lastSeenAt: Date | null }>;
        participants: string[];
        assignees: string[];
        members: ConversationDigestMember[];
};

export const getConversationUnseenDigestData = async (
        db: Database,
        params: {
                organizationId: string;
                conversationId: string;
                messageLimit?: number;
        }
): Promise<ConversationUnseenDigestQueryResult | null> => {
        const [conversationRow] = await db
                .select({
                        id: conversation.id,
                        title: conversation.title,
                        websiteSlug: website.slug,
                })
                .from(conversation)
                .leftJoin(website, eq(conversation.websiteId, website.id))
                .where(
                        and(
                                eq(conversation.id, params.conversationId),
                                eq(conversation.organizationId, params.organizationId)
                        )
                )
                .limit(1);

        if (!conversationRow) {
                return null;
        }

        const messageLimit = params.messageLimit ?? 50;

        const [messageRows, seenRows, participantRows, assigneeRows, memberRows] = await Promise.all([
                db
                        .select({
                                id: conversationTimelineItem.id,
                                text: conversationTimelineItem.text,
                                parts: conversationTimelineItem.parts,
                                createdAt: conversationTimelineItem.createdAt,
                                userId: conversationTimelineItem.userId,
                                visitorId: conversationTimelineItem.visitorId,
                                aiAgentId: conversationTimelineItem.aiAgentId,
                        })
                        .from(conversationTimelineItem)
                        .where(
                                and(
                                        eq(conversationTimelineItem.organizationId, params.organizationId),
                                        eq(conversationTimelineItem.conversationId, params.conversationId),
                                        eq(conversationTimelineItem.type, ConversationTimelineType.MESSAGE),
                                        eq(conversationTimelineItem.visibility, TimelineItemVisibility.PUBLIC),
                                        isNull(conversationTimelineItem.deletedAt)
                                )
                        )
                        .orderBy(desc(conversationTimelineItem.createdAt), desc(conversationTimelineItem.id))
                        .limit(messageLimit),
                db
                        .select({
                                userId: conversationSeen.userId,
                                lastSeenAt: conversationSeen.lastSeenAt,
                        })
                        .from(conversationSeen)
                        .where(
                                and(
                                        eq(conversationSeen.organizationId, params.organizationId),
                                        eq(conversationSeen.conversationId, params.conversationId),
                                        isNull(conversationSeen.visitorId),
                                        isNull(conversationSeen.aiAgentId)
                                )
                        ),
                db
                        .select({ userId: conversationParticipant.userId })
                        .from(conversationParticipant)
                        .where(
                                and(
                                        eq(conversationParticipant.organizationId, params.organizationId),
                                        eq(conversationParticipant.conversationId, params.conversationId),
                                        eq(conversationParticipant.status, ConversationParticipationStatus.ACTIVE),
                                        isNull(conversationParticipant.leftAt)
                                )
                        ),
                db
                        .select({ userId: conversationAssignee.userId })
                        .from(conversationAssignee)
                        .where(
                                and(
                                        eq(conversationAssignee.organizationId, params.organizationId),
                                        eq(conversationAssignee.conversationId, params.conversationId),
                                        isNull(conversationAssignee.unassignedAt)
                                )
                        ),
                db
                        .select({
                                userId: member.userId,
                                email: user.email,
                                name: user.name,
                        })
                        .from(member)
                        .innerJoin(user, eq(member.userId, user.id))
                        .where(eq(member.organizationId, params.organizationId)),
        ]);

        return {
                conversation: {
                        id: conversationRow.id,
                        title: conversationRow.title,
                        websiteSlug: conversationRow.websiteSlug,
                },
                messages: messageRows.reverse(),
                seen: seenRows
                        .filter((row): row is { userId: string; lastSeenAt: Date | null } => Boolean(row.userId))
                        .map((row) => ({
                                userId: row.userId!,
                                lastSeenAt: row.lastSeenAt ?? null,
                        })),
                participants: participantRows
                        .map((row) => row.userId)
                        .filter((userId): userId is string => Boolean(userId)),
                assignees: assigneeRows
                        .map((row) => row.userId)
                        .filter((userId): userId is string => Boolean(userId)),
                members: memberRows.map((row) => ({
                        userId: row.userId,
                        email: row.email,
                        name: row.name,
                })),
        };
};
