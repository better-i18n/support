/**
 * Analysis Module
 *
 * Background analysis tasks that run silently.
 * These create private events (not visible to visitors).
 *
 * Note: Sentiment and title are now handled via SDK tools during generation,
 * not as separate analysis tasks.
 */

export { autoCategorize } from "./categorization";
export {
	type EscalationSummary,
	generateEscalationSummary,
} from "./escalation-summary";
export {
	detectPromptInjection,
	type InjectionDetectionResult,
	logInjectionAttempt,
} from "./injection";
