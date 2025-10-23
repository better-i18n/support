import type { SupportLocaleMessages } from "./keys";

const fr: SupportLocaleMessages = {
	"common.actions.askQuestion": "Posez-nous une question",
	"common.actions.attachFiles": "Joindre des fichiers",
	"common.actions.removeFile": ({ variables }) =>
		`Supprimer ${variables.fileName}`,
	"common.brand.watermark": "Propulsé par",
	"common.fallbacks.aiAssistant": "Assistant IA",
	"common.fallbacks.cossistant": "Cossistant",
	"common.fallbacks.someone": "Quelqu'un",
	"common.fallbacks.supportTeam": "Support",
	"common.fallbacks.unknown": "Inconnu",
	"common.fallbacks.you": "Vous",
	"common.labels.aiAgentIndicator": "Agent IA",
	"common.labels.supportOnline": "Support en ligne",
	"page.conversationHistory.showMore": ({ variables, utils }) =>
		`+${utils.formatNumber(variables.count)} de plus`,
	"page.conversationHistory.title": "Historique des conversations",
	"page.home.greeting": ({ variables, context, utils }) => {
		const period = utils.timeOfDay();
		const prefixes: Record<typeof period.token, string> = {
			morning: "Bonjour",
			afternoon: "Bon après-midi",
			evening: "Bonsoir",
		};
		const prefix = prefixes[period.token];
		const visitorName =
			variables?.visitorName || context.visitor?.contact?.name;
		return `${prefix}${visitorName ? ` ${visitorName}` : ""}, comment pouvons-nous vous aider ?`;
	},
	"page.home.history.more": ({ variables, utils }) => {
		const count = variables.count;
		const noun = utils.pluralize(count, {
			one: "conversation supplémentaire",
			other: "conversations supplémentaires",
		});
		return `+ ${utils.formatNumber(count)} ${noun}`;
	},
	"page.home.tagline": ({ variables, context, utils }) => {
		const websiteName = variables?.websiteName || context.website?.name || "";
		return websiteName ? `Support ${utils.titleCase(websiteName)}` : "Support";
	},
	"component.conversationButtonLink.fallbackTitle": "Conversation sans titre",
	"component.conversationButtonLink.lastMessage.agent": ({ variables }) =>
		`${variables.name} - ${variables.time}`,
	"component.conversationButtonLink.lastMessage.visitor": ({ variables }) =>
		`Vous - ${variables.time}`,
	"component.conversationButtonLink.typing": ({ variables }) =>
		`${variables.name} est en train d'écrire...`,
	"component.conversationEvent.assigned": ({ variables }) =>
		`${variables.actorName} a attribué la conversation`,
	"component.conversationEvent.unassigned": ({ variables }) =>
		`${variables.actorName} a retiré l'attribution de la conversation`,
	"component.conversationEvent.default": ({ variables }) =>
		`${variables.actorName} a effectué une action`,
	"component.conversationEvent.participantJoined": ({ variables }) =>
		`${variables.actorName} a rejoint la conversation`,
	"component.conversationEvent.participantLeft": ({ variables }) =>
		`${variables.actorName} a quitté la conversation`,
	"component.conversationEvent.participantRequested": ({ variables }) =>
		`${variables.actorName} a demandé à rejoindre`,
	"component.conversationEvent.priorityChanged": ({ variables }) =>
		`${variables.actorName} a modifié la priorité`,
	"component.conversationEvent.reopened": ({ variables }) =>
		`${variables.actorName} a rouvert la conversation`,
	"component.conversationEvent.resolved": ({ variables }) =>
		`${variables.actorName} a résolu la conversation`,
	"component.conversationEvent.statusChanged": ({ variables }) =>
		`${variables.actorName} a modifié le statut`,
	"component.conversationEvent.tagAdded": ({ variables }) =>
		`${variables.actorName} a ajouté une étiquette`,
	"component.conversationEvent.tagRemoved": ({ variables }) =>
		`${variables.actorName} a retiré une étiquette`,
        "component.multimodalInput.placeholder": "Écrivez votre message...",
        "component.multimodalInput.remove": ({ variables }) =>
                `Supprimer ${variables.fileName}`,
        "component.visitorIdentification.title": "Restez en contact",
        "component.visitorIdentification.description":
                "Laissez-nous vos coordonnées afin que nous puissions vous répondre si vous vous absentez.",
        "component.visitorIdentification.emailLabel": "Adresse e-mail",
        "component.visitorIdentification.emailPlaceholder": "vous@example.com",
        "component.visitorIdentification.nameLabel": "Nom",
        "component.visitorIdentification.nameOptional": "optionnel",
        "component.visitorIdentification.namePlaceholder": "Jean Dupont",
        "component.visitorIdentification.submit": "Continuer",
        "component.visitorIdentification.error.emailRequired":
                "Veuillez saisir une adresse e-mail valide.",
        "component.visitorIdentification.error.generic":
                "Nous n'avons pas pu enregistrer vos informations. Veuillez réessayer.",
        "component.navigation.articles": "Articles",
        "component.navigation.home": "Accueil",
        "component.message.timestamp.aiIndicator": "• Agent IA",
};

export default fr;
