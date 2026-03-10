"use client";

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const segmentedControlVariants = cva(
	"relative inline-grid w-fit items-stretch overflow-visible rounded-[2px] border border-primary/10 bg-background dark:bg-background-50",
	{
		variants: {
			size: {
				default: "h-8",
				sm: "h-7",
			},
		},
		defaultVariants: {
			size: "default",
		},
	}
);

const segmentedControlItemVariants = cva(
	"relative z-10 inline-flex h-full min-w-0 items-center justify-center px-2 font-medium text-primary/60 outline-none transition-colors hover:cursor-pointer disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-primary",
	{
		variants: {
			size: {
				default: "text-sm",
				sm: "px-2.5 text-xs",
			},
		},
		defaultVariants: {
			size: "default",
		},
	}
);

export type SegmentedControlOption<T extends string = string> = {
	value: T;
	label: React.ReactNode;
	disabled?: boolean;
};

export type SegmentedControlProps<T extends string = string> = {
	options: readonly SegmentedControlOption<T>[];
	value: T;
	onValueChange: (value: T) => void;
	className?: string;
	disabled?: boolean;
	size?: VariantProps<typeof segmentedControlVariants>["size"];
	"aria-label": string;
};

export function SegmentedControl<T extends string = string>({
	options,
	value,
	onValueChange,
	className,
	disabled,
	size,
	"aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
	const activeIndex = options.findIndex((option) => option.value === value);

	return (
		<ToggleGroupPrimitive.Root
			aria-label={ariaLabel}
			className={cn(segmentedControlVariants({ size, className }))}
			data-segment-count={options.length}
			data-slot="segmented-control"
			onValueChange={(nextValue) => {
				if (nextValue) {
					onValueChange(nextValue as T);
				}
			}}
			style={{
				gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
			}}
			type="single"
			value={value}
		>
			{activeIndex >= 0 ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute rounded-[2px] border bg-background-100 shadow-xs transition-[left] duration-100 ease-out dark:bg-background-300"
					data-slot="segmented-control-indicator"
					style={{
						left: `calc(${activeIndex} * (100% / ${options.length}) - 1px)`,
						top: "-2px",
						bottom: "-2px",
						width: `calc(100% / ${options.length} + 4px)`,
					}}
				/>
			) : null}
			{options.map((option) => (
				<ToggleGroupPrimitive.Item
					className={cn(segmentedControlItemVariants({ size }))}
					data-slot="segmented-control-item"
					disabled={disabled || option.disabled}
					key={option.value}
					value={option.value}
				>
					{option.label}
				</ToggleGroupPrimitive.Item>
			))}
		</ToggleGroupPrimitive.Root>
	);
}

export { segmentedControlVariants };
