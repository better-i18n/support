import type { CapturedFinalAction } from "../generation/contracts";
import type { PipelineToolContext, ToolRuntimeError } from "./contracts";

export function incrementToolCall(
	ctx: PipelineToolContext,
	toolName: string
): void {
	ctx.runtimeState.toolCallCounts[toolName] =
		(ctx.runtimeState.toolCallCounts[toolName] ?? 0) + 1;
}

export function setFinalAction(
	ctx: PipelineToolContext,
	action: CapturedFinalAction
): void {
	ctx.runtimeState.finalAction = action;
}

export function setToolError(
	ctx: PipelineToolContext,
	error: ToolRuntimeError
): void {
	ctx.runtimeState.lastToolError = error;
}
