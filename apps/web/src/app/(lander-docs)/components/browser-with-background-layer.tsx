"use client";

import { Background } from "@/components/ui/background";

export function BrowserWithBackgroundLayer() {
	return (
		<Background asciiOpacity={0.5} fieldOpacity={0.14} resolution={0.05} />
	);
}
