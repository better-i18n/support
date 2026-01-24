import {
	getAiAgentById,
	updateAiAgentTrainingStatus,
} from "@api/db/queries/ai-agent";
import { listKnowledgeForTraining } from "@api/db/queries/knowledge";
import { chunk as chunkTable } from "@api/db/schema/chunk";
import { generateEmbeddings } from "@api/lib/embedding-client";
import { generateULID } from "@api/utils/db/ids";
import {
	chunkText,
	extractTextFromKnowledgePayload,
	generateChunkMetadata,
} from "@api/utils/text-chunker";
import { type AiTrainingJobData, QUEUE_NAMES } from "@cossistant/jobs";
import type { RedisOptions } from "@cossistant/redis";
import { db } from "@workers/db";
import { emitToWebsite } from "@workers/realtime";
import { type Job, Worker } from "bullmq";
import { eq } from "drizzle-orm";

// Batch size for embedding generation (to avoid hitting API limits)
const EMBEDDING_BATCH_SIZE = 20;

type WorkerConfig = {
	connectionOptions: RedisOptions;
	redisUrl: string;
};

export function createAiTrainingWorker({
	connectionOptions,
	redisUrl,
}: WorkerConfig) {
	const queueName = QUEUE_NAMES.AI_TRAINING;
	let worker: Worker<AiTrainingJobData> | null = null;

	return {
		start: async () => {
			console.log(`[ai-training] Starting worker for queue: ${queueName}`);

			worker = new Worker<AiTrainingJobData>(
				queueName,
				async (job: Job<AiTrainingJobData>) => {
					await processTrainingJob(job);
				},
				{
					connection: connectionOptions,
					concurrency: 1, // Only one training job at a time
					lockDuration: 300_000, // 5 minutes lock
				}
			);

			worker.on("completed", (job) => {
				console.log(`[ai-training] Job ${job.id} completed`);
			});

			worker.on("failed", (job, error) => {
				console.error(`[ai-training] Job ${job?.id} failed:`, error);
			});

			await worker.waitUntilReady();
			console.log("[ai-training] Worker ready");
		},
		stop: async () => {
			if (worker) {
				await worker.close();
				worker = null;
			}
			console.log("[ai-training] Worker stopped");
		},
	};
}

