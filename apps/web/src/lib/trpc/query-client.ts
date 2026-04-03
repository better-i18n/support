import {
	defaultShouldDehydrateQuery,
	QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Check if an error is a rate limit error (HTTP 429 / TOO_MANY_REQUESTS)
 */
function isRateLimitError(error: unknown): boolean {
	if (!error) {
		return false;
	}

	// Check for TRPCClientError or similar error objects
	if (typeof error === "object" && error !== null) {
		const errorObj = error as Record<string, unknown>;

		// Check message
		if (
			typeof errorObj.message === "string" &&
			errorObj.message.includes("TOO_MANY_REQUESTS")
		) {
			return true;
		}

		// Check data.code for TRPC errors
		if (
			typeof errorObj.data === "object" &&
			errorObj.data !== null &&
			(errorObj.data as Record<string, unknown>).code === "TOO_MANY_REQUESTS"
		) {
			return true;
		}

		// Check code directly
		if (errorObj.code === "TOO_MANY_REQUESTS") {
			return true;
		}
	}

	return false;
}

export function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000,
				// Don't retry on rate limit errors to avoid cascade
				retry: (failureCount, error) => {
					if (isRateLimitError(error)) {
						return false;
					}
					// Default retry behavior: 3 retries
					return failureCount < 3;
				},
				// Use exponential backoff with longer delays for rate limit errors
				retryDelay: (attemptIndex, error) => {
					if (isRateLimitError(error)) {
						// Much longer delay for rate limit errors: 5s, 10s, 20s...
						return Math.min(5000 * 2 ** attemptIndex, 60_000);
					}
					// Standard exponential backoff: 1s, 2s, 4s... (max 30s)
					return Math.min(1000 * 2 ** attemptIndex, 30_000);
				},
			},
			mutations: {
				// Also prevent mutation retries on rate limit errors
				retry: (failureCount, error) => {
					if (isRateLimitError(error)) {
						return false;
					}
					return failureCount < 3;
				},
			},
			dehydrate: {
				serializeData: superjson.serialize,
				shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query),
			},
			hydrate: {
				deserializeData: superjson.deserialize,
			},
		},
	});
}
