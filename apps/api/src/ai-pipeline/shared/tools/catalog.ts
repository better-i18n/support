import type {
	AiAgentBehaviorSettingKey,
	AiAgentToolId,
} from "@cossistant/types";
import {
	createSetPriorityTool,
	createUpdateConversationTitleTool,
	createUpdateSentimentTool,
} from "./analysis";
import {
	createIdentifyVisitorTool,
	createSearchKnowledgeBaseTool,
} from "./context";
import type { PipelineToolFactory, ToolAvailability } from "./contracts";
import {
	createEscalateTool,
	createMarkSpamTool,
	createResolveTool,
	createRespondTool,
	createSkipTool,
} from "./finish";
import {
	createSendMessageTool,
	createSendPrivateMessageTool,
} from "./messaging";

export const FINISH_TOOL_IDS = [
	"respond",
	"escalate",
	"resolve",
	"markSpam",
	"skip",
] as const;

export type FinishToolId = (typeof FINISH_TOOL_IDS)[number];

export type ToolCatalogEntry = {
	id: AiAgentToolId;
	factory: PipelineToolFactory;
	availability: ToolAvailability;
	behaviorSettingKey: AiAgentBehaviorSettingKey | null;
};

export const SHARED_PIPELINE_TOOL_CATALOG: readonly ToolCatalogEntry[] = [
	{
		id: "searchKnowledgeBase",
		factory: createSearchKnowledgeBaseTool,
		availability: { primary: true, background: true },
		behaviorSettingKey: null,
	},
	{
		id: "identifyVisitor",
		factory: createIdentifyVisitorTool,
		availability: { primary: true, background: true },
		behaviorSettingKey: null,
	},
	{
		id: "updateConversationTitle",
		factory: createUpdateConversationTitleTool,
		availability: { primary: true, background: true },
		behaviorSettingKey: "autoGenerateTitle",
	},
	{
		id: "updateSentiment",
		factory: createUpdateSentimentTool,
		availability: { primary: true, background: true },
		behaviorSettingKey: "autoAnalyzeSentiment",
	},
	{
		id: "setPriority",
		factory: createSetPriorityTool,
		availability: { primary: true, background: true },
		behaviorSettingKey: "canSetPriority",
	},
	{
		id: "sendMessage",
		factory: createSendMessageTool,
		availability: { primary: true, background: false, publicOnly: true },
		behaviorSettingKey: null,
	},
	{
		id: "sendPrivateMessage",
		factory: createSendPrivateMessageTool,
		availability: { primary: true, background: true },
		behaviorSettingKey: null,
	},
	{
		id: "respond",
		factory: createRespondTool,
		availability: { primary: true, background: false, publicOnly: true },
		behaviorSettingKey: null,
	},
	{
		id: "escalate",
		factory: createEscalateTool,
		availability: { primary: true, background: false, publicOnly: true },
		behaviorSettingKey: "canEscalate",
	},
	{
		id: "resolve",
		factory: createResolveTool,
		availability: { primary: true, background: false, publicOnly: true },
		behaviorSettingKey: "canResolve",
	},
	{
		id: "markSpam",
		factory: createMarkSpamTool,
		availability: { primary: true, background: false, publicOnly: true },
		behaviorSettingKey: "canMarkSpam",
	},
	{
		id: "skip",
		factory: createSkipTool,
		availability: { primary: true, background: true },
		behaviorSettingKey: null,
	},
] as const;
