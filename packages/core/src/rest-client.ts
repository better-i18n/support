import type { IdentifyContactResponse } from "@cossistant/types/api/contact";
import type {
	CreateConversationRequestBody,
	CreateConversationResponseBody,
	GetConversationRequest,
	GetConversationResponse,
	GetConversationSeenDataResponse,
	ListConversationsRequest,
	ListConversationsResponse,
	MarkConversationSeenRequestBody,
	MarkConversationSeenResponseBody,
	SetConversationTypingRequestBody,
	SetConversationTypingResponseBody,
} from "@cossistant/types/api/conversation";
import type {
        GetConversationTimelineItemsRequest,
        GetConversationTimelineItemsResponse,
        SendTimelineItemRequest,
        SendTimelineItemResponse,
} from "@cossistant/types/api/timeline-item";
import type {
        GenerateUploadUrlRequest,
        GenerateUploadUrlResponse,
} from "@cossistant/types/api/upload";
import { logger } from "./logger";
import {
	CossistantAPIError,
	type CossistantConfig,
	type PublicWebsiteResponse,
	type UpdateVisitorRequest,
	type VisitorMetadata,
	type VisitorResponse,
} from "./types";
import { generateConversationId } from "./utils";
import { collectVisitorData } from "./visitor-data";
import {
	getExistingVisitorId,
	getVisitorId,
	setVisitorId,
} from "./visitor-tracker";

export class CossistantRestClient {
	private config: CossistantConfig;
	private baseHeaders: Record<string, string>;
	private publicKey: string;
	private websiteId: string | null = null;
	private visitorId: string | null = null;
	private visitorBlocked = false;

	constructor(config: CossistantConfig) {
		this.config = config;

		// Get public key from config or environment variables
		this.publicKey =
			config.publicKey ||
			(typeof process !== "undefined"
				? process.env.NEXT_PUBLIC_COSSISTANT_API_KEY
				: undefined) ||
			(typeof process !== "undefined"
				? process.env.COSSISTANT_API_KEY
				: undefined) ||
			(typeof process !== "undefined"
				? process.env.NEXT_PUBLIC_COSSISTANT_KEY
				: undefined) ||
			"";

		if (!this.publicKey) {
			throw new Error(
				"Public key is required. Please provide it in the config or set NEXT_PUBLIC_COSSISTANT_API_KEY or COSSISTANT_API_KEY environment variable."
			);
		}

		this.baseHeaders = {
			"Content-Type": "application/json",
			"X-Public-Key": this.publicKey,
		};

		if (config.userId) {
			this.baseHeaders["X-User-ID"] = config.userId;
		}

		if (config.organizationId) {
			this.baseHeaders["X-Organization-ID"] = config.organizationId;
		}
	}

	private normalizeVisitorResponse(payload: VisitorResponse): VisitorResponse {
		const contact = payload.contact ? payload.contact : null;
		return {
			...payload,
			// Ensure latitude and longitude are numbers or null
			latitude:
				typeof payload.latitude === "string"
					? Number.parseFloat(payload.latitude)
					: payload.latitude,
			longitude:
				typeof payload.longitude === "string"
					? Number.parseFloat(payload.longitude)
					: payload.longitude,
			createdAt: payload.createdAt,
			updatedAt: payload.updatedAt,
			lastSeenAt: payload.lastSeenAt ? payload.lastSeenAt : null,
			blockedAt: payload.blockedAt ? payload.blockedAt : null,
			contact: payload.contact ? payload.contact : null,
		};
	}

	private resolveVisitorId(): string {
		if (this.visitorId) {
			return this.visitorId;
		}

		if (this.websiteId) {
			const storedVisitorId = getVisitorId(this.websiteId);
			if (storedVisitorId) {
				this.visitorId = storedVisitorId;
				return storedVisitorId;
			}
		}

		throw new Error("Visitor ID is required");
	}

