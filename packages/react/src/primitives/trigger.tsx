import * as React from "react";
import { useStoreSelector } from "../hooks/private/store/use-store-selector";
import { isWidgetVisibleTypingEntry } from "../hooks/private/typing";
import { useSupport } from "../provider";
import { useSupportConfig } from "../support";
import { useTriggerRef } from "../support/context/positioning";
import { useRenderElement } from "../utils/use-render-element";

/**
 * Render props provided to the Trigger's children function.
 */
export type TriggerRenderProps = {
	isOpen: boolean;
	unreadCount: number;
	/** Whether a team member is currently typing */
	isTyping: boolean;
	toggle: () => void;
};

export type TriggerProps = Omit<
	React.ButtonHTMLAttributes<HTMLButtonElement>,
	"children"
> & {
	/**
	 * Content to render inside the trigger.
	 * Can be a ReactNode or a function that receives render props.
	 *
	 * @example
	 * // Static content
	 * <Trigger>Help</Trigger>
	 *
	 * @example
	 * // Dynamic content with render props
	 * <Trigger>
	 *   {({ isOpen, unreadCount }) => (
	 *     <span>{isOpen ? "Close" : `Help (${unreadCount})`}</span>
	 *   )}
	 * </Trigger>
	 */
	children?: React.ReactNode | ((props: TriggerRenderProps) => React.ReactNode);
	/**
	 * When true, the Trigger will render its children directly,
	 * passing all props to the child element.
	 */
	asChild?: boolean;
	className?: string;
};

/**
 * Trigger button that toggles the support window.
 * Can be placed anywhere in the DOM - the window will position itself relative to this element.
 *
 * @example
 * // Simple usage
 * <Trigger className="my-button">Need help?</Trigger>
 *
 * @example
 * // With render props
 * <Trigger>
 *   {({ isOpen, unreadCount, isTyping }) => (
 *     <button className="flex items-center gap-2">
 *       {isOpen ? "×" : "💬"}
 *       {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
 *     </button>
 *   )}
 * </Trigger>
 *
 * @example
 * // With asChild pattern
 * <Trigger asChild>
 *   <MyCustomButton>Help</MyCustomButton>
 * </Trigger>
 */
export const SupportTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(
	({ children, className, asChild = false, ...props }, ref) => {
		const { isOpen, toggle } = useSupportConfig();
		const { unreadCount, client } = useSupport();
		const triggerRefContext = useTriggerRef();

		// Extract setTriggerElement for stable dependency (state setter has stable identity)
		const setTriggerElement = triggerRefContext?.setTriggerElement;

		// Merge the external ref with the positioning context ref
		// Using setTriggerElement directly ensures stable ref callback identity
		const mergedRef = React.useCallback(
			(element: HTMLButtonElement | null) => {
				// Set the positioning context ref
				setTriggerElement?.(element);

				// Handle the forwarded ref
				if (typeof ref === "function") {
					ref(element);
				} else if (ref) {
					ref.current = element;
				}
			},
			[ref, setTriggerElement]
		);

		const hasTyping = useStoreSelector(
			client?.typingStore ?? null,
			React.useCallback(
				(
					state: {
						conversations: Record<
							string,
							Record<string, { actorType: string; actorId: string }>
						>;
					} | null
				) =>
					state
						? Object.values(state.conversations).some((entries) =>
								Object.values(entries).some((entry) =>
									isWidgetVisibleTypingEntry(entry)
								)
							)
						: false,
				[]
			)
		);

		const renderProps: TriggerRenderProps = {
			isOpen,
			unreadCount,
			isTyping: hasTyping,
			toggle,
		};

		const content =
			typeof children === "function" ? children(renderProps) : children;

		return useRenderElement(
			"button",
			{
				asChild,
				className,
			},
			{
				ref: mergedRef,
				state: renderProps,
				props: {
					type: "button",
					"aria-haspopup": "dialog",
					"aria-expanded": isOpen,
					onClick: toggle,
					...props,
					children: content,
				},
			}
		);
	}
);

SupportTrigger.displayName = "SupportTrigger";
