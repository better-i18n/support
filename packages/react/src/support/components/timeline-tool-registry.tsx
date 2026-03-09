import {
	isWidgetLiveStatusTool,
	isWidgetTimelineTool,
} from "@cossistant/types";
import type React from "react";
import type {
	ConversationTimelineProcessingProps,
	ConversationTimelineToolProps,
	ConversationTimelineTools,
} from "./timeline-tool-types";
import {
	GenericWidgetToolProcessingIndicator,
	GenericWidgetToolTimelineTool,
} from "./timeline-widget-tool";

export function resolveConversationTimelineToolComponent(
	toolName: string | null | undefined,
	tools?: ConversationTimelineTools
): React.ComponentType<ConversationTimelineToolProps> | null {
	if (!toolName) {
		return null;
	}

	const customComponent = tools?.[toolName]?.component;
	if (customComponent) {
		return customComponent;
	}

	return isWidgetTimelineTool(toolName) ? GenericWidgetToolTimelineTool : null;
}

export function resolveConversationTimelineProcessingComponent(
	toolName: string | null | undefined,
	tools?: ConversationTimelineTools
): React.ComponentType<ConversationTimelineProcessingProps> | null {
	if (!toolName) {
		return null;
	}

	const customComponent = tools?.[toolName]?.processingComponent;
	if (customComponent) {
		return customComponent;
	}

	return isWidgetLiveStatusTool(toolName)
		? GenericWidgetToolProcessingIndicator
		: null;
}
