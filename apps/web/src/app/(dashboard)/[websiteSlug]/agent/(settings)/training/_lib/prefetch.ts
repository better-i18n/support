import "server-only";

import { groupLinkSourcesByDomain } from "@/data/link-source-cache";
import { ensureWebsiteAccess } from "@/lib/auth/website-access";
import { getQueryClient, prefetch, trpc } from "@/lib/trpc/server";

async function fetchTrainingAiAgent(websiteSlug: string) {
	const queryClient = getQueryClient();

	return await queryClient.fetchQuery(
		trpc.aiAgent.get.queryOptions({
			websiteSlug,
		})
	);
}

export async function prefetchTrainingShell(websiteSlug: string) {
	await ensureWebsiteAccess(websiteSlug);

	const aiAgentPromise = fetchTrainingAiAgent(websiteSlug);
	const planInfoPromise = prefetch(
		trpc.plan.getPlanInfo.queryOptions({
			websiteSlug,
		})
	);
	const readinessPromise = prefetch(
		trpc.aiAgent.getTrainingReadiness.queryOptions({
			websiteSlug,
		})
	);
	const aiAgent = await aiAgentPromise;

	const shellPrefetches: Promise<unknown>[] = [
		planInfoPromise,
		readinessPromise,
		prefetch(
			trpc.linkSource.getTrainingStats.queryOptions({
				websiteSlug,
				aiAgentId: aiAgent?.id ?? null,
			})
		),
	];

	if (aiAgent?.id) {
		shellPrefetches.push(
			prefetch(
				trpc.aiAgent.getTrainingStatus.queryOptions({
					websiteSlug,
				})
			)
		);
	}

	await Promise.all(shellPrefetches);

	return {
		aiAgentId: aiAgent?.id ?? null,
	};
}

export async function prefetchFaqListPageData(websiteSlug: string) {
	const aiAgent = await fetchTrainingAiAgent(websiteSlug);

	await Promise.all([
		prefetch(
			trpc.knowledge.list.queryOptions({
				websiteSlug,
				type: "faq",
				aiAgentId: aiAgent?.id ?? null,
				limit: 100,
			})
		),
		prefetch(
			trpc.knowledgeClarification.listProposals.queryOptions({
				websiteSlug,
			})
		),
	]);
}

export async function prefetchFaqEditorPageData(
	websiteSlug: string,
	knowledgeId?: string
) {
	if (!knowledgeId) {
		return;
	}

	await prefetch(
		trpc.knowledge.get.queryOptions({
			websiteSlug,
			id: knowledgeId,
		})
	);
}

export async function prefetchFaqProposalPageData(
	websiteSlug: string,
	requestId: string
) {
	await prefetch(
		trpc.knowledgeClarification.getProposal.queryOptions({
			websiteSlug,
			requestId,
		})
	);
}

export async function prefetchFileListPageData(websiteSlug: string) {
	const aiAgent = await fetchTrainingAiAgent(websiteSlug);

	await prefetch(
		trpc.knowledge.list.queryOptions({
			websiteSlug,
			type: "article",
			aiAgentId: aiAgent?.id ?? null,
			limit: 100,
		})
	);
}

export async function prefetchFileEditorPageData(
	websiteSlug: string,
	knowledgeId?: string
) {
	if (!knowledgeId) {
		return;
	}

	await prefetch(
		trpc.knowledge.get.queryOptions({
			websiteSlug,
			id: knowledgeId,
		})
	);
}

export async function prefetchWebListPageData(websiteSlug: string) {
	const aiAgent = await fetchTrainingAiAgent(websiteSlug);
	const queryClient = getQueryClient();
	const linkSourceList = await queryClient.fetchQuery(
		trpc.linkSource.list.queryOptions({
			websiteSlug,
			aiAgentId: aiAgent?.id ?? null,
			limit: 100,
		})
	);

	const groupedByDomain = groupLinkSourcesByDomain(linkSourceList.items);
	if (groupedByDomain.size !== 1) {
		return;
	}

	await Promise.all(
		linkSourceList.items.map((source) =>
			prefetch(
				trpc.linkSource.listKnowledgeByLinkSource.queryOptions({
					websiteSlug,
					linkSourceId: source.id,
					limit: 100,
				})
			)
		)
	);
}

export async function prefetchWebPageDetailData(
	websiteSlug: string,
	knowledgeId: string
) {
	await prefetch(
		trpc.knowledge.get.queryOptions({
			websiteSlug,
			id: knowledgeId,
		})
	);
}
