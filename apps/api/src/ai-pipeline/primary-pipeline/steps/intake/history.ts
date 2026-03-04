import type { Database } from "@api/db";
import { getConversationTimelineItems } from "@api/db/queries/conversation";
import {
	ConversationTimelineType,
	TimelineItemVisibility,
} from "@cossistant/types";
import type { RoleAwareMessage, SenderType } from "../../contracts";

const MAX_CONTEXT_MESSAGES = 30;

type BuildHistoryParams = {
	conversationId: string;
	organizationId: string;
	websiteId: string;
	maxCreatedAt?: string | null;
	maxId?: string | null;
};

function mapSenderType(item: {
	visitorId: string | null;
	userId: string | null;
	aiAgentId: string | null;
}): SenderType {
	if (item.visitorId) {
		return "visitor";
	}
	if (item.userId) {
		return "human_agent";
	}
	if (item.aiAgentId) {
		return "ai_agent";
	}
	return "visitor";
}

export async function buildRoleAwareConversationHistory(
	db: Database,
	params: BuildHistoryParams
): Promise<RoleAwareMessage[]> {
	const { items } = await getConversationTimelineItems(db, {
		organizationId: params.organizationId,
		conversationId: params.conversationId,
		websiteId: params.websiteId,
		limit: MAX_CONTEXT_MESSAGES,
		maxCreatedAt: params.maxCreatedAt ?? null,
		maxId: params.maxId ?? null,
		visibility: [TimelineItemVisibility.PUBLIC, TimelineItemVisibility.PRIVATE],
	});

	const history: RoleAwareMessage[] = [];

	for (const item of items) {
		if (item.type !== ConversationTimelineType.MESSAGE || !item.id) {
			continue;
		}

		const content = item.text ?? "";
		if (!content.trim()) {
			continue;
		}

		history.push({
			messageId: item.id,
			content,
			senderType: mapSenderType(item),
			senderId: item.userId ?? item.visitorId ?? item.aiAgentId ?? null,
			senderName: null,
			timestamp: item.createdAt,
			visibility:
				item.visibility === TimelineItemVisibility.PUBLIC
					? "public"
					: "private",
		});
	}

	return history;
}
