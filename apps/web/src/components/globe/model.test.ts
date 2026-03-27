import { describe, expect, it } from "bun:test";
import {
	getCobeMarkers,
	getFocusView,
	getPhiFromLongitudeDegrees,
	getShortestAngleDeltaDegrees,
	getThetaFromTiltDegrees,
	normalizeGlobeVisitors,
	resolveGlobeThemeConfig,
} from "./model";

describe("globe model helpers", () => {
	it("normalizes visitors into stable marker ids and filters invalid coordinates", () => {
		const visitors = normalizeGlobeVisitors({
			idPrefix: "demo",
			visitors: [
				{
					id: "alpha user",
					latitude: 48.8566,
					locationLabel: "Paris, France",
					longitude: 2.3522,
					name: "Alice",
					pageLabel: "/pricing",
				},
				{
					id: "alpha user",
					latitude: 40.7128,
					longitude: -74.006,
					name: "Alice Again",
				},
				{
					id: "broken",
					latitude: Number.NaN,
					longitude: 0,
					name: "Broken",
				},
			],
		});

		expect(visitors).toHaveLength(2);
		expect(visitors[0]?.markerId).toBe("demo-alpha-user");
		expect(visitors[1]?.markerId).toBe("demo-alpha-user-2");
		expect(visitors[0]?.facehashSeed).toBe("Alice");
		expect(visitors[0]?.locationLabel).toBe("Paris, France");
		expect(visitors[0]?.pageLabel).toBe("/pricing");
	});

	it("converts focus coordinates into the expected view angles", () => {
		expect(getFocusView({ latitude: 37.7749, longitude: -122.4194 })).toEqual({
			longitude: -122.4194,
			tilt: -37.7749,
		});
	});

	it("computes shortest rotation deltas across the dateline", () => {
		expect(getShortestAngleDeltaDegrees(170, -170)).toBe(20);
		expect(getShortestAngleDeltaDegrees(-170, 170)).toBe(-20);
	});

	it("maps semantic view props into Cobe phi/theta radians", () => {
		expect(getPhiFromLongitudeDegrees(0)).toBeCloseTo(Math.PI / 2, 6);
		expect(getThetaFromTiltDegrees(12)).toBeCloseTo(0.209_439_51, 6);
	});

	it("resolves theme presets and preserves explicit overrides", () => {
		const config = resolveGlobeThemeConfig("dark", {
			mapSamples: 20_000,
			opacity: 0.9,
		});
		const markers = getCobeMarkers(
			normalizeGlobeVisitors({
				idPrefix: "dark-demo",
				visitors: [
					{
						id: "visitor-1",
						latitude: 1,
						longitude: 2,
						name: "Visitor 1",
					},
				],
			}),
			config.baseColor
		);

		expect(config.dark).toBe(1);
		expect(config.mapSamples).toBe(20_000);
		expect(config.opacity).toBe(0.9);
		expect(markers[0]?.color).toEqual(config.baseColor);
		expect(markers[0]?.size).toBeGreaterThan(0);
	});
});
