/**
 * Queue triggers for use by API and other services
 *
 * These are lightweight functions that add jobs to BullMQ queues.
 */

export { createAiAgentTriggers, type EnqueueAiAgentResult } from "./ai-agent";
export { createAiTrainingTriggers } from "./ai-training";
export { createMessageNotificationTriggers } from "./message-notification";
export { createWebCrawlTriggers } from "./web-crawl";
