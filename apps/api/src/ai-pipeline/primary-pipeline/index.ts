import type {
	PrimaryPipelineContext,
	PrimaryPipelineResult,
} from "./contracts";
import { runDecisionStep } from "./steps/decision";
import { runIntakeStep } from "./steps/intake";
import {
	buildCompletedResult,
	buildErrorResult,
	buildSkippedResult,
} from "./utils/pipeline-result";
import { createStageMetrics, measureStage } from "./utils/stage-metrics";

export type {
	ConversationState,
	ModelResolution,
	PrimaryPipelineContext,
	PrimaryPipelineInput,
	PrimaryPipelineMetrics,
	PrimaryPipelineResult,
	RoleAwareMessage,
	SenderType,
	VisitorContext,
} from "./contracts";
export type { DecisionResult, ResponseMode } from "./steps/decision";
export type { SmartDecisionResult } from "./steps/decision/smart";
export type {
	IntakeReadyContext,
	IntakeStepResult,
} from "./steps/intake/types";

export async function runPrimaryPipeline(
	ctx: PrimaryPipelineContext
): Promise<PrimaryPipelineResult> {
	const pipelineStartedAt = Date.now();
	const metrics = createStageMetrics();

	console.log(
		`[ai-pipeline:primary] conv=${ctx.input.conversationId} | trigger=${ctx.input.messageId} | workflowRunId=${ctx.input.workflowRunId} | jobId=${ctx.input.jobId}`
	);

	try {
		const intakeResult = await measureStage(metrics, "intakeMs", () =>
			runIntakeStep({
				db: ctx.db,
				input: ctx.input,
			})
		);

		if (intakeResult.status !== "ready") {
			console.log(
				`[ai-pipeline:primary] conv=${ctx.input.conversationId} | stage=intake | status=skipped | reason="${intakeResult.reason}"`
			);

			return buildSkippedResult({
				metrics,
				pipelineStartedAt,
				reason: intakeResult.reason,
				action: "intake_skipped",
			});
		}

		const decisionResult = await measureStage(metrics, "decisionMs", () =>
			runDecisionStep({
				db: ctx.db,
				input: intakeResult.data,
			})
		);

		if (!decisionResult.shouldAct) {
			console.log(
				`[ai-pipeline:primary] conv=${ctx.input.conversationId} | stage=decision | status=skipped | mode=${decisionResult.mode} | reason="${decisionResult.reason}"`
			);

			return buildSkippedResult({
				metrics,
				pipelineStartedAt,
				reason: decisionResult.reason,
				action: "decision_skipped",
			});
		}

		console.log(
			`[ai-pipeline:primary] conv=${ctx.input.conversationId} | stage=decision | status=completed | mode=${decisionResult.mode} | action=decision_ready`
		);

		return buildCompletedResult({
			metrics,
			pipelineStartedAt,
			action: "decision_ready",
			reason: decisionResult.reason,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown pipeline error";

		console.error(
			`[ai-pipeline:primary] conv=${ctx.input.conversationId} | status=error | message="${message}"`,
			error
		);

		return buildErrorResult({
			metrics,
			pipelineStartedAt,
			error: message,
			retryable: true,
			action: "primary_error",
		});
	}
}
