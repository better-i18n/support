import type { Database } from "@api/db";
import { conversationEvent } from "@api/db/schema";
import { getConversationById } from "@api/db/queries/conversation";
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

function coerceMetadata(
        metadata: unknown
): Record<string, unknown> | undefined {
        if (metadata == null) {
                return undefined;
        }

        return metadata as Record<string, unknown>;
}

function normalizeEvent(inserted: ConversationEvent): ConversationEvent {
        const normalized: ConversationEvent = {
                ...inserted,
                message: inserted.message ?? undefined,
                metadata: coerceMetadata(inserted.metadata),
                deletedAt: inserted.deletedAt ?? null,
        };

        return normalized;
}

async function resolveConversationVisitorId(
        db: Database,
        conversationId: string
): Promise<string | undefined> {
        const conversationRecord = await getConversationById(db, {
                conversationId,
        });

        return conversationRecord?.visitorId ?? undefined;
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
                metadata: coerceMetadata(inserted.metadata),
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
