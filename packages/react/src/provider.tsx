import type { CossistantClient } from "@cossistant/core";
import { normalizeLocale } from "@cossistant/core";
import type { DefaultMessage, PublicWebsiteResponse } from "@cossistant/types";
import React from "react";
import { useWebsiteStore } from "./hooks/private/store/use-website-store";
import { useClient } from "./hooks/private/use-rest-client";
import { WebSocketProvider } from "./support";

export type SupportProviderProps = {
	children: React.ReactNode;
	defaultOpen?: boolean;
	apiUrl?: string;
	wsUrl?: string;
	publicKey?: string;
	defaultMessages?: DefaultMessage[];
	quickOptions?: string[];
	autoConnect?: boolean;
	onWsConnect?: () => void;
	onWsDisconnect?: () => void;
	onWsError?: (error: Error) => void;
};

export type CossistantProviderProps = SupportProviderProps;

export type CossistantContextValue = {
        website: PublicWebsiteResponse | null;
        defaultMessages: DefaultMessage[];
        quickOptions: string[];
        setDefaultMessages: (messages: DefaultMessage[]) => void;
        setQuickOptions: (options: string[]) => void;
        unreadCount: number;
        setUnreadCount: (count: number) => void;
        isLoading: boolean;
        error: Error | null;
        client: CossistantClient;
};

type WebsiteData = NonNullable<CossistantContextValue["website"]>;

type VisitorWithLocale = WebsiteData["visitor"] extends null | undefined
	? undefined
	: NonNullable<WebsiteData["visitor"]> & { locale: string | null };

export type UseSupportValue = CossistantContextValue & {
	availableHumanAgents: NonNullable<WebsiteData["availableHumanAgents"]> | [];
	availableAIAgents: NonNullable<WebsiteData["availableAIAgents"]> | [];
	visitor?: VisitorWithLocale;
};

const SupportContext = React.createContext<CossistantContextValue | undefined>(
        undefined
);

function createUnavailableClient(error: Error): CossistantClient {
        const fallbackError = error;

        return new Proxy(
                {},
                {
                        get() {
                                throw fallbackError;
                        },
                }
        ) as CossistantClient;
}

type SupportProviderWithClientProps = SupportProviderProps & {
        client: CossistantClient;
        clientError: Error | null;
        defaultMessagesState: DefaultMessage[];
        quickOptionsState: string[];
        setDefaultMessages: (messages: DefaultMessage[]) => void;
        setQuickOptions: (options: string[]) => void;
        unreadCount: number;
        setUnreadCount: (count: number) => void;
};

function SupportProviderWithClient({
        children,
        client,
        clientError,
        autoConnect,
        onWsConnect,
        onWsDisconnect,
        onWsError,
        publicKey,
        wsUrl,
        defaultMessagesState,
        quickOptionsState,
        setDefaultMessages,
        setQuickOptions,
        unreadCount,
        setUnreadCount,
}: SupportProviderWithClientProps) {
        const { website, isLoading, error: websiteError } = useWebsiteStore(client);

        React.useEffect(() => {
                if (website) {
                        // @ts-expect-error internal priming: safe in our library context
                        client.restClient?.setWebsiteContext?.(website.id, website.visitor?.id);
                }
        }, [client, website]);

        const error = clientError ?? websiteError;

        const value = React.useMemo<CossistantContextValue>(
                () => ({
                        website,
                        unreadCount,
                        setUnreadCount,
                        isLoading,
                        error,
                        client,
                        defaultMessages: defaultMessagesState,
                        setDefaultMessages,
                        quickOptions: quickOptionsState,
                        setQuickOptions,
                }),
                [
                        website,
                        unreadCount,
                        isLoading,
                        error,
                        client,
                        defaultMessagesState,
                        quickOptionsState,
                        setDefaultMessages,
                        setQuickOptions,
                        setUnreadCount,
                ]
        );

        return (
                <SupportContext.Provider value={value}>
                        <WebSocketProvider
                                autoConnect={autoConnect}
                                onConnect={onWsConnect}
                                onDisconnect={onWsDisconnect}
                                onError={onWsError}
                                publicKey={publicKey}
                                visitorId={website?.visitor?.id}
                                websiteId={website?.id}
                                wsUrl={wsUrl}
                        >
                                {children}
                        </WebSocketProvider>
                </SupportContext.Provider>
        );
}

/**
 * Internal implementation that wires the REST client and websocket provider
 * together before exposing the combined context.
 */
