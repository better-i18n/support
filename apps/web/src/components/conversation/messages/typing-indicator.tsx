import {
	MessageGroupAvatar,
	MessageGroupContent,
	MessageGroupHeader,
} from "@cossistant/react/primitives/message-group";
import type {
	AvailableAIAgent,
	AvailableHumanAgent,
	ConversationHeader,
} from "@cossistant/types";
import { motion } from "motion/react";
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { TextEffect } from "@/components/ui/text-effect";
import { useVisitorPresenceById } from "@/contexts/visitor-presence";
import { cn } from "@/lib/utils";
import { getVisitorNameWithFallback } from "@/lib/visitors";

export type TypingParticipantType = "visitor" | "team_member" | "ai";

export type TypingParticipant = {
	id: string;
	type: TypingParticipantType;
	preview: string | null;
};

export type TypingIndicatorProps = React.HTMLAttributes<HTMLDivElement> & {
	activeTypingEntities: TypingParticipant[];
	availableAIAgents?: AvailableAIAgent[];
	visitor: ConversationHeader["visitor"];
	availableHumanAgents?: AvailableHumanAgent[];
	withAvatars?: boolean;
};

export const BouncingDots = ({ className }: { className?: string }) => {
	return (
		<div
			className={cn("my-auto inline-flex h-2 items-center gap-1", className)}
		>
			<span className="dot-bounce-1 size-[3px] rounded-full bg-primary" />
			<span className="dot-bounce-2 size-[3px] rounded-full bg-primary" />
			<span className="dot-bounce-3 size-[3px] rounded-full bg-primary" />
		</div>
	);
};

export const VisitorTypingPreview = ({
	visitor,
	preview,
}: {
	visitor: ConversationHeader["visitor"];
	preview: string | null;
}) => {
	const visitorName = getVisitorNameWithFallback(visitor);
	const presence = useVisitorPresenceById(visitor?.id);

	return (
		<div className={cn("flex w-full gap-2", "flex-row")}>
			<MessageGroupAvatar className="flex flex-shrink-0 flex-col justify-end">
				<Avatar
					className="size-7"
					fallbackName={visitorName}
					lastOnlineAt={presence?.lastSeenAt ?? visitor?.lastSeenAt}
					status={presence?.status}
					url={visitor?.contact?.image}
					withBoringAvatar
				/>
			</MessageGroupAvatar>
			<MessageGroupContent className={cn("flex flex-col gap-0")}>
				<MessageGroupHeader className="mb-2 px-1 text-muted-foreground text-xs opacity-50">
					{visitorName} live typing
				</MessageGroupHeader>

				<motion.div className="relative" key="typing-indicator-visitor">
					<div
						className={cn(
							"block max-w-full rounded-lg rounded-bl-[2px] bg-background-300 px-3 py-2 text-foreground text-sm md:w-max md:max-w-[420px] dark:bg-background-600"
						)}
					>
						{preview && preview.length < 4 ? (
							<BouncingDots />
						) : (
							<span className="text-primary/50">
								{preview as string}
								<BouncingDots className="ml-2 opacity-50" />
							</span>
						)}
					</div>
				</motion.div>
			</MessageGroupContent>
		</div>
	);
};

export const TypingIndicator = React.forwardRef<
	HTMLDivElement,
	TypingIndicatorProps
>(
	(
		{
			activeTypingEntities,
			availableAIAgents = [],
			availableHumanAgents = [],
			withAvatars = true,
			className,
			visitor,
			...props
		},
		ref
	) => {
		if (!activeTypingEntities || activeTypingEntities.length === 0) {
			return null;
		}

		// Separate AI and human participants
		// const humanParticipantIds = activeTypingEntities
		//   .filter((p) => p.type === "team_member")
		//   .map((p) => p.id);

		// const aiParticipantIds = activeTypingEntities
		//   .filter((p) => p.type === "ai")
		//   .map((p) => p.id);

		// Get matching agents
		// const typingHumanAgents = availableHumanAgents.filter((agent) =>
		//   humanParticipantIds.includes(agent.id)
		// );

		// const typingAIAgents = availableAIAgents.filter((agent) =>
		//   aiParticipantIds.includes(agent.id)
		// );

		const typingVisitorEntity = activeTypingEntities.find(
			(entity) => entity.id === visitor?.id
		);

		// Convert to protagonists format for AvatarStack
		// const protagonists = [
		//   ...typingHumanAgents.map((agent) => ({
		//     id: agent.id,
		//     name: agent.name,
		//     image: agent.image ?? null,
		//     lastSeenAt: agent.lastSeenAt ?? null,
		//     type: "human" as const,
		//   })),
		//   ...typingAIAgents.map((agent) => ({
		//     id: agent.id,
		//     name: agent.name,
		//     image: null,
		//     lastSeenAt: null,
		//     type: "ai" as const,
		//   })),
		// ];

		return (
			<>
				{typingVisitorEntity && (
					<VisitorTypingPreview
						preview={typingVisitorEntity.preview}
						visitor={visitor}
					/>
				)}
				{/* <div
          className={cn("flex items-center gap-6", className)}
          ref={ref}
          {...props}
        >
          <BouncingDots />
        </div> */}
			</>
		);
	}
);

TypingIndicator.displayName = "TypingIndicator";
