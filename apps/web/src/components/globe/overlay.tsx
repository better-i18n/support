"use client";

import type * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ResolvedGlobeVisitor } from "./model";

type AnchorStyle = React.CSSProperties & {
	positionAnchor?: string;
};

function buildVisitorSummaryLabel(visitor: ResolvedGlobeVisitor): string {
	return [
		visitor.name,
		visitor.locationLabel ? `Location ${visitor.locationLabel}` : null,
		visitor.pageLabel ? `Page ${visitor.pageLabel}` : null,
	]
		.filter(Boolean)
		.join(". ");
}

function GlobeVisitorPin({ visitor }: { visitor: ResolvedGlobeVisitor }) {
	const visibilityVar = `var(--cobe-visible-${visitor.markerId}, 0)`;
	const style: AnchorStyle = {
		filter: `blur(calc((1 - ${visibilityVar}) * 10px))`,
		left: "anchor(center)",
		opacity: visibilityVar,
		position: "absolute",
		positionAnchor: `--cobe-${visitor.markerId}`,
		top: "anchor(center)",
		transform: "translate(-50%, -50%)",
		transition: "opacity 180ms ease, filter 180ms ease",
	};

	return (
		<div
			className="group pointer-events-auto absolute z-10 flex flex-col items-center"
			data-slot="globe-visitor-pin"
			style={style}
		>
			<button
				aria-label={buildVisitorSummaryLabel(visitor)}
				className="cursor-pointer rounded-full outline-hidden transition-transform duration-200 group-hover:scale-105 group-focus-visible:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background"
				type="button"
			>
				<Avatar
					className="size-9 rounded-full border border-background/80 bg-background shadow-lg ring-1 ring-black/10 dark:ring-white/10"
					facehashSeed={visitor.facehashSeed}
					fallbackName={visitor.name}
					status={visitor.status}
					tooltipContent={null}
					url={visitor.avatarUrl}
				/>
			</button>
			<div
				className={cn(
					"-translate-x-1/2 -translate-y-[calc(100%+0.75rem)] pointer-events-none absolute top-0 left-1/2 z-20 w-48 rounded-xl border border-border/70 bg-background/96 px-3 py-2 text-left shadow-xl backdrop-blur-sm",
					"opacity-0 transition duration-200 ease-out",
					"group-hover:-translate-y-[calc(100%+0.95rem)] group-hover:opacity-100",
					"group-focus-within:-translate-y-[calc(100%+0.95rem)] group-focus-within:opacity-100"
				)}
				data-slot="globe-visitor-card"
			>
				<p className="truncate font-medium text-foreground text-sm">
					{visitor.name}
				</p>
				{visitor.locationLabel ? (
					<p className="mt-1 truncate text-muted-foreground text-xs">
						{visitor.locationLabel}
					</p>
				) : null}
				{visitor.pageLabel ? (
					<p className="mt-1 truncate text-foreground/80 text-xs">
						{visitor.pageLabel}
					</p>
				) : null}
			</div>
		</div>
	);
}

export function GlobeVisitorOverlay({
	visitors,
}: {
	visitors: readonly ResolvedGlobeVisitor[];
}) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-20 overflow-visible"
			data-slot="globe-visitor-overlay"
		>
			{visitors.map((visitor) => (
				<GlobeVisitorPin key={visitor.markerId} visitor={visitor} />
			))}
		</div>
	);
}
