/**
 * AI Agent Pipeline Orchestrator
 *
 * This module orchestrates the 5-step AI agent processing pipeline.
 * Each step is isolated and can be tested independently.
 *
 * Pipeline Steps:
 * 1. Intake - Gather context, validate agent is active
 * 2. Decision - Determine if/how AI should respond
 * 3. Generation - Generate response using LLM with structured output
 * 4. Execution - Execute chosen actions (DB writes)
 * 5. Followup - Post-processing, cleanup, emit events
 */

import type { Database } from "@api/db";
import { generateVisitorName } from "@cossistant/core";
import { isWorkflowRunActive } from "@cossistant/jobs/workflow-state";
import type { Redis } from "@cossistant/redis";
import { sendMessage } from "../actions/send-message";
import {
	emitDecisionMade,
	emitWorkflowCancelled,
	emitWorkflowCompleted,
	TypingHeartbeat,
} from "../events";
import { type IntakeResult, intake } from "./1-intake";
import { type DecisionResult, decide } from "./2-decision";
import { type GenerationResult, generate } from "./3-generation";
import { type ExecutionResult, execute } from "./4-execution";
import { followup } from "./5-followup";

export type AiAgentPipelineInput = {
	conversationId: string;
	messageId: string;
	messageCreatedAt: string;
	websiteId: string;
	organizationId: string;
	visitorId: string;
	aiAgentId: string;
	workflowRunId: string;
	jobId: string;
};

export type AiAgentPipelineResult = {
	status: "completed" | "skipped" | "error";
	action?: string;
	reason?: string;
	error?: string;
	metrics: {
		intakeMs: number;
		decisionMs: number;
		generationMs: number;
		executionMs: number;
		followupMs: number;
		totalMs: number;
	};
};

type PipelineContext = {
	db: Database;
	redis: Redis;
	input: AiAgentPipelineInput;
};

/**
 * Run the AI agent pipeline
 *
 * This is the main entry point called by the BullMQ worker.
 * It orchestrates all 5 steps and handles errors gracefully.
 */
