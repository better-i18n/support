import { z } from "@hono/zod-openapi";
import { ConversationEventType } from "../enums";

const metadataSchema = z
	.record(z.string(), z.unknown())
	.nullable()
	.optional()
	.openapi({
		description: "Additional metadata associated with the event",
	});

export const conversationEventResponseSchema = z
	.object({
		id: z.string().openapi({
			description: "Unique identifier for the conversation event",
		}),
		organizationId: z.string().openapi({
			description: "Organization that owns the conversation",
		}),
		conversationId: z.string().openapi({
			description: "Conversation the event belongs to",
		}),
		type: z
			.enum([
				ConversationEventType.ASSIGNED,
				ConversationEventType.UNASSIGNED,
				ConversationEventType.PARTICIPANT_REQUESTED,
				ConversationEventType.PARTICIPANT_JOINED,
				ConversationEventType.PARTICIPANT_LEFT,
				ConversationEventType.STATUS_CHANGED,
				ConversationEventType.PRIORITY_CHANGED,
				ConversationEventType.TAG_ADDED,
				ConversationEventType.TAG_REMOVED,
				ConversationEventType.RESOLVED,
				ConversationEventType.REOPENED,
			])
			.openapi({
				description: "Type of event that occurred",
			}),
		actorUserId: z.string().nullable().openapi({
			description: "User that triggered the event, if applicable",
		}),
		actorAiAgentId: z.string().nullable().openapi({
			description: "AI agent that triggered the event, if applicable",
		}),
		targetUserId: z.string().nullable().openapi({
			description: "User targeted by the event, if applicable",
		}),
		targetAiAgentId: z.string().nullable().openapi({
			description: "AI agent targeted by the event, if applicable",
		}),
		message: z.string().nullable().optional().openapi({
			description: "Optional human readable message attached to the event",
		}),
		metadata: metadataSchema,
		createdAt: z.string().openapi({
			description: "Timestamp when the event was recorded",
		}),
		updatedAt: z.string().openapi({
			description: "Timestamp mirroring createdAt for compatibility",
		}),
		deletedAt: z.string().nullable().openapi({
			description: "When the event was deleted, if ever",
		}),
	})
	.openapi({
		description: "Conversation event entry",
	});

export type ConversationEventResponse = z.infer<
	typeof conversationEventResponseSchema
>;

export const getConversationEventsRequestSchema = z
	.object({
		conversationId: z.string().min(1).openapi({
			description: "Conversation ID to retrieve events for",
		}),
		limit: z.coerce.number().min(1).max(100).default(50).openapi({
			description: "Maximum number of events to return",
			default: 50,
		}),
		cursor: z.string().optional().openapi({
			description: "Pagination cursor for fetching older events",
		}),
	})
	.openapi({
		description: "Query parameters for listing conversation events",
	});

export type GetConversationEventsRequest = z.infer<
	typeof getConversationEventsRequestSchema
>;

export const getConversationEventsResponseSchema = z
	.object({
		events: z.array(conversationEventResponseSchema).openapi({
			description: "Chronologically ordered events",
		}),
		nextCursor: z.string().optional().openapi({
			description: "Cursor to fetch the next page of results",
		}),
		hasNextPage: z.boolean().openapi({
			description: "Whether additional events are available",
		}),
	})
	.openapi({
		description: "Paginated conversation events response",
	});

export type GetConversationEventsResponse = z.infer<
	typeof getConversationEventsResponseSchema
>;