async function processTrainingJob(job: Job<AiTrainingJobData>): Promise<void> {
	const { websiteId, organizationId, aiAgentId } = job.data;
	const startTime = Date.now();

	console.log(
		`[ai-training] Processing training job for AI agent ${aiAgentId}`
	);

	try {
		// Verify AI agent exists
		const agent = await getAiAgentById(db, { aiAgentId });
		if (!agent) {
			throw new Error(`AI agent ${aiAgentId} not found`);
		}

		// Update status to training
		await updateAiAgentTrainingStatus(db, {
			aiAgentId,
			trainingStatus: "training",
			trainingProgress: 0,
			trainingStartedAt: new Date().toISOString(),
			trainingError: null,
		});

		// Emit training started event
		await emitToWebsite(websiteId, "trainingStarted", {
			websiteId,
			organizationId,
			visitorId: null,
			userId: job.data.triggeredBy,
			aiAgentId,
			totalItems: 0, // Will update after fetching
		});

		// Fetch all knowledge items for training
		const knowledgeItems = await listKnowledgeForTraining(db, { websiteId });
		const totalItems = knowledgeItems.length;

		console.log(`[ai-training] Found ${totalItems} knowledge items to process`);

		if (totalItems === 0) {
			// No items to train, complete immediately
			await updateAiAgentTrainingStatus(db, {
				aiAgentId,
				trainingStatus: "completed",
				trainingProgress: 100,
				trainedItemsCount: 0,
				lastTrainedAt: new Date().toISOString(),
			});

			await emitToWebsite(websiteId, "trainingCompleted", {
				websiteId,
				organizationId,
				visitorId: null,
				userId: job.data.triggeredBy,
				aiAgentId,
				totalItems: 0,
				totalChunks: 0,
				duration: Date.now() - startTime,
			});

			return;
		}

		// Delete existing chunks for this website (clean slate training)
		await db.delete(chunkTable).where(eq(chunkTable.websiteId, websiteId));

		console.log(
			`[ai-training] Deleted existing chunks for website ${websiteId}`
		);

		let processedItems = 0;
		let totalChunks = 0;

		// Process each knowledge item
		for (const knowledgeItem of knowledgeItems) {
			// Extract text content from the knowledge item
			const text = extractTextFromKnowledgePayload(
				knowledgeItem.type as "url" | "faq" | "article",
				knowledgeItem.payload
			);

			if (!text || text.trim().length === 0) {
				console.log(
					`[ai-training] Skipping knowledge item ${knowledgeItem.id} - no text content`
				);
				processedItems++;
				continue;
			}

			// Chunk the text
			const chunks = chunkText(text);

			if (chunks.length === 0) {
				processedItems++;
				continue;
			}

			// Generate metadata for chunks
			const metadata = generateChunkMetadata(
				knowledgeItem.type as "url" | "faq" | "article",
				knowledgeItem.payload,
				knowledgeItem.sourceUrl,
				knowledgeItem.sourceTitle
			);

			// Process chunks in batches for embedding generation
			for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
				const chunkBatch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
				const chunkTexts = chunkBatch.map((c) => c.content);

				// Generate embeddings for this batch
				const embeddings = await generateEmbeddings(chunkTexts);

				// Insert chunks into database
				const chunkInserts = chunkBatch.map((chunk, batchIndex) => ({
					id: generateULID(),
					websiteId,
					knowledgeId: knowledgeItem.id,
					visitorId: null,
					contactId: null,
					sourceType: "knowledge",
					content: chunk.content,
					embedding: embeddings[batchIndex],
					chunkIndex: chunk.index,
					metadata: {
						...metadata,
						startOffset: chunk.startOffset,
						endOffset: chunk.endOffset,
					},
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				}));

				await db.insert(chunkTable).values(chunkInserts);
				totalChunks += chunkBatch.length;
			}

			processedItems++;

			// Calculate progress percentage
			const progress = Math.round((processedItems / totalItems) * 100);

			// Update progress
			await updateAiAgentTrainingStatus(db, {
				aiAgentId,
				trainingStatus: "training",
				trainingProgress: progress,
			});

			// Emit progress event
			await emitToWebsite(websiteId, "trainingProgress", {
				websiteId,
				organizationId,
				visitorId: null,
				userId: job.data.triggeredBy,
				aiAgentId,
				processedItems,
				totalItems,
				currentItem: {
					id: knowledgeItem.id,
					title: knowledgeItem.sourceTitle ?? null,
					type: knowledgeItem.type as "url" | "faq" | "article",
				},
				percentage: progress,
			});

			// Update job progress for BullMQ
			await job.updateProgress(progress);

			console.log(
				`[ai-training] Processed ${processedItems}/${totalItems} items (${chunks.length} chunks)`
			);
		}

		// Training completed
		const duration = Date.now() - startTime;

		await updateAiAgentTrainingStatus(db, {
			aiAgentId,
			trainingStatus: "completed",
			trainingProgress: 100,
			trainedItemsCount: totalItems,
			lastTrainedAt: new Date().toISOString(),
		});

		await emitToWebsite(websiteId, "trainingCompleted", {
			websiteId,
			organizationId,
			visitorId: null,
			userId: job.data.triggeredBy,
			aiAgentId,
			totalItems,
			totalChunks,
			duration,
		});

		console.log(
			`[ai-training] Training completed: ${totalItems} items, ${totalChunks} chunks in ${duration}ms`
		);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		console.error("[ai-training] Training failed:", error);

		// Update status to failed
		await updateAiAgentTrainingStatus(db, {
			aiAgentId,
			trainingStatus: "failed",
			trainingError: errorMessage,
		});

		// Emit failure event
		await emitToWebsite(websiteId, "trainingFailed", {
			websiteId,
			organizationId,
			visitorId: null,
			userId: job.data.triggeredBy,
			aiAgentId,
			error: errorMessage,
		});

		throw error;
	}
}
