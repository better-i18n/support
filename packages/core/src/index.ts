export type { CossistantConfig, CossistantError } from "@cossistant/types";
// AI SDK v6 conversion utilities
export {
	type AISDKFilePart,
	type AISDKPart,
	type AISDKReasoningPart,
	type AISDKSourceDocumentPart,
	type AISDKSourceUrlPart,
	type AISDKStepStartPart,
	type AISDKTextPart,
	type AISDKToolPart,
	type CossistantMessageMetadata,
	type CossistantPartMetadata,
	type CossistantUIMessage,
	extractSources,
	extractToolCalls,
	type FromUIMessageContext,
	fromUIMessage,
	fromUIMessages,
	hasProcessingParts,
	isAISDKCompatiblePart,
	toUIMessage,
	toUIMessages,
} from "./ai-sdk-utils";
export { CossistantClient, CossistantClient as default } from "./client";
export { normalizeLocale } from "./locale-utils";
// Privacy filter utilities
export {
	type Audience,
	countVisibleParts,
	extractVisibleText,
	type FilterOptions,
	filterMessageForAudience,
	filterMessagesForAudience,
	filterTimelineItemForAudience,
	filterTimelineItemsForAudience,
	hasVisibleContent,
	PrivacyPresets,
} from "./privacy-filter";
export { CossistantRestClient } from "./rest-client";
export {
	type ConversationPagination,
	type ConversationsState,
	type ConversationsStore,
	type ConversationWithSeen,
	createConversationsStore,
	getConversationById,
	getConversationPagination,
	getConversations,
} from "./store/conversations-store";
export {
	applyConversationSeenEvent,
	type ConversationSeenState,
	createSeenStore,
	hydrateConversationSeen,
	type SeenActorType,
	type SeenEntry,
	type SeenState,
	type SeenStore,
	upsertConversationSeen,
} from "./store/seen-store";
export {
	createSupportStore,
	type DefaultRoutes,
	type NavigationState,
	type RouteRegistry,
	type SUPPORT_PAGES,
	type SupportConfig,
	type SupportNavigation,
	type SupportPage,
	type SupportStore,
	type SupportStoreActions,
	type SupportStoreOptions,
	type SupportStoreState,
	type SupportStoreStorage,
} from "./store/support-store";
export {
	type ConversationTimelineItemsState,
	createTimelineItemsStore,
	getConversationTimelineItems,
	type TimelineItemsState,
	type TimelineItemsStore,
} from "./store/timeline-items-store";
export {
	applyConversationTypingEvent,
	type ConversationTypingState,
	clearTypingFromTimelineItem,
	clearTypingState,
	createTypingStore,
	getConversationTyping,
	setTypingState,
	type TypingActorType,
	type TypingEntry,
	type TypingState,
	type TypingStore,
	type TypingStoreDependencies,
} from "./store/typing-store";
export {
	createWebsiteStore,
	getWebsiteState,
	type WebsiteError,
	type WebsiteState,
	type WebsiteStatus,
	type WebsiteStore,
} from "./store/website-store";
// Core-specific exports
export { CossistantAPIError } from "./types";
export type { TypingReporter, TypingReporterConfig } from "./typing-reporter";
// Typing reporter shared logic
export {
	createTypingReporter,
	TYPING_KEEP_ALIVE_MS,
	TYPING_PREVIEW_MAX_LENGTH,
	TYPING_SEND_INTERVAL_MS,
	TYPING_STOP_DELAY_MS,
} from "./typing-reporter";
// Upload constants and utilities
export {
	ALLOWED_FILE_TYPES_DESCRIPTION,
	ALLOWED_MIME_TYPES,
	FILE_INPUT_ACCEPT,
	formatFileSize,
	isAllowedMimeType,
	isImageMimeType,
	MAX_FILE_SIZE,
	MAX_FILES_PER_MESSAGE,
	validateFile,
	validateFiles,
} from "./upload-constants";
// Utility exports
export { generateConversationId, generateMessageId } from "./utils";
export { collectVisitorData, type VisitorData } from "./visitor-data";
export {
	generateVisitorName,
	getVisitorNameWithFallback,
} from "./visitor-name";
export {
	clearAllVisitorIds,
	clearVisitorId,
	getVisitorId,
	setVisitorId,
} from "./visitor-tracker";
// WebSocket client removed - use React WebSocket context instead
