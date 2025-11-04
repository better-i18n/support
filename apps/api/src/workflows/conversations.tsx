import { db } from "@api/db";
import { env } from "@api/env";
import {
        getConversationUnseenDigestData,
        type ConversationDigestMember,
        type ConversationTimelineMessage,
} from "@api/db/queries";
import { sendEmail } from "@api/lib/resend";
import { ConversationUnseenDigestEmail } from "@cossistant/transactional/emails/conversation-unseen-digest";
import { serve } from "@upstash/workflow/hono";
import { Hono } from "hono";

// Needed for email templates, don't remove
import React from "react";

import type { ConversationUnseenDigestData } from "./types";

const MAX_MESSAGES_PER_EMAIL = 10;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const truncate = (value: string, maxLength = 240): string => {
        if (value.length <= maxLength) {
                return value;
        }

        const truncated = value.slice(0, maxLength - 1).trimEnd();
        return `${truncated}\u2026`;
};

const extractMessagePreview = (message: ConversationTimelineMessage): string => {
        if (typeof message.text === "string" && message.text.trim().length > 0) {
                return normalizeWhitespace(message.text);
        }

        if (Array.isArray(message.parts)) {
                for (const part of message.parts) {
                        if (part && typeof part === "object" && "type" in part) {
                                const type = (part as { type?: unknown }).type;
                                const text = (part as { text?: unknown }).text;

                                if (type === "text" && typeof text === "string") {
                                        return normalizeWhitespace(text);
                                }
                        }
                }
        }

        return "New message";
};

const getSenderLabel = (
        message: ConversationTimelineMessage,
        members: Map<string, ConversationDigestMember>
): string => {
        if (message.userId) {
                const memberInfo = members.get(message.userId);
                return memberInfo?.name?.trim() || "Team member";
        }

        if (message.aiAgentId) {
                return "AI assistant";
        }

        return "Visitor";
};

const conversationsWorkflow = new Hono();

conversationsWorkflow.post(
        "/unseen-digest",
        serve<ConversationUnseenDigestData>(async (context) => {
                const { conversationId, organizationId } = context.requestPayload;

                await context.run("notify-unseen-messages", async () => {
                        const digestData = await getConversationUnseenDigestData(db, {
                                conversationId,
                                organizationId,
                        });

                        if (!digestData) {
                                console.warn("Conversation not found for unseen digest", {
                                        conversationId,
                                        organizationId,
                                });
                                return;
                        }

                        const { conversation: conversationRecord, messages, seen, participants, assignees, members } = digestData;

                        if (messages.length === 0) {
                                return;
                        }

                        const membersMap = new Map<string, ConversationDigestMember>();
                        for (const member of members) {
                                membersMap.set(member.userId, member);
                        }

                        const candidateUserIds = new Set<string>();
                        for (const entry of seen) {
                                candidateUserIds.add(entry.userId);
                        }
                        for (const userId of participants) {
                                candidateUserIds.add(userId);
                        }
                        for (const userId of assignees) {
                                candidateUserIds.add(userId);
                        }

                        const targetMembers: ConversationDigestMember[] =
                                candidateUserIds.size > 0
                                        ? Array.from(candidateUserIds)
                                                  .map((userId) => membersMap.get(userId))
                                                  .filter((value): value is ConversationDigestMember => Boolean(value))
                                        : Array.from(membersMap.values());

                        if (targetMembers.length === 0) {
                                return;
                        }

                        const seenMap = new Map<string, Date | null>();
                        for (const entry of seen) {
                                seenMap.set(entry.userId, entry.lastSeenAt ?? null);
                        }

                        const appBaseUrl = env.PUBLIC_APP_URL.replace(/\/$/, "");
                        const conversationTitle = conversationRecord.title?.trim() || "Visitor conversation";
                        const conversationUrl = conversationRecord.websiteSlug
                                ? `${appBaseUrl}/${conversationRecord.websiteSlug}/inbox/${conversationRecord.id}`
                                : `${appBaseUrl}/inbox/${conversationRecord.id}`;
                        const notificationSettingsUrl = `${appBaseUrl}/settings/notifications`;

                        const notifications = targetMembers
                                .map((memberInfo) => {
                                        const lastSeenTimestamp = seenMap.get(memberInfo.userId)?.getTime() ?? Number.NEGATIVE_INFINITY;

                                        const unseenMessages = messages.filter((message) => {
                                                const messageTimestamp = message.createdAt.getTime();

                                                if (messageTimestamp <= lastSeenTimestamp) {
                                                        return false;
                                                }

                                                if (message.userId && message.userId === memberInfo.userId) {
                                                        return false;
                                                }

                                                return true;
                                        });

                                        if (unseenMessages.length === 0) {
                                                return null;
                                        }

                                        const recentMessages = unseenMessages.slice(-MAX_MESSAGES_PER_EMAIL);

                                        return {
                                                member: memberInfo,
                                                messages: recentMessages.map((message) => ({
                                                        sender: getSenderLabel(message, membersMap),
                                                        preview: truncate(extractMessagePreview(message)),
                                                        createdAt: message.createdAt.toISOString(),
                                                })),
                                                total: unseenMessages.length,
                                        };
                                })
                                .filter((value): value is {
                                        member: ConversationDigestMember;
                                        messages: Array<{
                                                sender: string;
                                                preview: string;
                                                createdAt: string;
                                        }>;
                                        total: number;
                                } => Boolean(value));

                        if (notifications.length === 0) {
                                return;
                        }

                        await Promise.all(
                                notifications.map((notification) =>
                                        sendEmail({
                                                to: [notification.member.email],
                                                subject: `${notification.total} unread ${
                                                        notification.total === 1 ? "message" : "messages"
                                                } in ${conversationTitle}`,
                                                refId: `conversation-unseen-${conversationId}-${notification.member.userId}`,
                                                variant: "notifications",
                                                tags: [
                                                        {
                                                                name: "template",
                                                                value: "conversation-unseen-digest",
                                                        },
                                                        {
                                                                name: "conversationId",
                                                                value: conversationId,
                                                        },
                                                ],
                                                content: (
                                                        <ConversationUnseenDigestEmail
                                                                conversationTitle={conversationTitle}
                                                                conversationUrl={conversationUrl}
                                                                messages={notification.messages}
                                                                notificationSettingsUrl={notificationSettingsUrl}
                                                                recipientEmail={notification.member.email}
                                                                recipientName={notification.member.name}
                                                                totalMessages={notification.total}
                                                        />
                                                ),
                                        })
                                )
                        );
                });
        })
);

export default conversationsWorkflow;
