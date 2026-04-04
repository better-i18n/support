"use client";

import { SupportProvider } from "@cossistant/next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { TRPCReactProvider } from "@/lib/trpc/client";

type ProviderProps = {
	//   locale: string;
	children: ReactNode;
};

const API_BASE =
	process.env.NEXT_PUBLIC_API_BASE_URL || "https://support-api.better-i18n.com";

export function Providers({ children }: ProviderProps) {
	return (
		<SupportProvider
			apiUrl={`${API_BASE}/v1`}
			wsUrl={`${API_BASE.replace(/^https?/, "wss")}/ws`}
		>
			<NuqsAdapter>
				<RootProvider
					search={{
						enabled: false,
					}}
					theme={{
						attribute: "class",
						defaultTheme: "system",
						enableSystem: true,
						disableTransitionOnChange: true,
					}}
				>
					<TRPCReactProvider>{children}</TRPCReactProvider>
				</RootProvider>
			</NuqsAdapter>
		</SupportProvider>
	);
}
