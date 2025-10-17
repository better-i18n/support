import { DEFAULT_PAGE_LIMIT } from "@api/constants";
import type { Database } from "@api/db";
import { conversationEvent, message } from "@api/db/schema";
import { and, desc, eq, lt, or } from "drizzle-orm";

const TIMELINE_TYPE_PRIORITY = {
        message: 2,
        event: 1,
} as const;

type TimelineType = keyof typeof TIMELINE_TYPE_PRIORITY;

type TimelineCursor = {
        timestamp: Date;
        type: TimelineType;
        id: string;
};

type TimelineMessageEntry = {
        type: "message";
        createdAt: Date;
        id: string;
        message: typeof message.$inferSelect;
};

type TimelineEventEntry = {
        type: "event";
        createdAt: Date;
        id: string;
        event: typeof conversationEvent.$inferSelect;
};

type TimelineEntry = TimelineMessageEntry | TimelineEventEntry;

function parseCursor(cursor: string | null | undefined): TimelineCursor | null {
        if (!cursor) {
                return null;
        }

        const parts = cursor.split("_");

        if (parts.length < 3) {
                return null;
        }

        const [timestampPart, typePart, idPart] = parts;
        const timestamp = new Date(timestampPart);

        if (Number.isNaN(timestamp.getTime())) {
                return null;
        }

        const type = typePart === "message" ? "message" : typePart === "event" ? "event" : null;

        if (!type) {
                return null;
        }

        if (!idPart) {
                return null;
        }

        return {
                timestamp,
                type,
                id: idPart,
        } satisfies TimelineCursor;
}

function toCursor(entry: TimelineEntry): string {
        const baseTimestamp = entry.createdAt.toISOString();
        const id = entry.type === "message" ? entry.message.id : entry.event.id;

        return `${baseTimestamp}_${entry.type}_${id}`;
}

function sortEntries(entries: TimelineEntry[]): TimelineEntry[] {
        return [...entries].sort((a, b) => {
                const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();

                if (timeDiff !== 0) {
                        return timeDiff;
                }

                if (a.type !== b.type) {
                        return (
                                TIMELINE_TYPE_PRIORITY[b.type] - TIMELINE_TYPE_PRIORITY[a.type]
                        );
                }

                const aId = a.type === "message" ? a.message.id : a.event.id;
                const bId = b.type === "message" ? b.message.id : b.event.id;

                return bId.localeCompare(aId);
        });
}

export async function getConversationTimeline(
        db: Database,
        params: {
                conversationId: string;
                websiteId: string;
                limit?: number;
                cursor?: string | null;
        }
): Promise<{
        items: Array<
                | {
                        type: "message";
                        message: typeof message.$inferSelect;
                  }
                | {
                        type: "event";
                        event: typeof conversationEvent.$inferSelect;
                  }
        >;
        nextCursor: string | null;
}> {
        const limit = params.limit ?? DEFAULT_PAGE_LIMIT;
        const cursor = parseCursor(params.cursor ?? null);

        const baseMessageConditions = [
                eq(message.conversationId, params.conversationId),
                eq(message.websiteId, params.websiteId),
        ];

        if (cursor) {
                const iso = cursor.timestamp.toISOString();

                const olderThanCursor = lt(message.createdAt, iso);

                if (cursor.type === "message") {
                        baseMessageConditions.push(
                                or(
                                        olderThanCursor,
                                        and(eq(message.createdAt, iso), lt(message.id, cursor.id))
                                )!
                        );
                } else {
                        baseMessageConditions.push(olderThanCursor);
                }
        }

        const messageRows = await db
                .select()
                .from(message)
                .where(and(...baseMessageConditions))
                .orderBy(desc(message.createdAt), desc(message.id))
                .limit(limit + 1);

        const baseEventConditions = [eq(conversationEvent.conversationId, params.conversationId)];

        if (cursor) {
                const iso = cursor.timestamp.toISOString();

                if (cursor.type === "event") {
                        baseEventConditions.push(
                                or(
                                        lt(conversationEvent.createdAt, iso),
                                        and(
                                                eq(conversationEvent.createdAt, iso),
                                                lt(conversationEvent.id, cursor.id)
                                        )
                                )!
                        );
                } else {
                        baseEventConditions.push(
                                or(
                                        lt(conversationEvent.createdAt, iso),
                                        eq(conversationEvent.createdAt, iso)
                                )!
                        );
                }
        }

        const eventRows = await db
                .select()
                .from(conversationEvent)
                .where(and(...baseEventConditions))
                .orderBy(desc(conversationEvent.createdAt), desc(conversationEvent.id))
                .limit(limit + 1);

        const timelineEntries: TimelineEntry[] = [
                ...messageRows.map<TimelineMessageEntry>((row) => ({
                        type: "message",
                        createdAt: new Date(row.createdAt),
                        id: row.id,
                        message: row,
                })),
                ...eventRows.map<TimelineEventEntry>((row) => ({
                        type: "event",
                        createdAt: new Date(row.createdAt),
                        id: row.id,
                        event: row,
                })),
        ];

        const sortedEntries = sortEntries(timelineEntries);
        const hasMore = sortedEntries.length > limit;
        const limitedEntries = hasMore ? sortedEntries.slice(0, limit) : sortedEntries;
        const lastEntry = limitedEntries.at(-1) ?? null;

        return {
                items: limitedEntries.map((entry) =>
                        entry.type === "message"
                                ? { type: "message", message: entry.message }
                                : { type: "event", event: entry.event }
                ),
                nextCursor: hasMore && lastEntry ? toCursor(lastEntry) : null,
        };
}
