export {
	type BackgroundPipelineInput,
	type BackgroundPipelineResult,
	runBackgroundPipeline,
} from "./background-pipeline";
export {
	type ConversationState,
	type DecisionResult,
	type IntakeReadyContext,
	type IntakeStepResult,
	type ModelResolution,
	type PrimaryPipelineContext,
	type PrimaryPipelineInput,
	type PrimaryPipelineMetrics,
	type PrimaryPipelineResult,
	type ResponseMode,
	type RoleAwareMessage,
	runPrimaryPipeline,
	type SenderType,
	type SmartDecisionResult,
	type VisitorContext,
} from "./primary-pipeline";

export type AiAgentPipelineInput =
	import("./primary-pipeline").PrimaryPipelineInput;
export type AiAgentPipelineResult =
	import("./primary-pipeline").PrimaryPipelineResult;

import { runPrimaryPipeline } from "./primary-pipeline";
export const runAiAgentPipeline = runPrimaryPipeline;
