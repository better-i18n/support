import {
	getWidgetToolDefaultProgressMessage,
	isWidgetLiveStatusTool,
	isWidgetTimelineTool,
} from "@cossistant/types";
import type React from "react";
import {
	extractToolPart,
	getToolNameFromTimelineItem,
	type TimelineToolPartState,
} from "../../utils/timeline-tool";
import Icon, { type IconName } from "./icons";
import type {
	ConversationTimelineProcessingProps,
	ConversationTimelineToolProps,
} from "./timeline-tool-types";

type WidgetToolActivityRowProps = {
	text: string;
	state?: TimelineToolPartState;
	iconName?: IconName;
	detailLabels?: string[];
};

function getGenericToolText(params: {
	toolName: string;
	state: TimelineToolPartState;
	itemText?: string | null;
	errorText?: string;
}): string {
	const { toolName, state, itemText, errorText } = params;
	const trimmedItemText = itemText?.trim();

	if (trimmedItemText) {
		return trimmedItemText;
	}

	if (state === "partial") {
		return (
			getWidgetToolDefaultProgressMessage(toolName) ?? `Running ${toolName}`
		);
	}

	if (state === "error") {
		return errorText?.trim() || `Failed ${toolName}`;
	}

	return `Completed ${toolName}`;
}

export function WidgetToolActivityRow({
	text,
	state = "partial",
	iconName = "star",
	detailLabels = [],
}: WidgetToolActivityRowProps): React.ReactElement {
	return (
		<div className="flex w-full flex-col gap-2">
			<div className="flex items-center gap-2 rounded-lg bg-co-background-300/70 px-3 py-2 text-co-primary/75 text-xs">
				<Icon
					className={
						state === "error"
							? "size-3.5 text-co-destructive"
							: "size-3.5 text-co-primary/70"
					}
					name={iconName}
				/>
				<span className="truncate">{text}</span>
			</div>
			{detailLabels.length > 0 ? (
				<div className="flex flex-wrap gap-1 pl-1">
					{detailLabels.map((label) => (
						<span
							className="max-w-[11rem] truncate rounded-full bg-co-background-300 px-2 py-1 text-[11px] text-co-primary/60"
							key={label}
							title={label}
						>
							{label}
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}

export function GenericWidgetToolTimelineTool({
	item,
}: ConversationTimelineToolProps): React.ReactElement | null {
	const toolName = getToolNameFromTimelineItem(item);

	if (!(toolName && isWidgetTimelineTool(toolName))) {
		return null;
	}

	const toolPart = extractToolPart(item);
	const state = toolPart?.state ?? "partial";

	return (
		<WidgetToolActivityRow
			state={state}
			text={getGenericToolText({
				toolName,
				state,
				itemText: item.text,
				errorText: toolPart?.errorText,
			})}
		/>
	);
}

export function GenericWidgetToolProcessingIndicator({
	toolName,
	message,
}: ConversationTimelineProcessingProps): React.ReactElement | null {
	if (!isWidgetLiveStatusTool(toolName)) {
		return null;
	}

	return (
		<WidgetToolActivityRow
			text={
				message?.trim() ||
				getWidgetToolDefaultProgressMessage(toolName) ||
				`Running ${toolName}`
			}
		/>
	);
}
