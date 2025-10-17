import { z } from "zod";
import { visitorProfileSchema } from "../api/visitor";
import {
        ConversationPriority,
        ConversationSentiment,
        ConversationStatus,
} from "../enums";
import {
        conversationEventSchema,
        conversationSeenSchema,
        messageSchema,
} from "../schemas";

export const conversationStatusSchema = z.enum([
	ConversationStatus.OPEN,
	ConversationStatus.RESOLVED,
	ConversationStatus.SPAM,
]);

export const conversationPrioritySchema = z.enum([
	ConversationPriority.LOW,
	ConversationPriority.NORMAL,
	ConversationPriority.HIGH,
	ConversationPriority.URGENT,
]);

export const conversationSentimentSchema = z
	.enum([
		ConversationSentiment.POSITIVE,
		ConversationSentiment.NEGATIVE,
		ConversationSentiment.NEUTRAL,
	])
	.nullable();

export const conversationRecordSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	visitorId: z.string(),
	websiteId: z.string(),
	status: conversationStatusSchema,
	priority: conversationPrioritySchema,
	sentiment: conversationSentimentSchema,
	sentimentConfidence: z.number().nullable(),
	channel: z.string(),
	title: z.string().nullable(),
	resolutionTime: z.number().nullable(),
	startedAt: z.string().nullable(),
	firstResponseAt: z.string().nullable(),
	resolvedAt: z.string().nullable(),
	lastMessageAt: z.string().nullable(),
	lastMessageBy: z.string().nullable(),
	resolvedByUserId: z.string().nullable(),
	resolvedByAiAgentId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
});

export type ConversationRecordResponse = z.infer<
	typeof conversationRecordSchema
>;

export const conversationMutationResponseSchema = z.object({
	conversation: conversationRecordSchema,
});

export const conversationHeaderSchema = z.object({
	id: z.string(),
	status: conversationStatusSchema,
	priority: conversationPrioritySchema,
	organizationId: z.string(),
	visitorId: z.string(),
	visitor: visitorProfileSchema,
	websiteId: z.string(),
	channel: z.string(),
	title: z.string().nullable(),
	resolutionTime: z.number().nullable(),
	startedAt: z.string().nullable(),
	firstResponseAt: z.string().nullable(),
	resolvedAt: z.string().nullable(),
	resolvedByUserId: z.string().nullable(),
	resolvedByAiAgentId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	lastMessageAt: z.string().nullable(),
	lastSeenAt: z.string().nullable(),
	lastMessagePreview: messageSchema.nullable(),
	viewIds: z.array(z.string()),
	seenData: z.array(conversationSeenSchema),
});

export const listConversationHeadersResponseSchema = z.object({
        items: z.array(conversationHeaderSchema),
        nextCursor: z.string().nullable(),
});

export type ConversationMutationResponse = z.infer<
        typeof conversationMutationResponseSchema
>;

export type ConversationHeader = z.infer<typeof conversationHeaderSchema>;

export const conversationTimelineItemSchema = z.discriminatedUnion("type", [
        z.object({
                type: z.literal("message"),
                message: messageSchema,
        }),
        z.object({
                type: z.literal("event"),
                event: conversationEventSchema,
        }),
]);

export const getConversationTimelineResponseSchema = z.object({
        items: z.array(conversationTimelineItemSchema),
        nextCursor: z.string().nullable(),
});

export type ConversationTimelineItem = z.infer<typeof conversationTimelineItemSchema>;

export type GetConversationTimelineResponse = z.infer<
        typeof getConversationTimelineResponseSchema
>;
