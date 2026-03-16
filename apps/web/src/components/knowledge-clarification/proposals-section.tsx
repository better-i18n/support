"use client";

import type { KnowledgeClarificationRequest } from "@cossistant/types";
import { formatDistanceToNow } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { BotIcon, SparklesIcon } from "lucide-react";
import {
	TrainingEntryList,
	TrainingEntryListSection,
	TrainingEntryRow,
	useTrainingEntryPrefetch,
} from "@/components/training-entries";
import { Badge } from "@/components/ui/badge";

type KnowledgeClarificationProposalsSectionProps = {
	websiteSlug: string;
	proposals: KnowledgeClarificationRequest[];
	className?: string;
};

type ProposalAppearance = {
	statusLabel: string;
	statusVariant: "secondary" | "success";
	previewLabel: string;
	previewText: string;
	Icon: LucideIcon;
};

function getSourceLabel(
	source: KnowledgeClarificationRequest["source"]
): string {
	return source === "faq" ? "From FAQ" : "From conversation";
}

function getProposalPreviewText(
	proposal: KnowledgeClarificationRequest
): string {
	return (
		proposal.draftFaqPayload?.question ??
		proposal.currentQuestion ??
		proposal.lastError ??
		"Open this proposal to continue the clarification flow."
	);
}

function getProposalAppearance(
	proposal: KnowledgeClarificationRequest
): ProposalAppearance {
	if (proposal.status === "draft_ready" && proposal.draftFaqPayload) {
		return {
			statusLabel: "Ready for review",
			statusVariant: "success",
			previewLabel: "Draft",
			previewText: getProposalPreviewText(proposal),
			Icon: SparklesIcon,
		};
	}

	if (proposal.status === "analyzing") {
		return {
			statusLabel: "AI working",
			statusVariant: "secondary",
			previewLabel: "Topic",
			previewText: proposal.topicSummary,
			Icon: BotIcon,
		};
	}

	return {
		statusLabel: `Step ${Math.max(proposal.stepIndex, 1)} of ${proposal.maxSteps}`,
		statusVariant: "secondary",
		previewLabel: proposal.lastError ? "Issue" : "Question",
		previewText: getProposalPreviewText(proposal),
		Icon: BotIcon,
	};
}

export function KnowledgeClarificationProposalsSection({
	websiteSlug,
	proposals,
	className,
}: KnowledgeClarificationProposalsSectionProps) {
	const { prefetchProposal } = useTrainingEntryPrefetch(websiteSlug);

	if (proposals.length === 0) {
		return null;
	}

	return (
		<TrainingEntryListSection
			className={className}
			description="Draft FAQs and clarification threads the AI wants you to review."
			title={`AI Suggestions (${proposals.length})`}
		>
			<TrainingEntryList>
				{proposals.map((proposal) => {
					const appearance = getProposalAppearance(proposal);
					const updatedLabel = formatDistanceToNow(
						new Date(proposal.updatedAt),
						{
							addSuffix: true,
						}
					);
					const href = `/${websiteSlug}/agent/training/faq/proposals/${proposal.id}`;

					return (
						<TrainingEntryRow
							href={href}
							icon={<appearance.Icon className="size-4" />}
							key={proposal.id}
							onHoverPrefetch={() => prefetchProposal(proposal.id, href)}
							preview={
								<span>
									<span className="font-medium text-primary/70">
										{appearance.previewLabel}:
									</span>{" "}
									{appearance.previewText}
								</span>
							}
							primary={proposal.topicSummary}
							rightMeta={
								<div className="flex flex-wrap items-center justify-end gap-2 text-xs">
									<Badge variant="secondary">AI Suggestion</Badge>
									<Badge variant={appearance.statusVariant}>
										{appearance.statusLabel}
									</Badge>
									<Badge className="hidden md:inline-flex" variant="secondary">
										{getSourceLabel(proposal.source)}
									</Badge>
									<span className="hidden text-primary/40 md:inline">
										{updatedLabel}
									</span>
								</div>
							}
						/>
					);
				})}
			</TrainingEntryList>
		</TrainingEntryListSection>
	);
}

export type { KnowledgeClarificationProposalsSectionProps };
