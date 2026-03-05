import type { PrimaryPipelineResult } from "../contracts";
import {
	finalizeStageMetrics,
	type MutableStageMetrics,
} from "./stage-metrics";

type ResultParams = {
	metrics: MutableStageMetrics;
	pipelineStartedAt: number;
	publicMessagesSent?: number;
	usageTokens?: PrimaryPipelineResult["usageTokens"];
	creditUsage?: PrimaryPipelineResult["creditUsage"];
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
		publicMessagesSent: params.publicMessagesSent ?? 0,
		retryable: false,
		usageTokens: params.usageTokens,
		creditUsage: params.creditUsage,
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
		publicMessagesSent: params.publicMessagesSent ?? 0,
		retryable: false,
		usageTokens: params.usageTokens,
		creditUsage: params.creditUsage,
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
		publicMessagesSent: params.publicMessagesSent ?? 0,
		retryable: params.retryable ?? true,
		usageTokens: params.usageTokens,
		creditUsage: params.creditUsage,
		metrics: finalizeStageMetrics({
			metrics: params.metrics,
			pipelineStartedAt: params.pipelineStartedAt,
		}),
	};
}
