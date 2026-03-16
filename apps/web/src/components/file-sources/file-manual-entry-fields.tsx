"use client";

import {
	TrainingEntryField,
	TrainingEntryMarkdownField,
	TrainingEntrySection,
} from "@/components/training-entries";

type FileManualEntryFieldsProps = {
	title: string;
	summary: string;
	markdown: string;
	disabled?: boolean;
	onTitleChange: (value: string) => void;
	onSummaryChange: (value: string) => void;
	onMarkdownChange: (value: string) => void;
};

export function FileManualEntryFields({
	title,
	summary,
	markdown,
	disabled = false,
	onTitleChange,
	onSummaryChange,
	onMarkdownChange,
}: FileManualEntryFieldsProps) {
	return (
		<>
			<TrainingEntrySection
				description="Set the visible title and short summary for this file."
				title="Details"
			>
				<TrainingEntryField
					disabled={disabled}
					id="file-title"
					label="Title"
					onChange={onTitleChange}
					placeholder="Getting Started Guide"
					value={title}
				/>
				<TrainingEntryField
					description="Optional preview shown in the list."
					disabled={disabled}
					id="file-summary"
					label="Summary"
					onChange={onSummaryChange}
					placeholder="A quick overview of how to get started..."
					value={summary}
				/>
			</TrainingEntrySection>
			<TrainingEntrySection
				description="Paste the markdown you want this knowledge entry to contain."
				title="Content"
			>
				<TrainingEntryMarkdownField
					disabled={disabled}
					id="file-markdown"
					label="Markdown"
					onChange={onMarkdownChange}
					placeholder="# Getting started&#10;&#10;Welcome to our documentation..."
					value={markdown}
				/>
			</TrainingEntrySection>
		</>
	);
}

export type { FileManualEntryFieldsProps };
