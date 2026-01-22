/**
 * AI Agent Worker
 *
 * BullMQ worker that processes AI agent jobs through the 5-step pipeline.
 * Built for reliability and scale with proper retry handling.
 *
 * The pipeline:
 * 1. Intake - Gather context, validate
 * 2. Decision - Should AI act?
 * 3. Generation - Generate response
 * 4. Execution - Execute actions
 * 5. Followup - Cleanup, analysis
 */

import { runAiAgentPipeline } from "@api/ai-agent";
import { emitWorkflowStarted } from "@api/ai-agent/events";
import { getBehaviorSettings } from "@api/ai-agent/settings";
import { markConversationAsSeen } from "@api/db/mutations/conversation";
import { getAiAgentById } from "@api/db/queries/ai-agent";
import { getConversationById } from "@api/db/queries/conversation";
import { emitConversationSeenEvent } from "@api/utils/conversation-realtime";
import { type AiAgentJobData, QUEUE_NAMES } from "@cossistant/jobs";
import {
	clearWorkflowState,
	isWorkflowRunActive,
	type WorkflowDirection,
} from "@cossistant/jobs/workflow-state";
import {
	getSafeRedisUrl,
	type Redis,
	type RedisOptions,
} from "@cossistant/redis";
import { db } from "@workers/db";
import { type Job, Queue, QueueEvents, Worker } from "bullmq";

const AI_AGENT_DIRECTION: WorkflowDirection = "ai-agent-response";

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Worker configuration for reliability
 */
const WORKER_CONFIG = {
	concurrency: 10, // Process 10 jobs in parallel per worker
	lockDuration: 60_000, // 60s lock to prevent duplicate processing
	stalledInterval: 30_000, // Check for stalled jobs every 30s
	maxStalledCount: 2, // Retry stalled jobs up to 2 times
};

type WorkerConfig = {
	connectionOptions: RedisOptions;
	redisUrl: string;
	stateRedis: Redis;
};

