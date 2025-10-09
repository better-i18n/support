import type { RealtimeEvent } from "@cossistant/types/realtime-events";
import { realtimeStreams } from "./streams";

async function emitVisitorMessage(
        event: RealtimeEvent<"MESSAGE_CREATED">
): Promise<void> {
        if (!event.websiteId) {
                return;
        }

        await realtimeStreams
                .channel(event.websiteId)
                .visitor.MESSAGE_CREATED.emit(event);
}

async function emitDashboardMessage(
        event: RealtimeEvent<"MESSAGE_CREATED">
): Promise<void> {
        if (!event.websiteId) {
                return;
        }

        await realtimeStreams
                .channel(event.websiteId)
                .dashboard.MESSAGE_CREATED.emit(event);
}

export async function forwardMessageEventToRealtimeStreams(
        event: RealtimeEvent
): Promise<void> {
        if (event.type !== "MESSAGE_CREATED") {
                return;
        }

        await Promise.allSettled([
                emitVisitorMessage(event),
                emitDashboardMessage(event),
        ]);
}
