import { describe, expect, it } from "bun:test";
import type { InboxAnalyticsResponse } from "@cossistant/types";
import { renderToStaticMarkup } from "react-dom/server";
import { InboxAnalyticsDisplay } from "./inbox-analytics-display";

const analyticsData = {
	current: {
		medianResponseTimeSeconds: 125,
		medianResolutionTimeSeconds: 3600,
		aiHandledRate: 80,
		satisfactionIndex: 73,
		uniqueVisitors: 42,
	},
	previous: {
		medianResponseTimeSeconds: 250,
		medianResolutionTimeSeconds: 5400,
		aiHandledRate: 60,
		satisfactionIndex: 68,
		uniqueVisitors: 21,
	},
} as InboxAnalyticsResponse;

describe("InboxAnalyticsDisplay", () => {
	it("renders the inline desktop layout with the segmented control", () => {
		const html = renderToStaticMarkup(
			<InboxAnalyticsDisplay
				controlSize="sm"
				data={analyticsData}
				onRangeChange={() => {}}
				rangeDays={14}
			/>
		);

		expect(html).toContain('data-layout="inline"');
		expect(html).toContain("Median response time");
		expect(html).toContain("2m 5s");
		expect(html).toContain("1h");
		expect(html).toContain("80%");
		expect(html).toContain('aria-label="Analytics date range"');
		expect(html).toContain("shrink-0");
	});

	it("can render the inline desktop layout without the control", () => {
		const html = renderToStaticMarkup(
			<InboxAnalyticsDisplay
				data={analyticsData}
				onRangeChange={() => {}}
				rangeDays={14}
				showControl={false}
			/>
		);

		expect(html).toContain('data-layout="inline"');
		expect(html).toContain("Median response time");
		expect(html).not.toContain('aria-label="Analytics date range"');
	});

	it("renders the sheet layout with stacked metrics", () => {
		const html = renderToStaticMarkup(
			<InboxAnalyticsDisplay
				controlSize="default"
				data={analyticsData}
				layout="sheet"
				onRangeChange={() => {}}
				rangeDays={30}
			/>
		);

		expect(html).toContain('data-layout="sheet"');
		expect(html).toContain("Unique visitors");
		expect(html).toContain("42");
		expect(html).toContain("rounded-[10px]");
		expect(html).not.toContain("w-[188px]");
	});

	it("keeps fallback values when analytics data is unavailable", () => {
		const html = renderToStaticMarkup(
			<InboxAnalyticsDisplay
				data={null}
				isError
				layout="sheet"
				onRangeChange={() => {}}
				rangeDays={7}
			/>
		);

		expect(html).toContain('data-error="true"');
		expect(html).toContain("Median response time");
		expect(html).toContain("—");
	});
});
