import type React from "react";
import { ArticlesPage } from "./pages/articles";
import { ConversationPage } from "./pages/conversation";
import { ConversationHistoryPage } from "./pages/conversation-history";
import { HomePage } from "./pages/home";
import { useSupportNavigation } from "./store/support-store";

/**
 * Routes between different support widget pages based on navigation state.
 *
 * Each page manages its own state internally via dedicated hooks,
 * so the router simply maps navigation state to the appropriate page component.
 */
export const SupportRouter: React.FC = () => {
	const { current } = useSupportNavigation();

	switch (current.page) {
		case "HOME":
			return <HomePage />;

		case "ARTICLES":
			return <ArticlesPage />;

                case "CONVERSATION":
                        return (
                                <ConversationPage
                                        conversationId={current.params.conversationId}
                                        initialMessage={current.params.initialMessage}
                                />
                        );

		case "CONVERSATION_HISTORY":
			return <ConversationHistoryPage />;

		default: {
			return <HomePage />;
		}
	}
};
