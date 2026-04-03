"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebsite } from "@/contexts/website";
import { useTRPC } from "@/lib/trpc/client";
import { AgentOnboardingFlow } from "./agent-onboarding-flow";

export default function AgentCreatePage() {
	const website = useWebsite();
	const router = useRouter();
	const trpc = useTRPC();

	// Data is pre-fetched in the layout, so it will be available immediately
	const { data: existingAgent } = useQuery(
		trpc.aiAgent.get.queryOptions({
			websiteSlug: website.slug,
		})
	);

	// Only redirect if agent exists AND onboarding is complete
	// If agent exists but onboarding not complete, show the flow to continue
	useEffect(() => {
		if (existingAgent?.onboardingCompletedAt) {
			router.replace(`/${website.slug}/agent`);
		}
	}, [existingAgent?.onboardingCompletedAt, router, website.slug]);

	// Don't render if agent exists with completed onboarding (we'll redirect)
	if (existingAgent?.onboardingCompletedAt) {
		return null;
	}

	return (
		<ScrollArea className="h-screen w-full" orientation="vertical" scrollMask>
			<AgentOnboardingFlow existingAgent={existingAgent} />
		</ScrollArea>
	);
}
