import { useEffect, useMemo, useRef } from "react";
import type { RealtimeEvent } from "@cossistant/types/realtime-events";
import { useRealtime } from "./use-realtime";

export type VisitorRealtimeEvent = RealtimeEvent<"MESSAGE_CREATED">;

type VisitorRealtimeSchema = {
  visitor: {
    MESSAGE_CREATED: VisitorRealtimeEvent;
  };
};

export type UseVisitorRealtimeOptions = {
  websiteId: string | null | undefined;
  visitorId: string | null | undefined;
  publicKey: string | null | undefined;
  endpoint?: string;
  enabled?: boolean;
  onMessageCreated?: (event: VisitorRealtimeEvent) => void;
};

export function useVisitorRealtime({
  websiteId,
  visitorId,
  publicKey,
  endpoint = "/v1/realtime/visitor",
  enabled = true,
  onMessageCreated,
}: UseVisitorRealtimeOptions) {
  const handlerRef = useRef<
    ((event: VisitorRealtimeEvent) => void) | undefined
  >(undefined);

  useEffect(() => {
    handlerRef.current = onMessageCreated;
  }, [onMessageCreated]);

  const shouldEnable =
    enabled && Boolean(websiteId && visitorId && publicKey && onMessageCreated);

  const events = useMemo(() => {
    if (!onMessageCreated) {
      return undefined;
    }

    return {
      visitor: {
        MESSAGE_CREATED: (event: VisitorRealtimeEvent) => {
          const handler = handlerRef.current;
          if (handler) {
            handler(event);
          }
        },
      },
    } satisfies VisitorEventHandlers;
  }, [onMessageCreated]);

  return useRealtime<VisitorRealtimeSchema>({
    channel: websiteId ?? undefined,
    endpoint,
    enabled: shouldEnable,
    params: {
      visitorId: visitorId ?? undefined,
      publicKey: publicKey ?? undefined,
    },
    events,
  });
}

type VisitorEventHandlers = {
  visitor: {
    MESSAGE_CREATED: (event: VisitorRealtimeEvent) => void;
  };
};
