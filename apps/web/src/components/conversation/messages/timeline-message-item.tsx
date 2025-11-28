import {
        TimelineItem as PrimitiveTimelineItem,
        TimelineItemContent,
        TimelineItemTimestamp,
} from "@cossistant/next/primitives";
import type {
        TimelineItem,
        TimelinePartFile,
        TimelinePartImage,
} from "@cossistant/types/api/timeline-item";
import type React from "react";
import { cn } from "@/lib/utils";

export type TimelineMessageItemProps = {
        item: TimelineItem;
        isLast?: boolean;
        isSentByViewer?: boolean;
};

export function TimelineMessageItem({
        item,
        isLast = false,
        isSentByViewer = false,
}: TimelineMessageItemProps) {
        const textPart = item.parts.find((part) => part.type === "text");
        const textContent = textPart?.text ?? item.text ?? "";
        const attachments = item.parts.filter(
                (part): part is TimelinePartImage | TimelinePartFile =>
                        part.type === "image" || part.type === "file"
        );

        const imageParts = attachments.filter(
                (part): part is TimelinePartImage => part.type === "image"
        );
        const fileParts = attachments.filter(
                (part): part is TimelinePartFile => part.type === "file"
        );

        const bubbleClass = cn(
                "block min-w-0 max-w-full whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm md:max-w-[420px]",
                {
                        "bg-background-300 text-foreground dark:bg-background-600": !isSentByViewer,
                        "bg-primary text-primary-foreground": isSentByViewer,
                        "rounded-br-[2px]": isLast && isSentByViewer,
                        "rounded-bl-[2px]": isLast && !isSentByViewer,
                }
        );

        return (
                <PrimitiveTimelineItem item={item}>
                        {({ isAI, timestamp }) => (
                                <div
                                        className={cn(
                                                "flex w-full gap-2",
                                                isSentByViewer && "flex-row-reverse",
                                                !isSentByViewer && "flex-row"
                                        )}
                                >
                                        <div
                                                className={cn(
                                                        "flex w-full min-w-0 flex-1 flex-col gap-3",
                                                        isSentByViewer && "items-end"
                                                )}
                                        >
                                                <div className={bubbleClass}>
                                                        <div className="flex flex-col gap-2">
                                                                {textContent && (
                                                                        <TimelineItemContent
                                                                                className="break-words p-0 text-inherit"
                                                                                renderMarkdown
                                                                                text={textContent}
                                                                        />
                                                                )}

                                                                {imageParts.length > 0 && (
                                                                        <div className="flex flex-col gap-2">
                                                                                {imageParts.map((part, index) => (
                                                                                        <a
                                                                                                key={`${part.url}-${index}`}
                                                                                                className="group block overflow-hidden rounded-md border border-border/50"
                                                                                                href={part.url}
                                                                                                rel="noreferrer"
                                                                                                target="_blank"
                                                                                        >
                                                                                                <img
                                                                                                        alt={
                                                                                                                part.fileName ??
                                                                                                                "Attached image"
                                                                                                        }
                                                                                                        className="h-auto max-h-48 w-full object-cover transition group-hover:scale-[1.01]"
                                                                                                        src={part.url}
                                                                                                />
                                                                                        </a>
                                                                                ))}
                                                                        </div>
                                                                )}

                                                                {fileParts.length > 0 && (
                                                                        <div className="flex flex-col gap-2">
                                                                                {fileParts.map((part, index) => (
                                                                                        <a
                                                                                                key={`${part.url}-${index}`}
                                                                                                className="flex items-center gap-2 rounded-md bg-background/60 px-3 py-2 text-sm underline-offset-2 hover:underline"
                                                                                                href={part.url}
                                                                                                rel="noreferrer"
                                                                                                target="_blank"
                                                                                                download={part.fileName ?? undefined}
                                                                                        >
                                                                                                <span className="font-medium">
                                                                                                        {part.fileName ?? "Attachment"}
                                                                                                </span>
                                                                                                {typeof part.size === "number" && (
                                                                                                        <span className="text-xs opacity-70">
                                                                                                                {formatFileSize(part.size)}
                                                                                                        </span>
                                                                                                )}
                                                                                        </a>
                                                                                ))}
                                                                        </div>
                                                                )}
                                                        </div>
                                                </div>
                                                {isLast && (
                                                        <TimelineItemTimestamp
                                                                className="px-1 text-muted-foreground text-xs"
                                                                timestamp={timestamp}
                                                        >
                                                                {() => (
                                                                        <>
                                                                                {timestamp.toLocaleTimeString([], {
                                                                                        hour: "2-digit",
                                                                                        minute: "2-digit",
                                                                                })}
                                                                                {isAI && " • AI agent"}
                                                                        </>
                                                                )}
                                                        </TimelineItemTimestamp>
                                                )}
                                        </div>
                                </div>
                        )}
                </PrimitiveTimelineItem>
        );
}

function formatFileSize(bytes: number): string {
        if (bytes < 1024) {
                return `${bytes} B`;
        }
        if (bytes < 1024 * 1024) {
                return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
