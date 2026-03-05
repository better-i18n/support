import type { ConversationSelect } from "@api/db/schema/conversation";
import type { ToolSet } from "ai";
import type {
	CapturedFinalAction,
	GenerationMode,
	PipelineKind,
} from "../generation/contracts";

export type PipelineToolResult<T = unknown> = {
	success: boolean;
	error?: string;
	data?: T;
};

export type ToolRuntimeError = {
	toolName: string;
	error: string;
	fatal: boolean;
};

export type ToolRuntimeState = {
	finalAction: CapturedFinalAction | null;
	publicMessagesSent: number;
	toolCallCounts: Record<string, number>;
	publicSendSequence: number;
	privateSendSequence: number;
	sentPublicMessageIds: Set<string>;
	lastToolError: ToolRuntimeError | null;
};

export type PipelineToolContext = {
	db: import("@api/db").Database;
	conversation: ConversationSelect;
	conversationId: string;
	organizationId: string;
	websiteId: string;
	visitorId: string;
	aiAgentId: string;
	aiAgentName: string;
	visitorName: string;
	workflowRunId: string;
	triggerMessageId: string;
	triggerMessageCreatedAt?: string;
	triggerSenderType?: "visitor" | "human_agent" | "ai_agent";
	triggerVisibility?: "public" | "private";
	allowPublicMessages: boolean;
	pipelineKind: PipelineKind;
	mode: GenerationMode;
	isEscalated: boolean;
	startTyping?: () => Promise<void>;
	stopTyping?: () => Promise<void>;
	runtimeState: ToolRuntimeState;
};

export type PipelineToolFactory = (
	ctx: PipelineToolContext
) => ToolSet[string] | null;

export type ToolAvailability = {
	primary: boolean;
	background: boolean;
	publicOnly?: boolean;
};
