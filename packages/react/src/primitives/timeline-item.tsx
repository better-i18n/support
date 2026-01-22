import type { TimelineItem as TimelineItemType } from "@cossistant/types/api/timeline-item";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { useRenderElement } from "../utils/use-render-element";

/**
 * Metadata describing the origin of a timeline item and pre-parsed content that can
 * be consumed by render-prop children.
 */
export type TimelineItemRenderProps = {
	isVisitor: boolean;
	isAI: boolean;
	isHuman: boolean;
	timestamp: Date;
	text: string | null;
	senderType: "visitor" | "ai" | "human";
	itemType: "message" | "event" | "identification";
};

export type TimelineItemProps = Omit<
	React.HTMLAttributes<HTMLDivElement>,
	"children"
> & {
	children?:
		| React.ReactNode
		| ((props: TimelineItemRenderProps) => React.ReactNode);
	asChild?: boolean;
	className?: string;
	item: TimelineItemType;
};

/**
 * Generic timeline item wrapper that adds accessibility attributes and resolves the
 * sender type into convenient render props for custom layouts. Works with
 * both MESSAGE and EVENT timeline item types.
 */
export const TimelineItem = (() => {
	const Component = React.forwardRef<HTMLDivElement, TimelineItemProps>(
		({ children, className, asChild = false, item, ...props }, ref) => {
			// Determine sender type from timeline item properties
			const isVisitor = item.visitorId !== null;
			const isAI = item.aiAgentId !== null;
			const isHuman = item.userId !== null && !isVisitor;

			const senderType = isVisitor ? "visitor" : isAI ? "ai" : "human";

			const renderProps: TimelineItemRenderProps = {
				isVisitor,
				isAI,
				isHuman,
				timestamp: new Date(item.createdAt),
				text: item.text,
				senderType,
				itemType: item.type,
			};

			const content =
				typeof children === "function" ? children(renderProps) : children;

			const itemTypeLabel = (() => {
				if (item.type === "event") {
					return "Event";
				}
				if (item.type === "identification") {
					return "Identification";
				}
				if (isVisitor) {
					return "visitor";
				}
				if (isAI) {
					return "AI assistant";
				}
				return "human agent";
			})();

			return useRenderElement(
				"div",
				{
					className,
					asChild,
				},
				{
					ref,
					state: renderProps,
					props: {
						role: "article",
						"aria-label": `${item.type === "message" ? "Message" : "Event"} from ${itemTypeLabel}`,
						"data-timeline-item-id": item.id,
						...props,
						children: content,
					},
				}
			);
		}
	);

	Component.displayName = "TimelineItem";
	return Component;
})();

const MemoizedMarkdownBlock = React.memo(
	({ content }: { content: string }) => {
		return (
			<ReactMarkdown
				components={{
					// Render paragraphs as block elements to preserve multiline spacing
					p: ({ children }) => <span className="block">{children}</span>,
					// Ensure proper line break handling
					br: () => <br />,
					// Handle code blocks properly
					code: ({ children, ...props }) => {
						// Check if it's inline code by looking at the parent element
						const isInline = !(
							"className" in props &&
							typeof props.className === "string" &&
							props.className.includes("language-")
						);
						return isInline ? (
							<code className="rounded bg-co-background-300 px-1 py-0.5 text-xs">
								{children}
							</code>
						) : (
							<pre className="overflow-x-auto rounded bg-co-background-300 p-2">
								<code className="text-xs">{children}</code>
							</pre>
						);
					},
					// Handle strong/bold text
					strong: ({ children }) => (
						<strong className="font-semibold">{children}</strong>
					),
					// Handle links
					a: ({ href, children }) => (
						<a
							className="underline hover:opacity-80"
							href={href}
							rel="noopener noreferrer"
							target="_blank"
						>
							{children}
						</a>
					),
				}}
			>
				{content}
			</ReactMarkdown>
		);
	},
	(prevProps, nextProps) => {
		if (prevProps.content !== nextProps.content) {
			return false;
		}
		return true;
	}
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export type TimelineItemContentProps = Omit<
	React.HTMLAttributes<HTMLDivElement>,
	"children"
> & {
	children?: React.ReactNode | ((content: string) => React.ReactNode);
	asChild?: boolean;
	className?: string;
	text?: string | null;
	renderMarkdown?: boolean;
};

/**
 * Renders the content of a timeline item, optionally piping Markdown content through a
 * memoised renderer or handing the raw text to a render prop for custom
 * formatting.
 */
export const TimelineItemContent = (() => {
	const Component = React.forwardRef<HTMLDivElement, TimelineItemContentProps>(
		(
			{
				children,
				className,
				asChild = false,
				text = "",
				renderMarkdown = true,
				...props
			},
			ref
		) => {
			const content = React.useMemo(() => {
				const textContent = text ?? "";
				if (typeof children === "function") {
					return children(textContent);
				}
				if (children) {
					return children;
				}
				if (renderMarkdown && textContent) {
					return <MemoizedMarkdownBlock content={textContent} />;
				}
				return textContent;
			}, [children, text, renderMarkdown]);

			return useRenderElement(
				"div",
				{
					className,
					asChild,
				},
				{
					ref,
					props: {
						...props,
						children: content,
						style: {
							...props.style,
						},
					},
				}
			);
		}
	);

	Component.displayName = "TimelineItemContent";
	return Component;
})();

export type TimelineItemTimestampProps = Omit<
	React.HTMLAttributes<HTMLSpanElement>,
	"children"
> & {
	children?: React.ReactNode | ((timestamp: Date) => React.ReactNode);
	asChild?: boolean;
	className?: string;
	timestamp: Date;
	format?: (date: Date) => string;
};

/**
 * Timestamp helper that renders a formatted date or allows callers to supply a
 * render prop for custom time displays while preserving semantic markup.
 */
export const TimelineItemTimestamp = (() => {
	const Component = React.forwardRef<
		HTMLSpanElement,
		TimelineItemTimestampProps
	>(
		(
			{
				children,
				className,
				asChild = false,
				timestamp,
				format = (date) =>
					date.toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					}),
				...props
			},
			ref
		) => {
			const content =
				typeof children === "function"
					? children(timestamp)
					: children || format(timestamp);

			return useRenderElement(
				"span",
				{
					className,
					asChild,
				},
				{
					ref,
					props: {
						...props,
						children: content,
					},
				}
			);
		}
	);

	Component.displayName = "TimelineItemTimestamp";
	return Component;
})();
