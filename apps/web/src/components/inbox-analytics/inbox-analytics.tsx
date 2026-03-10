"use client";

import { useState } from "react";
import { useInboxAnalytics } from "@/data/use-inbox-analytics";
import {
	InboxAnalyticsDisplay,
	type InboxAnalyticsDisplayLayout,
} from "./inbox-analytics-display";
import type { InboxAnalyticsRangeDays } from "./types";

const DEFAULT_RANGE: InboxAnalyticsRangeDays = 7;

type UseInboxAnalyticsControllerOptions = {
	websiteSlug: string;
	enabled?: boolean;
};

type InboxAnalyticsProps = UseInboxAnalyticsControllerOptions & {
	className?: string;
	controlSize?: "default" | "sm";
	layout?: InboxAnalyticsDisplayLayout;
};

export function useInboxAnalyticsController({
	websiteSlug,
	enabled = true,
}: UseInboxAnalyticsControllerOptions) {
	const [rangeDays, setRangeDays] =
		useState<InboxAnalyticsRangeDays>(DEFAULT_RANGE);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const query = useInboxAnalytics({
		websiteSlug,
		rangeDays,
		enabled,
	});

	return {
		data: query.data ?? null,
		isError: query.isError,
		isLoading: query.isLoading || query.isFetching,
		isSheetOpen,
		rangeDays,
		setIsSheetOpen,
		setRangeDays,
	};
}

export function InboxAnalytics({
	websiteSlug,
	enabled = true,
	className,
	controlSize,
	layout = "inline",
}: InboxAnalyticsProps) {
	const analytics = useInboxAnalyticsController({ websiteSlug, enabled });

	return (
		<InboxAnalyticsDisplay
			className={className}
			controlSize={controlSize}
			data={analytics.data}
			isError={analytics.isError}
			isLoading={analytics.isLoading}
			layout={layout}
			onRangeChange={analytics.setRangeDays}
			rangeDays={analytics.rangeDays}
		/>
	);
}
