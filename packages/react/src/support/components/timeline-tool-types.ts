import type { TimelineItem } from "@cossistant/types/api/timeline-item";
import type React from "react";

export type ConversationTimelineToolProps = {
	item: TimelineItem;
	conversationId: string;
};

export type ConversationTimelineProcessingProps = {
	toolName: string;
	message?: string | null;
};

export type ConversationTimelineToolDefinition = {
	component: React.ComponentType<ConversationTimelineToolProps>;
	processingComponent?: React.ComponentType<ConversationTimelineProcessingProps>;
};

export type ConversationTimelineTools = Record<
	string,
	ConversationTimelineToolDefinition
>;
