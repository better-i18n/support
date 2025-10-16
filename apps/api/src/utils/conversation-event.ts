import type { Database } from "@api/db";
import { conversationEvent } from "@api/db/schema";
import { generateULID } from "@api/utils/db/ids";
import { conversationEventSchema, ConversationEventType } from "@cossistant/types";
import type { ConversationEvent } from "@cossistant/types";
import { emitConversationEventCreated } from "./conversation-realtime";

type ConversationContext = {
        conversationId: string;
        organizationId: string;
        websiteId: string;
        visitorId?: string | null;
};

type CreateConversationEventPayload = {
        type: ConversationEventType;
        actorUserId?: string | null;
        actorAiAgentId?: string | null;
        targetUserId?: string | null;
        targetAiAgentId?: string | null;
        metadata?: Record<string, unknown> | null;
        message?: string | null;
        createdAt?: Date;
};

export type CreateConversationEventOptions = {
        db: Database;
        context: ConversationContext;
        event: CreateConversationEventPayload;
};

function normalizeMetadata(
        metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
        if (!metadata) {
                return undefined;
        }

        return metadata;
}

function normalizeEvent(inserted: ConversationEvent): ConversationEvent {
        const normalized: ConversationEvent = {
                ...inserted,
                message: inserted.message ?? undefined,
                metadata: normalizeMetadata(inserted.metadata as Record<string, unknown> | null),
                deletedAt: inserted.deletedAt ?? null,
        };

        return normalized;
}

async function resolveConversationVisitorId(
        db: Database,
        conversationId: string
): Promise<string | undefined> {
        try {
                const module = await import("@api/db/queries/conversation");
                const conversationRecord = await module.getConversationById(db, {
                        conversationId,
                });

                return conversationRecord?.visitorId ?? undefined;
        } catch (error) {
                console.error(
                        "[CONVERSATION_EVENT] Failed to resolve conversation visitor",
                        error
                );
                return undefined;
        }
}

export async function createConversationEvent({
        db,
        context,
        event,
}: CreateConversationEventOptions): Promise<ConversationEvent> {
        const createdAt = event.createdAt ?? new Date();

        const [inserted] = await db
                .insert(conversationEvent)
                .values({
                        id: generateULID(),
                        organizationId: context.organizationId,
                        conversationId: context.conversationId,
                        type: event.type,
                        actorUserId: event.actorUserId ?? null,
                        actorAiAgentId: event.actorAiAgentId ?? null,
                        targetUserId: event.targetUserId ?? null,
                        targetAiAgentId: event.targetAiAgentId ?? null,
                        metadata: event.metadata ?? null,
                        message: event.message ?? null,
                        createdAt: createdAt.toISOString(),
                })
                .returning();

        const parsed = conversationEventSchema.parse({
                ...inserted,
                message: inserted.message ?? undefined,
                metadata: normalizeMetadata(inserted.metadata as Record<string, unknown> | null),
                updatedAt: inserted.createdAt,
                deletedAt: null,
        });

        let visitorId = context.visitorId ?? null;

        if (!visitorId) {
                visitorId =
                        (await resolveConversationVisitorId(db, context.conversationId)) ?? null;
        }

        await emitConversationEventCreated({
                conversation: {
                        id: context.conversationId,
                        organizationId: context.organizationId,
                        websiteId: context.websiteId,
                        visitorId,
                },
                event: inserted,
        });

        return normalizeEvent(parsed);
}
