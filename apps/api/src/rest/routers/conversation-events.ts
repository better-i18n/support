import { getConversationEvents } from "@api/db/queries/conversation";
import {
        safelyExtractRequestQuery,
        validateResponse,
} from "@api/utils/validate";
import {
        getConversationEventsRequestSchema,
        getConversationEventsResponseSchema,
        type GetConversationEventsResponse,
} from "@cossistant/types/api/conversation-event";
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { protectedPublicApiKeyMiddleware } from "../middleware";
import type { RestContext } from "../types";

export const conversationEventsRouter = new OpenAPIHono<RestContext>();

conversationEventsRouter.use("/*", ...protectedPublicApiKeyMiddleware);

conversationEventsRouter.openapi(
        {
                method: "get",
                path: "/",
                summary: "List timeline events for a conversation",
                description:
                        "Fetch paginated conversation events in chronological order for a visitor conversation.",
                tags: ["Conversation Events"],
                request: {
                        query: getConversationEventsRequestSchema,
                },
                responses: {
                        200: {
                                description: "Conversation events retrieved successfully",
                                content: {
                                        "application/json": {
                                                schema: getConversationEventsResponseSchema,
                                        },
                                },
                        },
                        400: {
                                description: "Invalid request",
                                content: {
                                        "application/json": {
                                                schema: z.object({ error: z.string() }),
                                        },
                                },
                        },
                },
                security: [
                        {
                                "Public API Key": [],
                        },
                        {
                                "Private API Key": [],
                        },
                ],
                parameters: [
                        {
                                name: "Authorization",
                                in: "header",
                                description:
                                        "Private API key in Bearer token format. Use this for server-to-server authentication.",
                                required: false,
                                schema: {
                                        type: "string",
                                        pattern: "^Bearer sk_(live|test)_[a-f0-9]{64}$",
                                },
                        },
                        {
                                name: "X-Public-Key",
                                in: "header",
                                description:
                                        "Public API key for browser authentication. Format: `pk_[live|test]_...`",
                                required: false,
                                schema: {
                                        type: "string",
                                        pattern: "^pk_(live|test)_[a-f0-9]{64}$",
                                },
                        },
                        {
                                name: "X-Visitor-Id",
                                in: "header",
                                description: "Visitor ID from storage, used to scope access.",
                                required: false,
                                schema: {
                                        type: "string",
                                        pattern: "^[0-9A-HJKMNP-TV-Z]{26}$",
                                },
                        },
                ],
        },
        async (c) => {
                const { db, website, query } = await safelyExtractRequestQuery(
                        c,
                        getConversationEventsRequestSchema
                );

                const result = await getConversationEvents(db, {
                        conversationId: query.conversationId,
                        websiteId: website.id,
                        limit: query.limit,
                        cursor: query.cursor,
                });

                const response: GetConversationEventsResponse = {
                        events: result.events.map((event) => ({
                                id: event.id,
                                organizationId: event.organizationId,
                                conversationId: event.conversationId,
                                type: event.type,
                                actorUserId: event.actorUserId,
                                actorAiAgentId: event.actorAiAgentId,
                                targetUserId: event.targetUserId,
                                targetAiAgentId: event.targetAiAgentId,
                                message: event.message ?? null,
                                metadata: (event.metadata as Record<string, unknown> | null) ?? null,
                                createdAt: event.createdAt,
                                updatedAt: event.createdAt,
                                deletedAt: null,
                        })),
                        hasNextPage: result.hasNextPage,
                        ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
                };

                return c.json(validateResponse(response, getConversationEventsResponseSchema));
        }
);