function SupportProviderInner({
	children,
	apiUrl,
	wsUrl,
	publicKey,
	defaultMessages,
	quickOptions,
	autoConnect,
	onWsConnect,
	onWsDisconnect,
	onWsError,
}: SupportProviderProps) {
	const [unreadCount, setUnreadCount] = React.useState(0);
	const [_defaultMessages, _setDefaultMessages] = React.useState<
		DefaultMessage[]
	>(defaultMessages || []);
	const [_quickOptions, _setQuickOptions] = React.useState<string[]>(
		quickOptions || []
	);
	// Update state when props change (for initial values from provider)
	React.useEffect(() => {
		if (defaultMessages && defaultMessages.length > 0) {
			_setDefaultMessages(defaultMessages);
		}
	}, [defaultMessages]);

	React.useEffect(() => {
		if (quickOptions && quickOptions.length > 0) {
			_setQuickOptions(quickOptions);
		}
	}, [quickOptions]);

        const { client, error: clientError } = useClient(publicKey, apiUrl, wsUrl);

        const setDefaultMessages = React.useCallback(
                (messages: DefaultMessage[]) => _setDefaultMessages(messages),
                []
        );

        const setQuickOptions = React.useCallback(
                (options: string[]) => _setQuickOptions(options),
                []
        );

        const setUnreadCountStable = React.useCallback(
                (count: number) => setUnreadCount(count),
                []
        );

        const fallbackError = React.useMemo(
                () =>
                        clientError ??
                        new Error(
                                "Public key is required. Please provide it as a prop or set NEXT_PUBLIC_COSSISTANT_KEY environment variable."
                        ),
                [clientError]
        );

        const unavailableClient = React.useMemo(
                () => createUnavailableClient(fallbackError),
                [fallbackError]
        );

        if (!client) {
                const value = React.useMemo<CossistantContextValue>(
                        () => ({
                                website: null,
                                unreadCount,
                                setUnreadCount: setUnreadCountStable,
                                isLoading: false,
                                error: fallbackError,
                                client: unavailableClient,
                                defaultMessages: _defaultMessages,
                                setDefaultMessages,
                                quickOptions: _quickOptions,
                                setQuickOptions,
                        }),
                        [
                                unreadCount,
                                setUnreadCountStable,
                                fallbackError,
                                unavailableClient,
                                _defaultMessages,
                                _quickOptions,
                                setDefaultMessages,
                                setQuickOptions,
                        ]
                );

                return (
                        <SupportContext.Provider value={value}>
                                {children}
                        </SupportContext.Provider>
                );
        }

        return (
                <SupportProviderWithClient
                        autoConnect={autoConnect}
                        client={client}
                        clientError={clientError}
                        defaultMessagesState={_defaultMessages}
                        onWsConnect={onWsConnect}
                        onWsDisconnect={onWsDisconnect}
                        onWsError={onWsError}
                        publicKey={publicKey}
                        quickOptionsState={_quickOptions}
                        setDefaultMessages={setDefaultMessages}
                        setQuickOptions={setQuickOptions}
                        setUnreadCount={setUnreadCountStable}
                        unreadCount={unreadCount}
                        wsUrl={wsUrl}
                >
                        {children}
                </SupportProviderWithClient>
        );
}

/**
 * Hosts the entire customer support widget ecosystem by handing out context
 * about the current website, visitor, unread counts, realtime subscriptions
 * and the REST client. Provide your Cossistant public key plus optional
 * defaults to configure the widget behaviour.
 */
export function SupportProvider({
	children,
	apiUrl = "https://api.cossistant.com/v1",
	wsUrl = "wss://api.cossistant.com/ws",
	publicKey,
	defaultMessages,
	quickOptions,
	autoConnect = true,
	onWsConnect,
	onWsDisconnect,
	onWsError,
}: SupportProviderProps): React.ReactElement {
	return (
		<SupportProviderInner
			apiUrl={apiUrl}
			autoConnect={autoConnect}
			defaultMessages={defaultMessages}
			onWsConnect={onWsConnect}
			onWsDisconnect={onWsDisconnect}
			onWsError={onWsError}
			publicKey={publicKey}
			quickOptions={quickOptions}
			wsUrl={wsUrl}
		>
			{children}
		</SupportProviderInner>
	);
}

/**
 * Convenience hook that exposes the aggregated support context. Throws when it
 * is consumed outside of `SupportProvider` to catch integration mistakes.
 */
export function useSupport(): UseSupportValue {
	const context = React.useContext(SupportContext);
	if (!context) {
		throw new Error(
			"useSupport must be used within a cossistant SupportProvider"
		);
	}

	const availableHumanAgents = context.website?.availableHumanAgents || [];
	const availableAIAgents = context.website?.availableAIAgents || [];
	const visitorLanguage = context.website?.visitor?.language || null;

	// Create visitor object with normalized locale
	const visitor = context.website?.visitor
		? {
				...context.website.visitor,
				locale: normalizeLocale(visitorLanguage),
			}
		: undefined;

	return {
		...context,
		availableHumanAgents,
		availableAIAgents,
		visitor,
	};
}
