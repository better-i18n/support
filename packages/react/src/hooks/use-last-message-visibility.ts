import { useCallback, useEffect, useRef, useState } from "react";

export type UseLastMessageVisibilityOptions = {
	/** Ref to the container element (conversation timeline) */
	containerRef: React.RefObject<HTMLElement | null>;
	/** The ID of the last message element to observe */
	lastMessageId: string | null | undefined;
	/** Minimum time visible before considered "seen" (ms) */
	visibilityThreshold?: number;
	/** Whether observation is enabled */
	enabled?: boolean;
};

export type UseLastMessageVisibilityReturn = {
	/** Whether the last message is currently visible in the viewport */
	isLastMessageVisible: boolean;
	/** Manually reset the visibility state (e.g., when message changes) */
	reset: () => void;
};

/**
 * Hook to detect when the last message in a conversation is visible in the viewport.
 * Uses IntersectionObserver to track visibility and requires the message to be visible
 * for a minimum threshold duration before reporting as visible.
 *
 * Timeline items must have a `data-timeline-item-id` attribute for this hook to work.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { isLastMessageVisible } = useLastMessageVisibility({
 *   containerRef,
 *   lastMessageId: lastItem?.id,
 *   visibilityThreshold: 500,
 *   enabled: isWidgetOpen,
 * });
 * ```
 */
export function useLastMessageVisibility({
	containerRef,
	lastMessageId,
	visibilityThreshold = 500,
	enabled = true,
}: UseLastMessageVisibilityOptions): UseLastMessageVisibilityReturn {
	const [isLastMessageVisible, setIsLastMessageVisible] = useState(false);
	const visibleSinceRef = useRef<number | null>(null);
	const observerRef = useRef<IntersectionObserver | null>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastObservedIdRef = useRef<string | null>(null);

	const reset = useCallback(() => {
		setIsLastMessageVisible(false);
		visibleSinceRef.current = null;
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	}, []);

	useEffect(() => {
		// Reset when disabled or no message ID
		if (!(enabled && lastMessageId)) {
			reset();
			observerRef.current?.disconnect();
			observerRef.current = null;
			lastObservedIdRef.current = null;
			return;
		}

		// Reset when message ID changes
		if (lastObservedIdRef.current !== lastMessageId) {
			reset();
			lastObservedIdRef.current = lastMessageId;
		}

		const container = containerRef.current;
		if (!container) {
			return;
		}

		// Find the message element by data attribute
		const messageElement = container.querySelector(
			`[data-timeline-item-id="${lastMessageId}"]`
		);

		if (!messageElement) {
			// Element not found - this is normal during initial render
			// We'll try again on the next effect run
			return;
		}

		// Disconnect previous observer
		observerRef.current?.disconnect();

		observerRef.current = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry) {
					return;
				}

				if (entry.isIntersecting) {
					// Message is visible
					if (visibleSinceRef.current === null) {
						visibleSinceRef.current = Date.now();
					}

					const visibleFor = Date.now() - visibleSinceRef.current;

					if (visibleFor >= visibilityThreshold) {
						setIsLastMessageVisible(true);
					} else {
						// Schedule check after remaining threshold time
						if (timeoutRef.current) {
							clearTimeout(timeoutRef.current);
						}
						timeoutRef.current = setTimeout(() => {
							// Re-check if still visible
							if (visibleSinceRef.current !== null) {
								setIsLastMessageVisible(true);
							}
							timeoutRef.current = null;
						}, visibilityThreshold - visibleFor);
					}
				} else {
					// Message is not visible
					visibleSinceRef.current = null;
					setIsLastMessageVisible(false);
					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current);
						timeoutRef.current = null;
					}
				}
			},
			{
				root: container,
				threshold: 0.5, // At least 50% visible
			}
		);

		observerRef.current.observe(messageElement);

		return () => {
			observerRef.current?.disconnect();
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, [enabled, lastMessageId, containerRef, visibilityThreshold, reset]);

	return { isLastMessageVisible, reset };
}
