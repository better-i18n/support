import type { RealtimeEvent } from "@cossistant/types/realtime-events";
import type { ServerWebSocket } from "bun";
import type { DispatchOptions } from "./router";

export type RawSocket = ServerWebSocket & { connectionId?: string };

export type LocalConnectionRecord = {
	socket: RawSocket;
	websiteId?: string;
	organizationId?: string;
	userId?: string;
	visitorId?: string;
};

export const localConnections = new Map<string, LocalConnectionRecord>();

function createExcludePredicate(
	options?: DispatchOptions
): ((connectionId: string) => boolean) | undefined {
	if (!options?.exclude) {
		return;
	}

	const excludeIds = Array.isArray(options.exclude)
		? new Set(options.exclude)
		: new Set<string>([options.exclude]);

	return (connectionId: string) => excludeIds.has(connectionId);
}

function sendEventToSocket(
	record: LocalConnectionRecord,
	serializedEvent: string
): void {
	try {
		record.socket.send(serializedEvent);
	} catch (error) {
		console.error("[WebSocket] Failed to send event:", error);
	}
}

export function dispatchEventToLocalConnection(
	connectionId: string,
	event: RealtimeEvent
): void {
	const connection = localConnections.get(connectionId);
	if (!connection) {
		return;
	}

	const serializedEvent = JSON.stringify(event);
	sendEventToSocket(connection, serializedEvent);
}

export function dispatchEventToLocalVisitor(
	visitorId: string,
	event: RealtimeEvent,
	options?: DispatchOptions
): void {
	const shouldExclude = createExcludePredicate(options);
	const serializedEvent = JSON.stringify(event);

	for (const [connectionId, connection] of localConnections) {
		if (connection.visitorId !== visitorId) {
			continue;
		}

		if (shouldExclude?.(connectionId)) {
			continue;
		}

		console.log("[WebSocket] Dispatching visitor event", {
			visitorId,
			connectionId,
			eventType: event.type,
		});
		sendEventToSocket(connection, serializedEvent);
	}
}

export function dispatchEventToLocalWebsite(
	websiteId: string,
	event: RealtimeEvent,
	options?: DispatchOptions
): void {
	const shouldExclude = createExcludePredicate(options);
	const serializedEvent = JSON.stringify(event);

	for (const [connectionId, connection] of localConnections) {
		if (connection.websiteId !== websiteId) {
			continue;
		}

		// Only dashboard/user connections should receive website events
		if (!connection.userId) {
			continue;
		}

		if (shouldExclude?.(connectionId)) {
			continue;
		}

		console.log("[WebSocket] Dispatching website event", {
			websiteId,
			connectionId,
			eventType: event.type,
		});
		sendEventToSocket(connection, serializedEvent);
	}
}
