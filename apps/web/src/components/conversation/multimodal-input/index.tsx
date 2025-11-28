"use client";

import type React from "react";
import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icons";
import { TooltipOnHover } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MultimodalInputProps = {
	className?: string;
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onFileSelect?: (files: File[]) => void;
	placeholder?: string;
	disabled?: boolean;
	isSubmitting?: boolean;
	error?: Error | null;
	files?: File[];
	onRemoveFile?: (index: number) => void;
	maxFiles?: number;
	maxFileSize?: number;
	allowedFileTypes?: string[];
};

export const MultimodalInput: React.FC<MultimodalInputProps> = ({
	className,
	value,
	onChange,
	onSubmit,
	onFileSelect,
	placeholder = "Type your message...",
	disabled = false,
	isSubmitting = false,
	error,
	files = [],
	onRemoveFile,
	maxFiles = 5,
	maxFileSize = 10 * 1024 * 1024, // 10MB
	allowedFileTypes = ["image/*", "application/pdf", "text/*"],
}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const hasContent = value.trim().length > 0 || files.length > 0;
	const canSubmit = !disabled && hasContent;

	// Auto-resize textarea with max height constraint
	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) {
			return;
		}

		// Reset height to auto to get accurate scrollHeight
		textarea.style.height = "auto";

		// Get the scroll height
		const scrollHeight = textarea.scrollHeight;

		textarea.style.height = `${scrollHeight}px`;
		textarea.style.overflowY = "hidden";
	}, [value]);

	const handleSubmit = () => {
		if (!canSubmit) {
			return;
		}

		onSubmit();
		// Focus textarea after submission
		textareaRef.current?.focus();
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	};

	const handleFormSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		handleSubmit();
	};

	const handleAttachClick = () => {
		if (files.length < maxFiles) {
			fileInputRef.current?.click();
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) {
			return `${bytes} B`;
		}
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	return (
		<div className="absolute right-0 bottom-4 left-0 z-10 mx-auto w-full px-4 xl:max-w-xl xl:px-0 2xl:max-w-2xl">
			<form className="flex flex-col gap-2" onSubmit={handleFormSubmit}>
				{/* Error message */}
				{error && (
					<div className="rounded-md bg-destructive-muted p-2 text-destructive text-xs">
						{error.message}
					</div>
				)}

				{/* File attachments */}
				{files.length > 0 && (
					<div className="flex flex-wrap gap-2 p-2">
						{files.map((file, index) => (
							<div
								className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs"
								key={`${file.name}-${index}`}
							>
								<Icon className="h-3 w-3" name="attachment" />
								<span className="max-w-[150px] truncate">{file.name}</span>
								<span className="text-muted-foreground">
									{formatFileSize(file.size)}
								</span>
								{onRemoveFile && (
									<TooltipOnHover content="Remove file">
										<Button
											className="ml-1"
											onClick={() => onRemoveFile(index)}
											size="icon-small"
											type="button"
											variant="ghost"
										>
											<Icon className="h-3 w-3" name="x" />
										</Button>
									</TooltipOnHover>
								)}
							</div>
						))}
					</div>
				)}

				{/* Input area */}
				<div className="flex h-fit flex-col rounded-lg border border-border/50 bg-background-100 drop-shadow-xs dark:border-border/50 dark:bg-background-300">
					<div className="scrollbar-thin scrollbar-track-fd-overlay scrollbar-thumb-border/30 hover:scrollbar-thumb-border/50 max-h-[280px] overflow-y-scroll">
						<textarea
							aria-describedby={error ? "multimodal-input-error" : undefined}
							aria-invalid={error ? "true" : undefined}
							autoFocus
							className={cn(
								"min-h-[20px] w-full flex-1 resize-none p-3 text-foreground text-sm placeholder:text-primary/50 focus-visible:outline-none",
								className
							)}
							disabled={disabled}
							onChange={(e) => onChange(e.target.value)}
							onKeyDown={(e) => {
								// Handle Cmd/Ctrl + Enter to submit
								if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									handleSubmit();
								}
							}}
							placeholder={placeholder}
							ref={textareaRef}
							rows={1}
							value={value}
						/>
					</div>
					<div className="flex items-center justify-end pr-1 pb-1 pl-3">
                                                <div className="flex items-center gap-0.5">
                                                        {/* File attachment button */}
                                                        {onFileSelect && (
                                                                <>
                                                                        <TooltipOnHover content="Attach files">
                                                                                <Button
                                                                                        className={cn(
                                                                                                files.length >= maxFiles &&
                                                                                                        "opacity-50"
                                                                                        )}
                                                                                        disabled={
                                                                                                disabled ||
                                                                                                isSubmitting ||
                                                                                                files.length >= maxFiles
                                                                                        }
                                                                                        onClick={handleAttachClick}
                                                                                        size="icon"
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                >
                                                                                        <Icon
                                                                                                className="h-4 w-4"
                                                                                                name="attachment"
                                                                                        />
                                                                                </Button>
                                                                        </TooltipOnHover>

                                                                        <input
                                                                                type="file"
                                                                                accept={allowedFileTypes.join(",")}
                                                                                className="hidden"
                                                                                disabled={
                                                                                        disabled ||
                                                                                        isSubmitting ||
                                                                                        files.length >= maxFiles
                                                                                }
                                                                                onChange={(e) => {
                                                                                        const files = Array.from(
                                                                                                e.target.files || []
                                                                                        );
                                                                                        if (files.length > 0 && onFileSelect) {
                                                                                                onFileSelect(files);
                                                                                                // Reset input to allow selecting the same file again
                                                                                                e.target.value = "";
                                                                                        }
                                                                                }}
                                                                                ref={fileInputRef}
                                                                                multiple
                                                                        />
                                                                </>
                                                        )}

                                                        <TooltipOnHover
                                                                content="Send message"
                                                                shortcuts={["mod", "enter"]}
                                                        >
								<Button
									className={cn(
										canSubmit
											? "[&_svg]:text-primary/90"
											: "[&_svg]:text-primary/50"
									)}
									disabled={!canSubmit}
									size="icon"
									type="submit"
									variant="ghost"
								>
									<Icon
										className={cn("size-4")}
										name="send"
										variant={canSubmit ? "filled" : "default"}
									/>
								</Button>
							</TooltipOnHover>
						</div>
					</div>
				</div>
			</form>
		</div>
	);
};
