"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useVisitor({
	websiteSlug,
	visitorId,
}: {
	websiteSlug: string;
	visitorId: string;
}) {
	const trpc = useTRPC();

	const {
		data: visitor,
		isFetching,
		isLoading,
		error,
		isError,
		refetch,
	} = useQuery({
		...trpc.conversation.getVisitorById.queryOptions({
			websiteSlug,
			visitorId,
		}),
		staleTime: 0,
		refetchOnMount: "always",
	});

	return {
		visitor: visitor ?? null,
		isLoading,
		isFetching,
		isError,
		error,
		refetch,
	};
}
