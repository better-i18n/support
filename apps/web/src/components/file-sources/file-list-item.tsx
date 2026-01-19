"use client";

import type {
	ArticleKnowledgePayload,
	KnowledgeResponse,
} from "@cossistant/types";
import {
	EditIcon,
	EyeIcon,
	EyeOffIcon,
	FileTextIcon,
	MoreHorizontalIcon,
	Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type FileListItemProps = {
	file: KnowledgeResponse;
	onEdit: (file: KnowledgeResponse) => void;
	onDelete: (id: string) => void;
	onToggleIncluded: (id: string, isIncluded: boolean) => void;
	isDeleting?: boolean;
	isToggling?: boolean;
};

function formatBytes(bytes: number): string {
	if (bytes === 0) {
		return "0 B";
	}
	const k = 1024;
	const sizes = ["B", "KB", "MB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function FileListItem({
	file,
	onEdit,
	onDelete,
	onToggleIncluded,
	isDeleting,
	isToggling,
}: FileListItemProps) {
	const payload = file.payload as ArticleKnowledgePayload;

	return (
		<div
			className={cn(
				"group rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50",
				!file.isIncluded && "opacity-60"
			)}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
						<FileTextIcon className="h-5 w-5 text-muted-foreground" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h4 className="truncate font-medium">{payload.title}</h4>
							{!file.isIncluded && (
								<Badge className="shrink-0" variant="secondary">
									Excluded
								</Badge>
							)}
						</div>
						{payload.summary && (
							<p className="mt-1 line-clamp-1 text-muted-foreground text-sm">
								{payload.summary}
							</p>
						)}
						<div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
							<span>{formatBytes(file.sizeBytes)}</span>
							<span>
								{file.origin === "file-upload" ? "Uploaded" : "Manual"}
							</span>
						</div>
					</div>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-8 w-8 opacity-0 group-hover:opacity-100"
							size="icon"
							variant="ghost"
						>
							<MoreHorizontalIcon className="h-4 w-4" />
							<span className="sr-only">Open menu</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => onEdit(file)}>
							<EditIcon className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={isToggling}
							onClick={() => onToggleIncluded(file.id, !file.isIncluded)}
						>
							{file.isIncluded ? (
								<>
									<EyeOffIcon className="mr-2 h-4 w-4" />
									Exclude from training
								</>
							) : (
								<>
									<EyeIcon className="mr-2 h-4 w-4" />
									Include in training
								</>
							)}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							disabled={isDeleting}
							onClick={() => onDelete(file.id)}
						>
							<Trash2Icon className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

export type { FileListItemProps };
