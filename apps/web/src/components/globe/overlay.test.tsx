import { describe, expect, it, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("@/components/ui/avatar", () => ({
	Avatar: ({
		facehashSeed,
		fallbackName,
		status,
		url,
	}: {
		facehashSeed?: string;
		fallbackName: string;
		status?: string;
		url?: string | null;
	}) => (
		<div
			data-facehash-seed={facehashSeed}
			data-name={fallbackName}
			data-slot="mock-avatar"
			data-status={status}
			data-url={String(url ?? "")}
		/>
	),
}));

const modulePromise = import("./overlay");

describe("GlobeVisitorOverlay", () => {
	it("renders anchor-positioned visitor pins and cards", async () => {
		const { GlobeVisitorOverlay } = await modulePromise;
		const html = renderToStaticMarkup(
			<GlobeVisitorOverlay
				visitors={[
					{
						avatarUrl: null,
						facehashSeed: "visitor-facehash",
						id: "visitor-1",
						latitude: 48.8566,
						locationLabel: "Paris, France",
						longitude: 2.3522,
						markerId: "demo-visitor-1",
						name: "Alice",
						pageLabel: "/pricing",
						status: "online",
					},
				]}
			/>
		);

		expect(html).toContain('data-slot="globe-visitor-overlay"');
		expect(html).toContain('data-slot="globe-visitor-pin"');
		expect(html).toContain("position-anchor:--cobe-demo-visitor-1");
		expect(html).toContain("Alice");
		expect(html).toContain("Paris, France");
		expect(html).toContain("/pricing");
		expect(html).toContain('data-facehash-seed="visitor-facehash"');
		expect(html).toContain('data-status="online"');
	});
});
