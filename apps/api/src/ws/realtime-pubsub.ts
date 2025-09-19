import { env } from "@api/env";
import {
	isValidEventType,
	type RealtimeEvent,
	validateRealtimeEvent,
} from "@cossistant/types/realtime-events";
import { Redis } from "@upstash/redis";
import type { DispatchOptions } from "./router";

const REALTIME_CHANNEL = "realtime:dispatch";
const MAX_PUBLISH_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 100;

const redisConfig = {
	url: env.UPSTASH_REDIS_REST_URL,
	token: env.UPSTASH_REDIS_REST_TOKEN,
	keepAlive: true,
} as const;

const publisher = new Redis(redisConfig);
const subscriberClient = new Redis(redisConfig);

const instanceId = `api-${process.pid ?? "pid"}-${Math.random()
	.toString(36)
	.slice(2, 10)}`;

type SubscriberInstance = ReturnType<typeof subscriberClient.subscribe>;

type DispatchTarget =
	| {
			type: "connection";
			id: string;
	  }
	| {
			type: "visitor" | "website";
			id: string;
			exclude?: string[];
	  };

type DispatchEnvelope = {
	sourceId: string;
	target: DispatchTarget;
	event: RealtimeEvent;
};

type LocalDispatchers = {
	connection: (connectionId: string, event: RealtimeEvent) => void;
	visitor: (
		visitorId: string,
		event: RealtimeEvent,
		options?: DispatchOptions
	) => void;
	website: (
		websiteId: string,
		event: RealtimeEvent,
		options?: DispatchOptions
	) => void;
};

let subscriber: SubscriberInstance | null = null;
let dispatchersRef: LocalDispatchers | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function normalizeExclude(options?: DispatchOptions): string[] | undefined {
	if (!options?.exclude) {
		return;
	}

	return Array.isArray(options.exclude) ? options.exclude : [options.exclude];
}

function scheduleReconnect(): void {
	if (reconnectTimer) {
		return;
	}

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		startSubscription();
	}, 1000);
}

async function teardownSubscriber(): Promise<void> {
	const activeSubscriber = subscriber;
	subscriber = null;
	if (!activeSubscriber) {
		return;
	}

	try {
		await activeSubscriber.unsubscribe();
	} catch (error) {
		console.error("[RealtimePubSub] Failed to unsubscribe from Redis:", error);
	}
}

function handleEnvelope(envelope: DispatchEnvelope | undefined): void {
	if (!envelope) {
		return;
	}

	const dispatchers = dispatchersRef;
	if (!dispatchers) {
		return;
	}

	const { event, target } = envelope;

	if (!isValidEventType(event.type)) {
		console.error("[RealtimePubSub] Ignoring invalid event type", event.type);
		return;
	}

	try {
		validateRealtimeEvent(event.type, event.data);
	} catch (error) {
		console.error(
			"[RealtimePubSub] Ignoring event with invalid payload",
			error
		);
		return;
	}

	const exclude =
		target.type === "connection"
			? undefined
			: target.exclude?.filter(
					(value): value is string => typeof value === "string"
				);
	const options = exclude?.length
		? ({ exclude } satisfies DispatchOptions)
		: undefined;

	try {
		switch (target.type) {
			case "connection": {
				dispatchers.connection(target.id, event);
				break;
			}
			case "visitor": {
				dispatchers.visitor(target.id, event, options);
				break;
			}
			case "website": {
				dispatchers.website(target.id, event, options);
				break;
			}
			default: {
				const exhaustiveCheck: never = target;
				console.error(
					"[RealtimePubSub] Unsupported dispatch target",
					exhaustiveCheck
				);
			}
		}
	} catch (error) {
		console.error("[RealtimePubSub] Failed to dispatch realtime event", error);
	}
}

function startSubscription(): void {
	if (!dispatchersRef) {
		return;
	}

	if (subscriber) {
		return;
	}

	try {
		const nextSubscriber =
			subscriberClient.subscribe<DispatchEnvelope>(REALTIME_CHANNEL);
		nextSubscriber.on("message", ({ message }) => {
			handleEnvelope(message);
		});
		nextSubscriber.on("error", (error) => {
			console.error("[RealtimePubSub] Subscription error", error);
			teardownSubscriber()
				.catch((teardownError) => {
					console.error(
						"[RealtimePubSub] Failed to teardown subscriber after error",
						teardownError
					);
				})
				.finally(() => {
					scheduleReconnect();
				});
		});

		subscriber = nextSubscriber;
	} catch (error) {
		console.error(
			"[RealtimePubSub] Failed to subscribe to realtime channel",
			error
		);
		scheduleReconnect();
	}
}

async function publishEnvelope(
	envelope: DispatchEnvelope,
	attempt = 0
): Promise<void> {
	try {
		await publisher.publish(REALTIME_CHANNEL, JSON.stringify(envelope));
	} catch (error) {
		if (attempt >= MAX_PUBLISH_RETRIES) {
			console.error(
				"[RealtimePubSub] Failed to publish realtime event after retries",
				error
			);
			return;
		}

		const retryDelay = BASE_RETRY_DELAY_MS * 2 ** attempt;
		setTimeout(() => {
			publishEnvelope(envelope, attempt + 1).catch((retryError) => {
				console.error(
					"[RealtimePubSub] Failed to publish realtime event",
					retryError
				);
			});
		}, retryDelay);
	}
}

export function initializeRealtimePubSub(dispatchers: LocalDispatchers): void {
	dispatchersRef = dispatchers;

	startSubscription();
}

export function publishToConnection(
	connectionId: string,
	event: RealtimeEvent
): Promise<void> {
	const envelope: DispatchEnvelope = {
		sourceId: instanceId,
		target: { type: "connection", id: connectionId },
		event,
	};

	return publishEnvelope(envelope);
}

export function publishToVisitor(
	visitorId: string,
	event: RealtimeEvent,
	options?: DispatchOptions
): Promise<void> {
	const exclude = normalizeExclude(options);
	const envelope: DispatchEnvelope = {
		sourceId: instanceId,
		target: {
			type: "visitor",
			id: visitorId,
			exclude,
		},
		event,
	};

	return publishEnvelope(envelope);
}

export function publishToWebsite(
	websiteId: string,
	event: RealtimeEvent,
	options?: DispatchOptions
): Promise<void> {
	const exclude = normalizeExclude(options);
	const envelope: DispatchEnvelope = {
		sourceId: instanceId,
		target: {
			type: "website",
			id: websiteId,
			exclude,
		},
		event,
	};

	return publishEnvelope(envelope);
}
