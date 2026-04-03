import { describe, expect, it } from "bun:test";
import {
	CLARIFICATION_PROGRESS_FALLBACK_DELAY_MS,
	resolveClarificationProgressView,
} from "./clarification-progress";

describe("resolveClarificationProgressView", () => {
	it("shows an optimistic local state before the server progress arrives", () => {
		const startedAt = "2026-03-14T10:00:00.000Z";
		const nowMs = Date.parse(startedAt) + 500;

		expect(
			resolveClarificationProgressView({
				nowMs,
				serverProgress: null,
				localStartedAt: startedAt,
			})
		).toMatchObject({
			phase: "saving_answer",
			label: "Saving your answer...",
		});
	});

	it("falls back to a generic waiting state when the server stays silent", () => {
		const startedAt = "2026-03-14T10:00:00.000Z";
		const nowMs =
			Date.parse(startedAt) + CLARIFICATION_PROGRESS_FALLBACK_DELAY_MS;

		expect(
			resolveClarificationProgressView({
				nowMs,
				serverProgress: null,
				localStartedAt: startedAt,
			})
		).toMatchObject({
			phase: "waiting_for_server",
			label: "Reviewing your answer...",
		});
	});
});
