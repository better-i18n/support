import "./support.css";

import type { DefaultMessage } from "@cossistant/types";
import React, { type ReactElement } from "react";
import { useSupport } from "../provider";
import { SupportRealtimeProvider } from "../realtime";
import { SupportConfig } from "../support-config";
import { SupportContent } from "./components/support-content";
import { SupportUnavailable } from "./components/support-unavailable";
import { SupportConfigProvider } from "./context/config";
import type { SupportLocale, SupportTextContentOverrides } from "./text";
import { SupportTextProvider } from "./text";

const LOCALHOST_HOSTNAMES = new Set([
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
]);

function isLocalEnvironment(): boolean {
        if (typeof window === "undefined") {
                return false;
        }

        const hostname = window.location.hostname.toLowerCase();
        return (
                LOCALHOST_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")
        );
}

export type SupportProps<Locale extends string = SupportLocale> = {
	className?: string;
	position?: "top" | "bottom";
	align?: "right" | "left";
	// Display the support widget in a floating window or in responsive mode (takes the full width / height of the parent)
	mode?: "floating" | "responsive";
	quickOptions?: string[];
	defaultMessages?: DefaultMessage[];
	defaultOpen?: boolean;
	locale?: Locale;
	content?: SupportTextContentOverrides<Locale>;
};

// Internal component that needs the conversation context
/**
 * Orchestrates the end-user support experience by nesting realtime, config and
 * content providers. Renders nothing until website data is available to avoid
 * flashing incomplete UI.
 */
export function Support<Locale extends string = SupportLocale>({
        className,
        position = "bottom",
        align = "right",
        mode = "floating",
        quickOptions,
        defaultMessages,
        defaultOpen,
        locale,
        content,
}: SupportProps<Locale>): ReactElement | null {
        const { website, error } = useSupport();

        const isLocalhost = isLocalEnvironment();

        if (error) {
                if (!isLocalhost) {
                        return null;
                }

                return (
                        <SupportUnavailable
                                align={align}
                                className={className}
                                errorMessage={error.message}
                                mode={mode}
                                position={position}
                        />
                );
        }

        if (!website) {
                return null;
        }

	return (
		<>
			<SupportRealtimeProvider>
				<SupportConfigProvider defaultOpen={defaultOpen} mode={mode}>
					<SupportTextProvider content={content} locale={locale}>
						<SupportContent
							align={align}
							className={className}
							mode={mode}
							position={position}
						/>
					</SupportTextProvider>
				</SupportConfigProvider>
			</SupportRealtimeProvider>
			<SupportConfig
				defaultMessages={defaultMessages}
				quickOptions={quickOptions}
			/>
		</>
	);
}

export default Support;

export { useSupportConfig } from "./context/config";
export type { WebSocketContextValue } from "./context/websocket";
export { useWebSocket, WebSocketProvider } from "./context/websocket";
// Export the store for direct access if needed
export { useSupportStore } from "./store";
export type { SupportLocale, SupportTextContentOverrides } from "./text";
export { Text, useSupportText } from "./text";
