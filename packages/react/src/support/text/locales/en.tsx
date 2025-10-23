import type { SupportLocaleMessages } from "./keys";

const en: SupportLocaleMessages = {
	"common.actions.askQuestion": "Ask us a question",
	"common.actions.attachFiles": "Attach files",
	"common.actions.removeFile": ({ variables }) =>
		`Remove ${variables.fileName}`,
	"common.brand.watermark": "We run on",
	"common.fallbacks.aiAssistant": "AI assistant",
	"common.fallbacks.cossistant": "Cossistant",
	"common.fallbacks.someone": "Someone",
	"common.fallbacks.supportTeam": "Support",
	"common.fallbacks.unknown": "Unknown",
	"common.fallbacks.you": "You",
	"common.labels.aiAgentIndicator": "AI agent",
	"common.labels.supportOnline": "Support online",
	"page.conversationHistory.showMore": ({ variables, utils }) =>
		`+${utils.formatNumber(variables.count)} more`,
	"page.conversationHistory.title": "Conversation history",
	"page.home.greeting": ({ variables, context, utils }) => {
		const period = utils.timeOfDay();
		const phrases: Record<typeof period.token, string> = {
			morning: "morning",
			afternoon: "afternoon",
			evening: "evening",
		};
		const visitorName =
			variables?.visitorName || context.visitor?.contact?.name;
		return `Good ${phrases[period.token]}${visitorName ? ` ${visitorName}` : ""}, How can we help?`;
	},
	"page.home.history.more": ({ variables, utils }) => {
		const count = variables.count;
		const noun = utils.pluralize(count, {
			one: "conversation",
			other: "conversations",
		});
		return `+ ${utils.formatNumber(count)} more ${noun}`;
	},
	"page.home.tagline": ({ variables, context, utils }) => {
		const websiteName = variables?.websiteName || context.website?.name || "";
		const formatted = websiteName
			? `${utils.titleCase(websiteName)} support`
			: "Support";
		return formatted;
	},
	"component.conversationButtonLink.fallbackTitle": "Untitled conversation",
	"component.conversationButtonLink.lastMessage.agent": ({ variables }) =>
		`${variables.name} - ${variables.time}`,
	"component.conversationButtonLink.lastMessage.visitor": ({ variables }) =>
		`You - ${variables.time}`,
	"component.conversationButtonLink.typing": ({ variables }) =>
		`${variables.name} is typing...`,
	"component.conversationEvent.assigned": ({ variables }) =>
		`${variables.actorName} assigned the conversation`,
	"component.conversationEvent.unassigned": ({ variables }) =>
		`${variables.actorName} unassigned the conversation`,
	"component.conversationEvent.default": ({ variables }) =>
		`${variables.actorName} performed an action`,
	"component.conversationEvent.participantJoined": ({ variables }) =>
		`${variables.actorName} joined the conversation`,
	"component.conversationEvent.participantLeft": ({ variables }) =>
		`${variables.actorName} left the conversation`,
	"component.conversationEvent.participantRequested": ({ variables }) =>
		`${variables.actorName} requested to join`,
	"component.conversationEvent.priorityChanged": ({ variables }) =>
		`${variables.actorName} changed the priority`,
	"component.conversationEvent.reopened": ({ variables }) =>
		`${variables.actorName} reopened the conversation`,
	"component.conversationEvent.resolved": ({ variables }) =>
		`${variables.actorName} resolved the conversation`,
	"component.conversationEvent.statusChanged": ({ variables }) =>
		`${variables.actorName} changed the status`,
	"component.conversationEvent.tagAdded": ({ variables }) =>
		`${variables.actorName} added a tag`,
	"component.conversationEvent.tagRemoved": ({ variables }) =>
		`${variables.actorName} removed a tag`,
        "component.multimodalInput.placeholder": "Type your message...",
        "component.multimodalInput.remove": ({ variables }) =>
                `Remove ${variables.fileName}`,
        "component.visitorIdentification.title": "Stay in touch",
        "component.visitorIdentification.description":
                "Leave your contact details so we can follow up if you step away.",
        "component.visitorIdentification.emailLabel": "Email address",
        "component.visitorIdentification.emailPlaceholder": "you@example.com",
        "component.visitorIdentification.nameLabel": "Name",
        "component.visitorIdentification.nameOptional": "optional",
        "component.visitorIdentification.namePlaceholder": "Jane Doe",
        "component.visitorIdentification.submit": "Continue",
        "component.visitorIdentification.error.emailRequired":
                "Please enter a valid email address.",
        "component.visitorIdentification.error.generic":
                "We couldn't save your details. Please try again.",
        "component.navigation.articles": "Articles",
        "component.navigation.home": "Home",
        "component.message.timestamp.aiIndicator": "• AI agent",
};

export default en;
