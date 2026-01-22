import { z } from "zod";
import { visitorResponseSchema } from "./api/visitor";
import {
	ConversationEventType,
	ConversationTimelineType,
	TimelineItemVisibility,
} from "./enums";
import { conversationSchema } from "./schemas";
import { conversationHeaderSchema } from "./trpc/conversation";

export const baseRealtimeEvent = z.object({
	websiteId: z.string(),
	organizationId: z.string(),
	visitorId: z.string().nullable(),
	userId: z.string().nullable(),
});

/**
 * Central event system for real-time communication
 * All WebSocket and Redis Pub/Sub events are defined here
 */
export const realtimeSchema = {
	userConnected: baseRealtimeEvent.extend({
		connectionId: z.string(),
	}),
	userDisconnected: baseRealtimeEvent.extend({
		connectionId: z.string(),
	}),
	visitorConnected: baseRealtimeEvent.extend({
		visitorId: z.string(),
		connectionId: z.string(),
	}),
	visitorDisconnected: baseRealtimeEvent.extend({
		visitorId: z.string(),
		connectionId: z.string(),
	}),
	userPresenceUpdate: baseRealtimeEvent.extend({
		userId: z.string(),
		status: z.enum(["online", "away", "offline"]),
		lastSeen: z.string(),
	}),
	conversationSeen: baseRealtimeEvent.extend({
		conversationId: z.string(),
		aiAgentId: z.string().nullable(),
		lastSeenAt: z.string().nullable(), // null indicates unread (seen entry removed)
	}),
	conversationTyping: baseRealtimeEvent.extend({
		conversationId: z.string(),
		aiAgentId: z.string().nullable(),
		isTyping: z.boolean(),
		visitorPreview: z.string().max(2000).nullable().optional(),
	}),
	timelineItemCreated: baseRealtimeEvent.extend({
		conversationId: z.string(),
		item: z.object({
			id: z.string(),
			conversationId: z.string(),
			organizationId: z.string(),
			visibility: z.enum([
				TimelineItemVisibility.PUBLIC,
				TimelineItemVisibility.PRIVATE,
			]),
			type: z.enum([
				ConversationTimelineType.MESSAGE,
				ConversationTimelineType.EVENT,
				ConversationTimelineType.IDENTIFICATION,
			]),
			text: z.string().nullable(),
			parts: z.array(z.unknown()),
			userId: z.string().nullable(),
			visitorId: z.string().nullable(),
			aiAgentId: z.string().nullable(),
			createdAt: z.string(),
			deletedAt: z.string().nullable(),
			tool: z.string().nullable().optional(),
		}),
	}),
	conversationCreated: baseRealtimeEvent.extend({
		conversationId: z.string(),
		conversation: conversationSchema,
		header: conversationHeaderSchema,
	}),
	visitorIdentified: baseRealtimeEvent.extend({
		visitorId: z.string(),
		visitor: visitorResponseSchema,
	}),
	conversationEventCreated: baseRealtimeEvent.extend({
		conversationId: z.string(),
		aiAgentId: z.string().nullable(),
		event: z.object({
			id: z.string(),
			conversationId: z.string(),
			organizationId: z.string(),
			type: z.enum([
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
				ConversationEventType.VISITOR_BLOCKED,
				ConversationEventType.VISITOR_UNBLOCKED,
				ConversationEventType.VISITOR_IDENTIFIED,
			]),
			actorUserId: z.string().nullable(),
			actorAiAgentId: z.string().nullable(),
			targetUserId: z.string().nullable(),
			targetAiAgentId: z.string().nullable(),
			message: z.string().nullable(),
			metadata: z.record(z.string(), z.unknown()).nullable(),
			createdAt: z.string(),
			updatedAt: z.string(),
			deletedAt: z.string().nullable(),
		}),
	}),
	// Conversation updated (title, sentiment, escalation status changes)
	conversationUpdated: baseRealtimeEvent.extend({
		conversationId: z.string(),
		updates: z.object({
			title: z.string().nullable().optional(),
			sentiment: z
				.enum(["positive", "negative", "neutral"])
				.nullable()
				.optional(),
			sentimentConfidence: z.number().nullable().optional(),
			escalatedAt: z.string().nullable().optional(),
			escalationReason: z.string().nullable().optional(),
		}),
		aiAgentId: z.string().nullable(),
	}),
	// Web crawling events
	crawlStarted: baseRealtimeEvent.extend({
		linkSourceId: z.string(),
		url: z.string(),
		discoveredPages: z.array(
			z.object({
				url: z.string(),
				title: z.string().nullable(),
				depth: z.number(),
			})
		),
		totalPagesCount: z.number(),
	}),
	crawlProgress: baseRealtimeEvent.extend({
		linkSourceId: z.string(),
		url: z.string(),
		page: z.object({
			url: z.string(),
			title: z.string().nullable(),
			status: z.enum(["pending", "crawling", "completed", "failed"]),
			sizeBytes: z.number().optional(),
			error: z.string().nullable().optional(),
		}),
		completedCount: z.number(),
		totalCount: z.number(),
	}),
	crawlCompleted: baseRealtimeEvent.extend({
		linkSourceId: z.string(),
		url: z.string(),
		crawledPagesCount: z.number(),
		totalSizeBytes: z.number(),
		failedPagesCount: z.number(),
	}),
	crawlFailed: baseRealtimeEvent.extend({
		linkSourceId: z.string(),
		url: z.string(),
		error: z.string(),
	}),
	// Link source updated (for status changes, etc.)
	linkSourceUpdated: baseRealtimeEvent.extend({
		linkSourceId: z.string(),
		status: z.enum(["pending", "mapping", "crawling", "completed", "failed"]),
		discoveredPagesCount: z.number().optional(),
		crawledPagesCount: z.number().optional(),
		totalSizeBytes: z.number().optional(),
		errorMessage: z.string().nullable().optional(),
	}),
	// Emitted after map phase with all discovered URLs (for real-time tree display)
	crawlPagesDiscovered: baseRealtimeEvent.extend({
		linkSourceId: z.string(),
		pages: z.array(
			z.object({
				url: z.string(),
				path: z.string(),
				depth: z.number(),
			})
		),
	}),
	// Emitted when each page completes scraping (for real-time updates)
	crawlPageCompleted: baseRealtimeEvent.extend({
		linkSourceId: z.string(),
		page: z.object({
			url: z.string(),
			title: z.string().nullable(),
			sizeBytes: z.number(),
			knowledgeId: z.string(),
		}),
	}),
} as const;

export type RealtimeEventType = keyof typeof realtimeSchema;

export type RealtimeEventPayload<T extends RealtimeEventType> = z.infer<
	(typeof realtimeSchema)[T]
>;

export type RealtimeEvent<T extends RealtimeEventType> = {
	type: T;
	payload: RealtimeEventPayload<T>;
};

export type AnyRealtimeEvent = {
	[K in RealtimeEventType]: RealtimeEvent<K>;
}[RealtimeEventType];

export type RealtimeEventData<T extends RealtimeEventType> =
	RealtimeEventPayload<T>;

/**
 * Validates an event against its schema
 */
export function validateRealtimeEvent<T extends RealtimeEventType>(
	type: T,
	data: unknown
): RealtimeEventPayload<T> {
	const schema = realtimeSchema[type];
	return schema.parse(data) as RealtimeEventPayload<T>;
}

/**
 * Type guard to check if a string is a valid event type
 */
export function isValidEventType(type: unknown): type is RealtimeEventType {
	return typeof type === "string" && type in realtimeSchema;
}

export function getEventPayload<T extends RealtimeEventType>(
	event: RealtimeEvent<T>
): RealtimeEventPayload<T> {
	return event.payload;
}
