import type { ConversationSelect } from "@api/db/schema/conversation";
import { logAiPipeline } from "../../logger";
import { emitPipelineTypingStop } from "../../shared/events";

export type PrimaryTypingControls = {
	stopTyping?: () => Promise<void>;
	stopSafely: () => Promise<void>;
};

export function createPrimaryTypingControls(params: {
	allowPublicMessages: boolean;
	conversation: ConversationSelect;
	aiAgentId: string;
	conversationId: string;
}): PrimaryTypingControls {
	let hasStopped = false;

	const stopTyping = async (): Promise<void> => {
		if (!params.allowPublicMessages || hasStopped) {
			return;
		}

		hasStopped = true;
		await emitPipelineTypingStop({
			conversation: params.conversation,
			aiAgentId: params.aiAgentId,
		});
	};

	const stopSafely = async (): Promise<void> => {
		try {
			await stopTyping();
		} catch (error) {
			logAiPipeline({
				area: "primary",
				event: "typing_stop_failed",
				level: "warn",
				conversationId: params.conversationId,
				fields: {
					stage: "typing",
				},
				error,
			});
		}
	};

	if (!params.allowPublicMessages) {
		return {
			stopSafely,
		};
	}

	return {
		stopTyping,
		stopSafely,
	};
}
