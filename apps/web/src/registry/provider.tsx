"use client";

import { SupportProvider } from "@cossistant/next";

export function CossistantProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return <SupportProvider>{children}</SupportProvider>;
}