export function createAiAgentWorker({
	connectionOptions,
	redisUrl,
	stateRedis,
}: WorkerConfig) {
	const queueName = QUEUE_NAMES.AI_AGENT;
	const safeRedisUrl = getSafeRedisUrl(redisUrl);
	let worker: Worker<AiAgentJobData> | null = null;
	let events: QueueEvents | null = null;
	let maintenanceQueue: Queue<AiAgentJobData> | null = null;

	const buildConnectionOptions = (): RedisOptions => ({
		...connectionOptions,
		tls: connectionOptions.tls ? { ...connectionOptions.tls } : undefined,
	});

	return {
		start: async () => {
			if (worker) {
				return;
			}

			console.log(
				`[worker:ai-agent] Using queue=${queueName} redis=${safeRedisUrl}`
			);

			// Maintenance queue for admin operations
			maintenanceQueue = new Queue<AiAgentJobData>(queueName, {
				connection: buildConnectionOptions(),
			});
			await maintenanceQueue.waitUntilReady();

			// Queue events for monitoring (only errors and stalled jobs)
			events = new QueueEvents(queueName, {
				connection: buildConnectionOptions(),
			});
			events.on("failed", ({ jobId, failedReason }) => {
				console.error(`[worker:ai-agent] Job ${jobId} failed: ${failedReason}`);
			});
			events.on("stalled", ({ jobId }) => {
				console.warn(`[worker:ai-agent] Job ${jobId} stalled`);
			});

			await events.waitUntilReady();

			// Main worker
			worker = new Worker<AiAgentJobData>(
				queueName,
				async (job: Job<AiAgentJobData>) => {
					const start = Date.now();

					try {
						await processAiAgentJob(stateRedis, job);
					} catch (error) {
						const duration = Date.now() - start;
						console.error(
							`[worker:ai-agent] Job ${job.id} failed after ${duration}ms`,
							error
						);
						throw error;
					}
				},
				{
					connection: buildConnectionOptions(),
					concurrency: WORKER_CONFIG.concurrency,
					lockDuration: WORKER_CONFIG.lockDuration,
					stalledInterval: WORKER_CONFIG.stalledInterval,
					maxStalledCount: WORKER_CONFIG.maxStalledCount,
				}
			);

			worker.on("error", (error) => {
				console.error("[worker:ai-agent] Worker error", error);
			});

			await worker.waitUntilReady();
			console.log(
				`[worker:ai-agent] Worker started with concurrency=${WORKER_CONFIG.concurrency}`
			);
		},
		stop: async () => {
			await Promise.all([
				(async () => {
					if (worker) {
						await worker.close();
						worker = null;
						console.log("[worker:ai-agent] Worker stopped");
					}
				})(),
				(async () => {
					if (events) {
						await events.close();
						events = null;
						console.log("[worker:ai-agent] Queue events stopped");
					}
				})(),
				(async () => {
					if (maintenanceQueue) {
						await maintenanceQueue.close();
						maintenanceQueue = null;
						console.log("[worker:ai-agent] Maintenance queue closed");
					}
				})(),
			]);
		},
	};

	/**
	 * Process an AI agent job through the pipeline
	 */
	async function processAiAgentJob(
		redis: Redis,
		job: Job<AiAgentJobData>
	): Promise<void> {
		const {
			conversationId,
			messageId,
			messageCreatedAt,
			organizationId,
			websiteId,
			visitorId,
			aiAgentId,
			workflowRunId,
		} = job.data;

		// Check if this workflow run is still active
		const active = await isWorkflowRunActive(
			redis,
			conversationId,
			AI_AGENT_DIRECTION,
			workflowRunId
		);

		if (!active) {
			console.log(
				`[worker:ai-agent] conv=${conversationId} | Superseded by newer job, skipping`
			);
			return;
		}

		// Get conversation for emitting events
		const conversation = await getConversationById(db, { conversationId });

		if (!conversation) {
			console.error(`[worker:ai-agent] conv=${conversationId} | Not found`);
			await clearWorkflowState(redis, conversationId, AI_AGENT_DIRECTION);
			return;
		}

		// Emit seen event
		const actor = { type: "ai_agent" as const, aiAgentId };
		const lastSeenAt = await markConversationAsSeen(db, {
			conversation,
			actor,
		});

		await emitConversationSeenEvent({
			conversation,
			actor,
			lastSeenAt,
		});

		// Emit workflow started event (dashboard only)
		await emitWorkflowStarted({
			conversation,
			aiAgentId,
			workflowRunId,
			triggerMessageId: messageId,
		});

		// Apply response delay from behavior settings (before pipeline starts)
		const aiAgentRecord = await getAiAgentById(db, { aiAgentId });
		if (aiAgentRecord) {
			const settings = getBehaviorSettings(aiAgentRecord);
			if (settings.responseDelayMs > 0) {
				console.log(
					`[worker:ai-agent] conv=${conversationId} | Applying response delay: ${settings.responseDelayMs}ms`
				);
				await sleep(settings.responseDelayMs);

				// Re-check if still active after delay (a newer message might have superseded us)
				const stillActive = await isWorkflowRunActive(
					redis,
					conversationId,
					AI_AGENT_DIRECTION,
					workflowRunId
				);
				if (!stillActive) {
					console.log(
						`[worker:ai-agent] conv=${conversationId} | Superseded during delay, aborting`
					);
					return;
				}
			}
		}

		// Run the AI agent pipeline
		// Note: Typing events are handled inside the pipeline after decision is made
		const result = await runAiAgentPipeline({
			db,
			redis,
			input: {
				conversationId,
				messageId,
				messageCreatedAt,
				websiteId,
				organizationId,
				visitorId,
				aiAgentId,
				workflowRunId,
				jobId: job.id ?? `job-${Date.now()}`,
			},
		});

		if (result.status === "error") {
			throw new Error(result.error ?? "Pipeline failed");
		}
	}
}