export async function runAiAgentPipeline(
	ctx: PipelineContext
): Promise<AiAgentPipelineResult> {
	const startTime = Date.now();
	const convId = ctx.input.conversationId;
	const metrics = {
		intakeMs: 0,
		decisionMs: 0,
		generationMs: 0,
		executionMs: 0,
		followupMs: 0,
		totalMs: 0,
	};

	console.log(
		`[ai-agent] conv=${convId} | Starting pipeline | trigger=${ctx.input.messageId}`
	);

	let intakeResult: IntakeResult | null = null;
	let decisionResult: DecisionResult | null = null;
	let generationResult: GenerationResult | null = null;
	let executionResult: ExecutionResult | null = null;
	let typingHeartbeat: TypingHeartbeat | null = null;

	try {
		// Step 1: Intake - Gather context and validate
		const intakeStart = Date.now();
		intakeResult = await intake(ctx.db, ctx.input);
		metrics.intakeMs = Date.now() - intakeStart;

		if (intakeResult.status !== "ready") {
			console.log(
				`[ai-agent] conv=${convId} | Skipped at intake | reason="${intakeResult.reason}"`
			);
			return {
				status: "skipped",
				reason: intakeResult.reason,
				metrics: finalizeMetrics(metrics, startTime),
			};
		}

		// Step 2: Decision - Should AI act?
		const decisionStart = Date.now();
		decisionResult = await decide({
			aiAgent: intakeResult.aiAgent,
			conversation: intakeResult.conversation,
			conversationHistory: intakeResult.conversationHistory,
			conversationState: intakeResult.conversationState,
			triggerMessage: intakeResult.triggerMessage,
		});
		metrics.decisionMs = Date.now() - decisionStart;

		// Emit decision event
		await emitDecisionMade({
			conversation: intakeResult.conversation,
			aiAgentId: intakeResult.aiAgent.id,
			workflowRunId: ctx.input.workflowRunId,
			shouldAct: decisionResult.shouldAct,
			reason: decisionResult.reason,
			mode: decisionResult.mode,
		});

		if (!decisionResult.shouldAct) {
			console.log(
				`[ai-agent] conv=${convId} | Skipped at decision | reason="${decisionResult.reason}"`
			);

			// Emit completion event (dashboard only since shouldAct=false)
			await emitWorkflowCompleted({
				conversation: intakeResult.conversation,
				aiAgentId: intakeResult.aiAgent.id,
				workflowRunId: ctx.input.workflowRunId,
				status: "skipped",
				reason: decisionResult.reason,
			});

			return {
				status: "skipped",
				reason: decisionResult.reason,
				metrics: finalizeMetrics(metrics, startTime),
			};
		}

		// Decision says we should act - prepare typing heartbeat
		// DON'T start typing immediately - only when AI actually sends a message
		// This prevents showing typing indicator during tool calls like searchKnowledgeBase
		typingHeartbeat = new TypingHeartbeat({
			conversation: intakeResult.conversation,
			aiAgentId: intakeResult.aiAgent.id,
		});

		// Callback to start typing - passed to tools, called on first sendMessage
		const onTypingStart = async () => {
			if (typingHeartbeat && !typingHeartbeat.running) {
				console.log(
					`[ai-agent] conv=${convId} | Starting typing (triggered by first sendMessage)`
				);
				await typingHeartbeat.start();
			}
		};

		// Callback to check if workflow is still active - passed to tools
		// This prevents duplicate messages when a newer message supersedes this workflow
		const checkWorkflowActive = async (): Promise<boolean> =>
			isWorkflowRunActive(
				ctx.redis,
				convId,
				"ai-agent-response",
				ctx.input.workflowRunId
			);

		// CHECK: Has this job been superseded by a newer message?
		const isActiveBeforeGeneration = await isWorkflowRunActive(
			ctx.redis,
			convId,
			"ai-agent-response",
			ctx.input.workflowRunId
		);
		if (!isActiveBeforeGeneration) {
			console.log(
				`[ai-agent] conv=${convId} | Superseded before generation, aborting`
			);
			// Stop typing heartbeat if it was running (it may not have started yet)
			if (typingHeartbeat.running) {
				await typingHeartbeat.stop();
			}
			typingHeartbeat = null;

			// Emit cancelled event (dashboard only)
			await emitWorkflowCancelled({
				conversation: intakeResult.conversation,
				aiAgentId: intakeResult.aiAgent.id,
				workflowRunId: ctx.input.workflowRunId,
				reason: "Superseded by newer message",
			});

			return {
				status: "skipped",
				reason: "Superseded by newer message",
				metrics: finalizeMetrics(metrics, startTime),
			};
		}

		// Step 3: Generation - Call LLM with tools
		// Set up AbortController for interruption handling during long LLM calls
		const abortController = new AbortController();
		let pollInterval: ReturnType<typeof setInterval> | null = null;

		// Poll workflow state every 2 seconds during generation
		// If a new message arrives, the workflow state will change and we abort
		const POLL_INTERVAL_MS = 2000;
		pollInterval = setInterval(async () => {
			try {
				const isStillActive = await isWorkflowRunActive(
					ctx.redis,
					convId,
					"ai-agent-response",
					ctx.input.workflowRunId
				);
				if (!isStillActive) {
					console.log(
						`[ai-agent] conv=${convId} | Workflow superseded during generation, aborting`
					);
					abortController.abort();
				}
			} catch (error) {
				// Log but don't abort on polling errors
				console.warn(
					`[ai-agent] conv=${convId} | Error polling workflow state:`,
					error
				);
			}
		}, POLL_INTERVAL_MS);

		const generationStart = Date.now();
		try {
			generationResult = await generate({
				db: ctx.db,
				aiAgent: intakeResult.aiAgent,
				conversation: intakeResult.conversation,
				conversationHistory: intakeResult.conversationHistory,
				visitorContext: intakeResult.visitorContext,
				mode: decisionResult.mode,
				humanCommand: decisionResult.humanCommand,
				organizationId: ctx.input.organizationId,
				websiteId: ctx.input.websiteId,
				visitorId: ctx.input.visitorId,
				triggerMessageId: ctx.input.messageId,
				abortSignal: abortController.signal,
				onTypingStart, // Start typing only when sendMessage is called
				checkWorkflowActive, // Prevent duplicate messages when superseded
			});
		} finally {
			// Always clean up the polling interval
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
		}
		metrics.generationMs = Date.now() - generationStart;

		// Handle aborted generation - new message arrived during LLM call
		if (generationResult.aborted) {
			console.log(
				`[ai-agent] conv=${convId} | Generation was aborted, stopping pipeline`
			);
			// Stop typing if it was started
			if (typingHeartbeat.running) {
				await typingHeartbeat.stop();
			}
			typingHeartbeat = null;

			await emitWorkflowCancelled({
				conversation: intakeResult.conversation,
				aiAgentId: intakeResult.aiAgent.id,
				workflowRunId: ctx.input.workflowRunId,
				reason: "Interrupted by new message",
			});

			return {
				status: "skipped",
				reason: "Interrupted by new message",
				metrics: finalizeMetrics(metrics, startTime),
			};
		}

		// FALLBACK: If AI returned respond/escalate/resolve but didn't call sendMessage,
		// send a fallback message so the visitor isn't left without a response
		const requiresMessage = ["respond", "escalate", "resolve"].includes(
			generationResult.decision.action
		);
		const sentMessages = generationResult.toolCalls?.sendMessage ?? 0;

		if (requiresMessage && sentMessages === 0) {
			// CHECK: Only send fallback if workflow is still active
			const isActiveForFallback = await checkWorkflowActive();
			if (isActiveForFallback) {
				console.warn(
					`[ai-agent] conv=${convId} | AI forgot to call sendMessage! Sending fallback...`
				);

				// Construct a fallback message based on the action
				let fallbackMessage: string;
				switch (generationResult.decision.action) {
					case "escalate":
						fallbackMessage =
							"Let me connect you with a team member who can help.";
						break;
					case "resolve":
						fallbackMessage =
							"I hope that helped! Let me know if you need anything else.";
						break;
					default:
						// For respond, use the reasoning if available, otherwise generic
						fallbackMessage =
							generationResult.decision.reasoning?.slice(0, 200) ||
							"I'm here to help! How can I assist you?";
				}

				try {
					await sendMessage({
						db: ctx.db,
						conversationId: convId,
						organizationId: ctx.input.organizationId,
						websiteId: ctx.input.websiteId,
						visitorId: ctx.input.visitorId,
						aiAgentId: intakeResult.aiAgent.id,
						text: fallbackMessage,
						idempotencyKey: `${ctx.input.messageId}-fallback`,
					});
					console.log(
						`[ai-agent] conv=${convId} | Fallback message sent successfully`
					);
				} catch (fallbackError) {
					console.error(
						`[ai-agent] conv=${convId} | Failed to send fallback:`,
						fallbackError
					);
				}
			} else {
				console.log(
					`[ai-agent] conv=${convId} | Workflow superseded, skipping fallback message`
				);
			}
		}

		// CHECK: Has this job been superseded after LLM call but before execution?
		const isActiveBeforeExecution = await isWorkflowRunActive(
			ctx.redis,
			convId,
			"ai-agent-response",
			ctx.input.workflowRunId
		);
		if (!isActiveBeforeExecution) {
			console.log(
				`[ai-agent] conv=${convId} | Superseded before execution, aborting`
			);
			// Stop typing heartbeat if it was started
			if (typingHeartbeat.running) {
				await typingHeartbeat.stop();
			}
			typingHeartbeat = null;

			// Emit cancelled event (dashboard only)
			await emitWorkflowCancelled({
				conversation: intakeResult.conversation,
				aiAgentId: intakeResult.aiAgent.id,
				workflowRunId: ctx.input.workflowRunId,
				reason: "Superseded by newer message",
			});

			return {
				status: "skipped",
				reason: "Superseded by newer message",
				metrics: finalizeMetrics(metrics, startTime),
			};
		}

		// Step 4: Execution - Execute actions
		const executionStart = Date.now();

		// Get visitor display name (from contact or generate a friendly name)
		const visitorName =
			intakeResult.visitorContext?.name ??
			generateVisitorName(ctx.input.visitorId);

		executionResult = await execute({
			db: ctx.db,
			aiAgent: intakeResult.aiAgent,
			conversation: intakeResult.conversation,
			decision: generationResult.decision,
			jobId: ctx.input.jobId,
			messageId: ctx.input.messageId,
			organizationId: ctx.input.organizationId,
			websiteId: ctx.input.websiteId,
			visitorId: ctx.input.visitorId,
			visitorName,
		});
		metrics.executionMs = Date.now() - executionStart;

		// Stop typing heartbeat after execution completes (if it was started)
		if (typingHeartbeat.running) {
			await typingHeartbeat.stop();
		}
		typingHeartbeat = null;

		// Step 5: Followup - Cleanup and emit events
		const followupStart = Date.now();
		await followup({
			db: ctx.db,
			redis: ctx.redis,
			aiAgent: intakeResult.aiAgent,
			conversation: intakeResult.conversation,
			decision: generationResult.decision,
			executionResult,
			organizationId: ctx.input.organizationId,
			websiteId: ctx.input.websiteId,
		});
		metrics.followupMs = Date.now() - followupStart;

		// Emit completion event (success - notify widget)
		await emitWorkflowCompleted({
			conversation: intakeResult.conversation,
			aiAgentId: intakeResult.aiAgent.id,
			workflowRunId: ctx.input.workflowRunId,
			status: "success",
			action: generationResult.decision.action,
		});

		const finalMetrics = finalizeMetrics(metrics, startTime);
		console.log(
			`[ai-agent] conv=${convId} | Completed | action=${generationResult.decision.action} | total=${finalMetrics.totalMs}ms`
		);

		return {
			status: "completed",
			action: generationResult.decision.action,
			metrics: finalMetrics,
		};
	} catch (error) {
		// Stop typing heartbeat if it was running
		if (typingHeartbeat?.running) {
			try {
				await typingHeartbeat.stop();
			} catch {
				// Ignore typing cleanup errors
			}
		}

		// Run followup for cleanup (workflow state, etc.)
		if (intakeResult?.status === "ready") {
			try {
				await followup({
					db: ctx.db,
					redis: ctx.redis,
					aiAgent: intakeResult.aiAgent,
					conversation: intakeResult.conversation,
					decision: null,
					executionResult: null,
					organizationId: ctx.input.organizationId,
					websiteId: ctx.input.websiteId,
				});
			} catch {
				// Ignore cleanup errors
			}
		}

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error(`[ai-agent] conv=${convId} | Error | ${errorMessage}`);

		// Emit error completion event (dashboard only)
		if (intakeResult?.status === "ready") {
			try {
				await emitWorkflowCompleted({
					conversation: intakeResult.conversation,
					aiAgentId: intakeResult.aiAgent.id,
					workflowRunId: ctx.input.workflowRunId,
					status: "error",
					reason: errorMessage,
				});
			} catch {
				// Ignore event emission errors during error handling
			}
		}

		return {
			status: "error",
			error: errorMessage,
			metrics: finalizeMetrics(metrics, startTime),
		};
	}
}

function finalizeMetrics(
	metrics: AiAgentPipelineResult["metrics"],
	startTime: number
): AiAgentPipelineResult["metrics"] {
	return {
		...metrics,
		totalMs: Date.now() - startTime,
	};
}
