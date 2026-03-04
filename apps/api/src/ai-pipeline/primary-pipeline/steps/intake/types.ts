import type { AiAgentSelect } from "@api/db/schema/ai-agent";
import type { ConversationSelect } from "@api/db/schema/conversation";
import type {
	ConversationState,
	ModelResolution,
	RoleAwareMessage,
	VisitorContext,
} from "../../contracts";

export type IntakeReadyContext = {
	aiAgent: AiAgentSelect;
	modelResolution: ModelResolution;
	conversation: ConversationSelect;
	conversationHistory: RoleAwareMessage[];
	visitorContext: VisitorContext | null;
	conversationState: ConversationState;
	triggerMessage: RoleAwareMessage | null;
};

export type IntakeStepResult =
	| {
			status: "ready";
			data: IntakeReadyContext;
	  }
	| {
			status: "skipped";
			reason: string;
	  };

export type TriggerMessageMetadata = {
	id: string;
	createdAt: string;
	conversationId: string;
};
