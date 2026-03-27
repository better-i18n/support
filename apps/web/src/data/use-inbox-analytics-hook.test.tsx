import { beforeEach, describe, expect, it, mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const useQueryMock = mock((options: unknown) => options);
const fetchQueryMock = mock(
	(async (_args: unknown) => null) as (args: unknown) => Promise<unknown>
);
const useTinybirdTokenMock = mock(
	(_websiteSlug: string, _options?: unknown) => ({
		data: null,
	})
);

mock.module("@tanstack/react-query", () => ({
	useQuery: useQueryMock,
	useQueryClient: () => ({
		fetchQuery: fetchQueryMock,
	}),
}));

mock.module("@/lib/tinybird", () => ({
	queryTinybirdPipe: async () => [],
	useTinybirdToken: useTinybirdTokenMock,
}));

mock.module("@/lib/trpc/client", () => ({
	useTRPC: () => ({
		website: {
			getSatisfactionSignals: {
				queryOptions: (input: unknown) => ({
					queryKey: ["website.getSatisfactionSignals", input],
				}),
			},
		},
	}),
}));

const modulePromise = import("./use-inbox-analytics");

async function renderHook<TValue>(renderValue: () => TValue): Promise<TValue> {
	let hookValue: TValue | null = null;

	function Harness() {
		hookValue = renderValue();
		return null;
	}

	renderToStaticMarkup(<Harness />);

	if (hookValue === null) {
		throw new Error("Hook did not render");
	}

	return hookValue;
}

describe("useInboxAnalytics", () => {
	beforeEach(() => {
		useQueryMock.mockClear();
		fetchQueryMock.mockClear();
		useTinybirdTokenMock.mockClear();
	});

	it("aligns Tinybird token caching with the analytics stale time", async () => {
		const { useInboxAnalytics } = await modulePromise;

		await renderHook(() =>
			useInboxAnalytics({
				websiteSlug: "acme",
				rangeDays: 7,
			})
		);

		expect(useTinybirdTokenMock).toHaveBeenCalledTimes(1);
		expect(useTinybirdTokenMock.mock.calls[0]).toEqual([
			"acme",
			{ staleTimeMs: 300_000 },
		]);

		const options = useQueryMock.mock.calls[0]?.[0] as {
			enabled: boolean;
			staleTime: number;
			refetchInterval: number;
		};

		expect(options).toMatchObject({
			enabled: false,
			staleTime: 300_000,
			refetchInterval: 300_000,
		});
	});
});