	private async syncVisitorSnapshot(visitorId: string): Promise<void> {
		try {
			const visitorData = await collectVisitorData();
			if (!visitorData) {
				return;
			}

			const payload = Object.entries(visitorData).reduce<
				Partial<UpdateVisitorRequest>
			>((acc, [key, value]) => {
				if (value === null || value === undefined) {
					return acc;
				}
				(acc as Record<string, unknown>)[key] = value;
				return acc;
			}, {});

			if (Object.keys(payload).length === 0) {
				return;
			}

			await this.request<VisitorResponse>(`/visitors/${visitorId}`, {
				method: "PATCH",
				body: JSON.stringify(payload),
				headers: {
					"X-Visitor-Id": visitorId,
				},
			});
		} catch (error) {
			logger.warn("Failed to sync visitor data", error);
		}
	}

	private async request<T>(
		path: string,
		options: RequestInit = {}
	): Promise<T> {
		if (this.visitorBlocked) {
			const method = (options.method ?? "GET").toUpperCase();
			const [rawPath] = path.split("?");
			const normalizedPath = rawPath?.endsWith("/")
				? rawPath.slice(0, -1)
				: rawPath;
			const isWebsitesRoot = normalizedPath === "/websites";
			const isSafeMethod = method === "GET" || method === "HEAD";

			if (!(isWebsitesRoot && isSafeMethod)) {
				throw new CossistantAPIError({
					code: "VISITOR_BLOCKED",
					message: "Visitor is blocked and cannot perform this action.",
					details: { path, method },
				});
			}
		}

		const url = `${this.config.apiUrl}${path}`;

		const response = await fetch(url, {
			...options,
			headers: {
				...this.baseHeaders,
				...options.headers,
			},
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const statusCode = response.status;
			const errorCode = errorData.code || `HTTP_${statusCode}`;
			const serverMessage = errorData.message;

			// Determine if this is an authentication/authorization error
			const isAuthError =
				statusCode === 401 ||
				statusCode === 403 ||
				errorCode === "UNAUTHORIZED" ||
				errorCode === "FORBIDDEN" ||
				errorCode === "INVALID_API_KEY" ||
				errorCode === "API_KEY_EXPIRED" ||
				errorCode === "API_KEY_MISSING" ||
				errorCode?.toUpperCase().includes("AUTH") ||
				errorCode?.toUpperCase().includes("API_KEY");

			// Use appropriate error message based on error type
			const errorMessage = isAuthError
				? "Your Cossistant public API key is invalid, expired, missing or not authorized to access this resource."
				: serverMessage || `Request failed with status ${statusCode}`;

			// Log with appropriate level based on error type
			if (isAuthError) {
				logger.error(errorMessage, {
					details: errorData.details,
					path,
					status: statusCode,
					code: errorCode,
				});
			} else {
				logger.error("API request failed", {
					message: errorMessage,
					details: errorData.details,
					path,
					status: statusCode,
					code: errorCode,
				});
			}

			throw new CossistantAPIError({
				code: errorCode,
				message: errorMessage,
				details: errorData.details,
			});
		}

		return response.json();
	}

	async getWebsite(): Promise<PublicWebsiteResponse> {
		// Make the request with visitor ID if we have one stored
		const headers: Record<string, string> = {};

		// First, check if we already know the website ID and have a visitor ID for it
		if (this.websiteId) {
			const storedVisitorId = getVisitorId(this.websiteId);
			if (storedVisitorId) {
				headers["X-Visitor-Id"] = storedVisitorId;
			}
		} else {
			// We don't know the website ID yet, but check if we have any existing visitor
			// This prevents creating duplicate visitors on page refresh
			const existingVisitor = getExistingVisitorId(this.publicKey);
			if (existingVisitor) {
				headers["X-Visitor-Id"] = existingVisitor.visitorId;
				// Pre-populate our local state
				this.websiteId = existingVisitor.websiteId;
				this.visitorId = existingVisitor.visitorId;
			}
		}

		const response = await this.request<PublicWebsiteResponse>("/websites", {
			headers,
		});

		// Store the website ID for future requests
		this.websiteId = response.id;

		// Store the visitor ID if we got one
		this.visitorBlocked = response.visitor?.isBlocked ?? false;

		if (response.visitor?.id) {
			if (this.visitorBlocked) {
				this.visitorId = response.visitor.id;
				setVisitorId(response.id, response.visitor.id);
				return response;
			}

			this.visitorId = response.visitor.id;
			setVisitorId(response.id, response.visitor.id);
			this.syncVisitorSnapshot(response.visitor.id);
		}

		return response;
	}

	// Manually prime website and visitor context when the caller already has it
	setWebsiteContext(websiteId: string, visitorId?: string): void {
		this.websiteId = websiteId;
		if (visitorId) {
			this.visitorId = visitorId;
			setVisitorId(websiteId, visitorId);
		}
	}

        setVisitorBlocked(isBlocked: boolean): void {
                this.visitorBlocked = isBlocked;
        }

        async createUploadUrl(
                payload: GenerateUploadUrlRequest
        ): Promise<GenerateUploadUrlResponse> {
                const headers: Record<string, string> = {};

                if (this.websiteId) {
                        const storedVisitorId = getVisitorId(this.websiteId);
                        if (storedVisitorId) {
                                headers["X-Visitor-Id"] = storedVisitorId;
                        }
                }

                return this.request<GenerateUploadUrlResponse>("/uploads/sign-url", {
                        method: "POST",
                        body: JSON.stringify(payload),
                        headers,
                });
        }

        getCurrentWebsiteId(): string | null {
                return this.websiteId;
        }

	getCurrentVisitorId(): string | null {
		if (this.visitorId) {
			return this.visitorId;
		}

		if (!this.websiteId) {
			return null;
		}

		return getVisitorId(this.websiteId) ?? null;
	}

	async updateVisitorMetadata(
		metadata: VisitorMetadata
	): Promise<VisitorResponse> {
		const visitorId = this.resolveVisitorId();
		const response = await this.request<VisitorResponse>(
			`/visitors/${visitorId}/metadata`,
			{
				method: "PATCH",
				body: JSON.stringify({ metadata }),
				headers: {
					"X-Visitor-Id": visitorId,
				},
			}
		);

		return this.normalizeVisitorResponse(response);
	}

	/**
	 * Identify a visitor by creating or updating their contact information
	 * This will link the visitor to a contact record that can be tracked across devices
	 */
	async identify(params: {
		externalId?: string;
		email?: string;
		name?: string;
		image?: string;
		metadata?: Record<string, unknown>;
		contactOrganizationId?: string;
	}): Promise<IdentifyContactResponse> {
		const visitorId = this.resolveVisitorId();

		const response = await this.request<IdentifyContactResponse>(
			"/contacts/identify",
			{
				method: "POST",
				body: JSON.stringify({
					visitorId,
					...params,
				}),
				headers: {
					"X-Visitor-Id": visitorId,
				},
			}
		);

		return {
			contact: {
				...response.contact,
				// Ensure metadata is properly typed
				metadata:
					typeof response.contact.metadata === "string"
						? JSON.parse(response.contact.metadata)
						: response.contact.metadata,
				createdAt: response.contact.createdAt,
				updatedAt: response.contact.updatedAt,
			},
			visitorId: response.visitorId,
		};
	}

	/**
	 * Update metadata for the contact associated with the current visitor
	 * Note: The visitor must be identified first via the identify() method
	 */
	async updateContactMetadata(
		metadata: Record<string, unknown>
	): Promise<VisitorResponse> {
		// This still uses the visitor metadata endpoint for backward compatibility
		// The endpoint will internally update the contact metadata
		return this.updateVisitorMetadata(metadata as VisitorMetadata);
	}

	async createConversation(
		params: Partial<CreateConversationRequestBody> = {}
	): Promise<CreateConversationResponseBody> {
		const conversationId = params.conversationId || generateConversationId();

		// Get visitor ID from storage if we have the website ID, or use the provided one
		const storedVisitorId = this.websiteId
			? getVisitorId(this.websiteId)
			: undefined;
		const visitorId = params.visitorId || storedVisitorId;

		if (!visitorId) {
			throw new Error("Visitor ID is required");
		}

		const body: CreateConversationRequestBody = {
			conversationId,
			visitorId,
			defaultTimelineItems: params.defaultTimelineItems || [],
			channel: params.channel || "widget",
		};

		// Add visitor ID header if available
		const headers: Record<string, string> = {};
		if (visitorId) {
			headers["X-Visitor-Id"] = visitorId;
		}

		const response = await this.request<CreateConversationResponseBody>(
			"/conversations",
			{
				method: "POST",
				body: JSON.stringify(body),
				headers,
			}
		);

		// Convert date strings to Date objects
		return {
			conversation: {
				...response.conversation,
				createdAt: response.conversation.createdAt,
				updatedAt: response.conversation.updatedAt,
				deletedAt: response.conversation.deletedAt ?? null,
				lastTimelineItem: response.conversation.lastTimelineItem,
			},
			initialTimelineItems: response.initialTimelineItems,
		};
	}

	async updateConfiguration(config: Partial<CossistantConfig>): Promise<void> {
		if (config.publicKey) {
			this.publicKey = config.publicKey;
			this.baseHeaders["X-Public-Key"] = config.publicKey;
		}

		if (config.userId) {
			this.baseHeaders["X-User-ID"] = config.userId;
		} else if (config.userId === null) {
			const { "X-User-ID": _, ...rest } = this.baseHeaders;
			this.baseHeaders = rest;
		}

		if (config.organizationId) {
			this.baseHeaders["X-Organization-ID"] = config.organizationId;
		} else if (config.organizationId === null) {
			const { "X-Organization-ID": _, ...rest } = this.baseHeaders;
			this.baseHeaders = rest;
		}

		this.config = { ...this.config, ...config };
	}

	async listConversations(
		params: Partial<ListConversationsRequest> = {}
	): Promise<ListConversationsResponse> {
		// Get visitor ID from storage if we have the website ID, or use the provided one
		const storedVisitorId = this.websiteId
			? getVisitorId(this.websiteId)
			: undefined;
		const visitorId = params.visitorId || storedVisitorId;

		if (!visitorId) {
			throw new Error("Visitor ID is required");
		}

		// Create query parameters
		const queryParams = new URLSearchParams();

		if (visitorId) {
			queryParams.set("visitorId", visitorId);
		}

		if (params.page) {
			queryParams.set("page", params.page.toString());
		}

		if (params.limit) {
			queryParams.set("limit", params.limit.toString());
		}

		if (params.status) {
			queryParams.set("status", params.status);
		}

		if (params.orderBy) {
			queryParams.set("orderBy", params.orderBy);
		}

		if (params.order) {
			queryParams.set("order", params.order);
		}

		// Add visitor ID header if available
		const headers: Record<string, string> = {};
		if (visitorId) {
			headers["X-Visitor-Id"] = visitorId;
		}

		const response = await this.request<ListConversationsResponse>(
			`/conversations?${queryParams.toString()}`,
			{
				headers,
			}
		);

		// Convert date strings to Date objects
		return {
			conversations: response.conversations.map((conv) => ({
				...conv,
				createdAt: conv.createdAt,
				updatedAt: conv.updatedAt,
				deletedAt: conv.deletedAt ?? null,
				lastTimelineItem: conv.lastTimelineItem,
			})),
			pagination: response.pagination,
		};
	}

	async getConversation(
		params: GetConversationRequest
	): Promise<GetConversationResponse> {
		// Get visitor ID from storage if we have the website ID
		const visitorId = this.websiteId ? getVisitorId(this.websiteId) : undefined;

		// Add visitor ID header if available
		const headers: Record<string, string> = {};
		if (visitorId) {
			headers["X-Visitor-Id"] = visitorId;
		}

		const response = await this.request<GetConversationResponse>(
			`/conversations/${params.conversationId}`,
			{
				headers,
			}
		);

		// Convert date strings to Date objects
		return {
			conversation: {
				...response.conversation,
				createdAt: response.conversation.createdAt,
				updatedAt: response.conversation.updatedAt,
				deletedAt: response.conversation.deletedAt ?? null,
				lastTimelineItem: response.conversation.lastTimelineItem,
			},
		};
	}

	async markConversationSeen(
		params: {
			conversationId: string;
		} & Partial<MarkConversationSeenRequestBody>
	): Promise<MarkConversationSeenResponseBody> {
		const storedVisitorId = this.websiteId
			? getVisitorId(this.websiteId)
			: undefined;
		const visitorId = params.visitorId || storedVisitorId;

		if (!visitorId) {
			throw new Error("Visitor ID is required to mark a conversation as seen");
		}

		const headers: Record<string, string> = {};
		if (visitorId) {
			headers["X-Visitor-Id"] = visitorId;
		}

		const body: MarkConversationSeenRequestBody = {};
		if (params.visitorId) {
			body.visitorId = params.visitorId;
		}

		const response = await this.request<MarkConversationSeenResponseBody>(
			`/conversations/${params.conversationId}/seen`,
			{
				method: "POST",
				body: JSON.stringify(body),
				headers,
			}
		);

		return {
			conversationId: response.conversationId,
			lastSeenAt: response.lastSeenAt,
		};
	}

	async getConversationSeenData(params: {
		conversationId: string;
	}): Promise<GetConversationSeenDataResponse> {
		const response = await this.request<GetConversationSeenDataResponse>(
			`/conversations/${params.conversationId}/seen`,
			{
				method: "GET",
			}
		);

		return {
			seenData: response.seenData.map((item) => ({
				...item,
				lastSeenAt: item.lastSeenAt,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
				deletedAt: item.deletedAt ? item.deletedAt : null,
			})),
		};
	}

	async setConversationTyping(params: {
		conversationId: string;
		isTyping: boolean;
		visitorPreview?: string | null;
		visitorId?: string;
	}): Promise<SetConversationTypingResponseBody> {
		const storedVisitorId = this.websiteId
			? getVisitorId(this.websiteId)
			: undefined;
		const visitorId = params.visitorId || storedVisitorId;

		if (!visitorId) {
			throw new Error("Visitor ID is required to report typing state");
		}

		const headers: Record<string, string> = {};
		if (visitorId) {
			headers["X-Visitor-Id"] = visitorId;
		}

		const body: SetConversationTypingRequestBody = {
			isTyping: params.isTyping,
		};

		if (params.visitorId) {
			body.visitorId = params.visitorId;
		}

		if (params.visitorPreview && params.isTyping) {
			body.visitorPreview = params.visitorPreview.slice(0, 2000);
		}

		const response = await this.request<SetConversationTypingResponseBody>(
			`/conversations/${params.conversationId}/typing`,
			{
				method: "POST",
				body: JSON.stringify(body),
				headers,
			}
		);

		return {
			conversationId: response.conversationId,
			isTyping: response.isTyping,
			visitorPreview: response.visitorPreview,
			sentAt: response.sentAt,
		};
	}

	async sendMessage(
		params: SendTimelineItemRequest
	): Promise<SendTimelineItemResponse> {
		// Get visitor ID from storage if we have the website ID
		const visitorId = this.websiteId ? getVisitorId(this.websiteId) : undefined;

		// Add visitor ID header if available
		const headers: Record<string, string> = {};
		if (visitorId) {
			headers["X-Visitor-Id"] = visitorId;
		}

		const response = await this.request<SendTimelineItemResponse>("/messages", {
			method: "POST",
			body: JSON.stringify(params),
			headers,
		});

		return {
			item: response.item,
		};
	}

	async getConversationTimelineItems(
		params: GetConversationTimelineItemsRequest & { conversationId: string }
	): Promise<GetConversationTimelineItemsResponse> {
		// Get visitor ID from storage if we have the website ID
		const visitorId = this.websiteId ? getVisitorId(this.websiteId) : undefined;

		// Create query parameters
		const queryParams = new URLSearchParams();

		if (params.limit) {
			queryParams.set("limit", params.limit.toString());
		}

		if (params.cursor) {
			queryParams.set("cursor", params.cursor);
		}

		// Add visitor ID header if available
		const headers: Record<string, string> = {};
		if (visitorId) {
			headers["X-Visitor-Id"] = visitorId;
		}

		const response = await this.request<GetConversationTimelineItemsResponse>(
			`/conversations/${params.conversationId}/timeline?${queryParams.toString()}`,
			{
				headers,
			}
		);

		return {
			items: response.items,
			nextCursor: response.nextCursor,
			hasNextPage: response.hasNextPage,
		};
	}
}
