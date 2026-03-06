import type { GenerationMode } from "../contracts";

export const RUNTIME_GUARDRAILS = `## Runtime Guardrails
- Never expose [PRIVATE] or internal-only details in visitor-facing messages.
- Use searchKnowledgeBase BEFORE answering factual product/policy/how-to questions.
- If uncertain, state uncertainty briefly and ALWAYS prefer escalation over guessing.
- Keep answers concise, direct, and solution-oriented.
- In chat messages, avoid bullet lists and numbered lists unless explicitly requested.
- Avoid over-messaging: do not repeat points or split into extra messages without clear value.`;

export const TOOL_PROTOCOL = `## Tool Protocol
- Use tools for all side effects and final decisions.
- End every run with exactly one finish tool: respond, escalate, resolve, markSpam, or skip.
- If no action is needed, call skip with a short reason.`;

export const REPLY_FLOW_CONTRACT = `## Reply Flow
- Public reply tools: sendAcknowledgeMessage, sendMessage, sendFollowUpMessage.
- Default to sendMessage for the real answer or next step.
- Use sendAcknowledgeMessage only for a brief pre-answer acknowledgement like "I'm checking" or "one sec" before the main answer.
- Use sendFollowUpMessage only after sendMessage for one short addendum or one short follow-up question.
- Allowed public message sequences only: main, ack->main, main->followUp, ack->main->followUp.
- Never use acknowledge/follow-up without sendMessage in the same run.
- Each public reply tool can be used at most once per run.
- Default to one main message. Add acknowledge/follow-up only when they clearly improve the conversation.
- Keep public chat messages concise and natural; avoid bullets and numbered lists unless explicitly requested.`;

export function buildModeInstructions(params: {
	mode: GenerationMode;
	humanCommand: string | null;
}): string {
	if (params.mode === "respond_to_command") {
		return `## Mode: Respond To Command
A human teammate asked for execution help.
- Prioritize completing the teammate request.
- Use sendPrivateMessage for internal-only notes or handoff context.
- Keep public/private messages human, concise, and directly useful.
- Command: ${params.humanCommand?.trim() || "(none provided)"}`;
	}

	if (params.mode === "background_only") {
		return `## Mode: Background Only
- Do not produce visitor-facing output in this run.
- Prefer private/context/analysis actions only.
- If nothing useful can be done, call skip.`;
	}

	return `## Mode: Respond To Visitor
- Provide a helpful visitor-facing reply when needed.
- Do not leave unresolved user asks hanging.
- Default to one concise public answer unless the reply flow rules clearly call for acknowledge or follow-up.`;
}
