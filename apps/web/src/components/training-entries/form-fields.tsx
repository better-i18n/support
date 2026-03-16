"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TrainingEntrySectionProps = {
	title: string;
	description?: string;
	children?: ReactNode;
	className?: string;
};

type TrainingEntryFieldProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	description?: string;
	disabled?: boolean;
};

type TrainingEntryMarkdownFieldProps = TrainingEntryFieldProps & {
	rows?: number;
	className?: string;
};

export function TrainingEntrySection({
	title,
	description,
	children,
	className,
}: TrainingEntrySectionProps) {
	return (
		<section
			className={cn(
				"rounded-2xl border bg-background-100/80 p-5 dark:bg-background-100/60",
				className
			)}
		>
			<div className="mb-5 space-y-1">
				<h2 className="font-medium text-base">{title}</h2>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{children ? <div className="space-y-4">{children}</div> : null}
		</section>
	);
}

export function TrainingEntryField({
	id,
	label,
	value,
	onChange,
	placeholder,
	description,
	disabled,
}: TrainingEntryFieldProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				disabled={disabled}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				value={value}
			/>
			{description ? (
				<p className="text-muted-foreground text-xs">{description}</p>
			) : null}
		</div>
	);
}

export function TrainingEntryMarkdownField({
	id,
	label,
	value,
	onChange,
	placeholder,
	description,
	disabled,
	rows = 14,
	className,
}: TrainingEntryMarkdownFieldProps) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Textarea
				className={cn("min-h-[280px] font-mono text-sm", className)}
				disabled={disabled}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				rows={rows}
				value={value}
			/>
			{description ? (
				<p className="text-muted-foreground text-xs">{description}</p>
			) : null}
		</div>
	);
}

export function TrainingEntryTagsField({
	id,
	label,
	value,
	onChange,
	placeholder,
	description,
	disabled,
}: TrainingEntryFieldProps) {
	return (
		<TrainingEntryField
			description={description}
			disabled={disabled}
			id={id}
			label={label}
			onChange={onChange}
			placeholder={placeholder}
			value={value}
		/>
	);
}

export type {
	TrainingEntryFieldProps,
	TrainingEntryMarkdownFieldProps,
	TrainingEntrySectionProps,
};
