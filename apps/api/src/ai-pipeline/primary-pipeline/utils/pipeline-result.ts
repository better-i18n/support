import type { PrimaryPipelineResult } from "../contracts";
import {
	finalizeStageMetrics,
	type MutableStageMetrics,
} from "./stage-metrics";

type ResultParams = {
	metrics: MutableStageMetrics;
	pipelineStartedAt: number;
};

export function buildCompletedResult(
	params: ResultParams & {
		action?: string;
		reason?: string;
	}
): PrimaryPipelineResult {
	return {
		status: "completed",
		action: params.action,
		reason: params.reason,
		publicMessagesSent: 0,
		retryable: false,
		metrics: finalizeStageMetrics({
			metrics: params.metrics,
			pipelineStartedAt: params.pipelineStartedAt,
		}),
	};
}

export function buildSkippedResult(
	params: ResultParams & {
		reason: string;
		action?: string;
	}
): PrimaryPipelineResult {
	return {
		status: "skipped",
		action: params.action,
		reason: params.reason,
		publicMessagesSent: 0,
		retryable: false,
		metrics: finalizeStageMetrics({
			metrics: params.metrics,
			pipelineStartedAt: params.pipelineStartedAt,
		}),
	};
}

export function buildErrorResult(
	params: ResultParams & {
		error: string;
		retryable?: boolean;
		action?: string;
	}
): PrimaryPipelineResult {
	return {
		status: "error",
		action: params.action,
		error: params.error,
		publicMessagesSent: 0,
		retryable: params.retryable ?? true,
		metrics: finalizeStageMetrics({
			metrics: params.metrics,
			pipelineStartedAt: params.pipelineStartedAt,
		}),
	};
}
