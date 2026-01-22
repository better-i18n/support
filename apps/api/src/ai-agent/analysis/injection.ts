/**
 * Prompt Injection Detection
 *
 * Detects potential prompt injection attempts in visitor messages.
 * This is a defense-in-depth measure - the AI is also instructed to
 * detect and escalate manipulation attempts via the security prompt.
 *
 * Detection is logged for monitoring but doesn't block messages.
 * The AI handles the actual response via its escalation instructions.
 */

/**
 * Patterns that indicate potential prompt injection attempts
 */
const INJECTION_PATTERNS: RegExp[] = [
	// Direct instruction override attempts
	/ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)/i,
	/disregard\s+(all\s+)?(previous|prior|above|earlier)/i,
	/forget\s+(everything|all|what\s+you|your)/i,
	/override\s+(your\s+)?(instructions?|rules?|programming)/i,
	/bypass\s+(your\s+)?(safety|restrictions?|rules?|filters?)/i,

	// Role switching attempts
	/you\s+are\s+(now|actually|really)\s+/i,
	/pretend\s+(to\s+be|you'?re?\s+)/i,
	/act\s+as\s+(if\s+you'?re?|a\s+different)/i,
	/switch\s+to\s+.{1,20}\s+mode/i,
	/from\s+now\s+on\s+you\s+are/i,
	/roleplay\s+as/i,

	// System prompt extraction
	/what\s+(is|are)\s+your\s+(instructions?|rules?|prompt|system\s+prompt)/i,
	/show\s+me\s+your\s+(system\s+)?prompt/i,
	/reveal\s+your\s+(programming|configuration|instructions?)/i,
	/print\s+your\s+(system\s+)?prompt/i,
	/display\s+your\s+(initial\s+)?instructions?/i,
	/tell\s+me\s+your\s+(system\s+)?prompt/i,

	// Private information extraction
	/tell\s+me\s+what\s+.{1,30}\s+said\s+privately/i,
	/share\s+the\s+(internal|private)\s+notes?/i,
	/what\s+did\s+(the\s+)?(team|support|agent)\s+say\s+about/i,
	/show\s+me\s+(the\s+)?private\s+messages?/i,
	/reveal\s+(the\s+)?internal\s+(notes?|discussions?)/i,

	// Known jailbreak attempts
	/\bDAN\b/i, // "Do Anything Now"
	/\bjailbreak\b/i,
	/\bdeveloper\s+mode\b/i,
	/\bdo\s+anything\s+now\b/i,
	/\bunlocked\s+mode\b/i,

	// Escape/encoding attempts
	/base64\s*:\s*[A-Za-z0-9+/=]{20,}/i,
	/\\x[0-9a-fA-F]{2}/,
	/&#x?[0-9a-fA-F]+;/,
];

/**
 * Result of injection detection
 */
export type InjectionDetectionResult = {
	/** Whether a potential injection was detected */
	detected: boolean;
	/** The pattern that matched, if any (for logging) */
	matchedPattern: string | null;
	/** Confidence level: low, medium, high */
	confidence: "low" | "medium" | "high";
};

/**
 * Detect potential prompt injection in a message
 *
 * This function checks for common prompt injection patterns.
 * It's meant for logging and monitoring, not blocking.
 *
 * @param message - The message to check
 * @returns Detection result with matched pattern info
 */
export function detectPromptInjection(
	message: string
): InjectionDetectionResult {
	// Normalize message for detection
	const normalizedMessage = message.toLowerCase().replace(/\s+/g, " ").trim();

	for (const pattern of INJECTION_PATTERNS) {
		if (pattern.test(normalizedMessage)) {
			// Determine confidence based on pattern type
			const patternStr = pattern.source.toLowerCase();
			let confidence: "low" | "medium" | "high" = "medium";

			// High confidence for explicit jailbreak attempts
			if (
				patternStr.includes("jailbreak") ||
				patternStr.includes("dan") ||
				patternStr.includes("ignore") ||
				patternStr.includes("bypass")
			) {
				confidence = "high";
			}

			// Low confidence for patterns that might have legitimate uses
			if (patternStr.includes("what") || patternStr.includes("tell me")) {
				confidence = "low";
			}

			return {
				detected: true,
				matchedPattern: pattern.source,
				confidence,
			};
		}
	}

	return {
		detected: false,
		matchedPattern: null,
		confidence: "low",
	};
}

/**
 * Log injection detection for monitoring
 *
 * This should be called when processing visitor messages
 * to track potential attack patterns.
 */
export function logInjectionAttempt(
	conversationId: string,
	result: InjectionDetectionResult,
	messagePreview: string
): void {
	if (!result.detected) {
		return;
	}

	const preview =
		messagePreview.length > 100
			? `${messagePreview.slice(0, 100)}...`
			: messagePreview;

	console.warn(
		`[ai-agent:security] conv=${conversationId} | Potential injection detected | confidence=${result.confidence} | pattern="${result.matchedPattern}" | preview="${preview}"`
	);
}
