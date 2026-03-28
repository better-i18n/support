import { describe, expect, it } from "bun:test";
import {
	extractClientIp,
	normalizeIpCandidate,
	parseForwardedHeader,
} from "./client-ip";

describe("client IP helpers", () => {
	it("normalizes IPv4 values with ports", () => {
		expect(normalizeIpCandidate("203.0.113.9:443")).toBe("203.0.113.9");
	});

	it("parses RFC 7239 Forwarded headers", () => {
		expect(
			parseForwardedHeader('for="[2001:db8:cafe::17]:4711";proto=https')
		).toBe("2001:db8:cafe::17");
	});

	it("prefers x-forwarded-for over x-real-ip for the canonical Railway client IP", () => {
		const result = extractClientIp((name) => {
			switch (name) {
				case "x-forwarded-for":
					return "8.8.8.8, 44.44.44.44";
				case "x-real-ip":
					return "44.44.44.44";
				default:
					return null;
			}
		});

		expect(result.canonicalIp).toBe("8.8.8.8");
		expect(result.publicIp).toBe("8.8.8.8");
	});

	it("uses x-real-ip as a fallback when x-forwarded-for is missing", () => {
		const result = extractClientIp((name) =>
			name === "x-real-ip" ? "8.8.8.8" : null
		);

		expect(result.canonicalIp).toBe("8.8.8.8");
		expect(result.publicIp).toBe("8.8.8.8");
	});

	it("keeps the leftmost x-forwarded-for value as canonical and the first public one for lookups", () => {
		const result = extractClientIp((name) =>
			name === "x-forwarded-for" ? "10.0.0.3, 8.8.8.8, 1.1.1.1" : null
		);

		expect(result.canonicalIp).toBe("10.0.0.3");
		expect(result.publicIp).toBe("8.8.8.8");
	});
});
