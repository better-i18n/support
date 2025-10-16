import type { RouterOutputs } from "@api/trpc/types";
import {
	MessageGroupAvatar,
	MessageGroupContent,
	MessageGroupHeader,
	MessageGroup as PrimitiveMessageGroup,
} from "@cossistant/next/primitives";
import type {
	AvailableAIAgent,
	Message as MessageType,
} from "@cossistant/types";
import { SenderType } from "@cossistant/types";
import { motion } from "motion/react";
import type React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import type { ConversationHeader } from "@/contexts/inboxes";
import { useVisitorPresenceById } from "@/contexts/visitor-presence";
import { cn } from "@/lib/utils";
import { getVisitorNameWithFallback } from "@/lib/visitors";
import { Message } from "./message";
import { ReadIndicator } from "./read-indicator";

const MESSAGE_ANIMATION = {
	initial: { opacity: 0, y: 6 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0 },
	transition: {
		duration: 0.1,
		ease: [0.25, 0.46, 0.45, 0.94] as const, // easeOutCubic
	},
} as const;

type Props = {
	messages: MessageType[];
	availableAIAgents: AvailableAIAgent[];
	teamMembers: RouterOutputs["user"]["getWebsiteMembers"];
	lastReadMessageIds?: Map<string, string>; // Map of userId -> lastMessageId they read
	currentUserId?: string;
	visitor: ConversationHeader["visitor"];
};

export function MessageGroup({
	messages,
	availableAIAgents,
	teamMembers,
	lastReadMessageIds,
	currentUserId,
	visitor,
}: Props) {
	// Get agent info for the sender
	const firstMessage = messages[0];
	const humanAgent = teamMembers.find(
		(agent) => agent.id === firstMessage?.userId
	);
	const aiAgent = availableAIAgents.find(
		(agent) => agent.id === firstMessage?.aiAgentId
	);
	const visitorName = getVisitorNameWithFallback(visitor);
	const visitorPresence = useVisitorPresenceById(visitor?.id);

	if (messages.length === 0) {
		return null;
	}

	// Extract who has read up to the last message
	const readByIds: string[] = [];

	if (lastReadMessageIds) {
		lastReadMessageIds.forEach((messageId, userId) => {
			// Check if this user has read up to or past the last message in this group
			const messageIndex = messages.findIndex((m) => m.id === messageId);
			const lastIndex = messages.length - 1;
			if (messageIndex >= lastIndex) {
				readByIds.push(userId);
			}
		});
	}

	return (
		<PrimitiveMessageGroup
			lastReadMessageIds={lastReadMessageIds}
			messages={messages}
			seenByIds={readByIds}
			viewerId={currentUserId}
			viewerType={SenderType.TEAM_MEMBER}
		>
			{({
				isSentByViewer,
				isReceivedByViewer,
				isVisitor,
				isAI,
				isTeamMember,
			}) => (
				<div
					className={cn(
						"flex w-full gap-2",
						// From dashboard POV: visitor messages are received (left side)
						// Team member/AI messages sent by viewer are on right side
						isSentByViewer && "flex-row-reverse",
						isReceivedByViewer && "flex-row"
					)}
				>
					{/* Avatar - only show for received messages */}
					{isReceivedByViewer && (
						<MessageGroupAvatar className="flex flex-shrink-0 flex-col justify-end">
							{isVisitor ? (
								<Avatar
									className="size-7"
									fallbackName={visitorName}
									lastOnlineAt={
										visitorPresence?.lastSeenAt ?? visitor?.lastSeenAt
									}
									status={visitorPresence?.status}
									url={visitor?.contact?.image}
									withBoringAvatar
								/>
							) : isAI ? (
								<div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
									<Logo className="h-5 w-5 text-primary" />
								</div>
							) : (
								<Avatar
									className="size-7"
									fallbackName={humanAgent?.name || "Team"}
									lastOnlineAt={humanAgent?.lastSeenAt}
									url={humanAgent?.image}
								/>
							)}
						</MessageGroupAvatar>
					)}

					<MessageGroupContent
						className={cn("flex flex-col gap-0", isSentByViewer && "items-end")}
					>
						{/* Header - show sender name for received messages */}
						{isReceivedByViewer && (
							<MessageGroupHeader className="mb-2 px-1 text-muted-foreground text-xs">
								{isVisitor
									? visitorName
									: isAI
										? aiAgent?.name || "AI Assistant"
										: humanAgent?.name ||
											humanAgent?.email?.split("@")[0] ||
											"Unknown member"}
							</MessageGroupHeader>
						)}

						{/* Messages with read indicators */}
						{messages.map((message, index) => (
							<motion.div
								className="relative"
								key={message.id}
								{...MESSAGE_ANIMATION}
							>
								<Message
									isLast={index === messages.length - 1}
									isSentByViewer={isSentByViewer}
									message={message}
								/>
								{/* Show read indicator where users stopped reading */}
								<ReadIndicator
									availableAIAgents={availableAIAgents}
									currentUserId={currentUserId}
									firstMessage={firstMessage}
									isSentByViewer={isSentByViewer}
									lastReadMessageIds={lastReadMessageIds}
									messageId={message.id}
									messages={messages}
									teamMembers={teamMembers}
									visitor={visitor}
								/>
							</motion.div>
						))}
					</MessageGroupContent>
				</div>
			)}
		</PrimitiveMessageGroup>
	);
}
