import { useEffect, useMemo, useRef } from "react";
import type { RealtimeEvent } from "@cossistant/types/realtime-events";
import { useRealtime } from "./use-realtime";

export type DashboardRealtimeEvent = RealtimeEvent<"MESSAGE_CREATED">;

type DashboardRealtimeSchema = {
  dashboard: {
    MESSAGE_CREATED: DashboardRealtimeEvent;
  };
};

export type UseDashboardRealtimeOptions = {
  websiteId: string | null | undefined;
  endpoint?: string;
  enabled?: boolean;
  onMessageCreated?: (event: DashboardRealtimeEvent) => void;
};

export function useDashboardRealtime({
  websiteId,
  endpoint = "/v1/realtime/dashboard",
  enabled = true,
  onMessageCreated,
}: UseDashboardRealtimeOptions) {
  const handlerRef = useRef<
    ((event: DashboardRealtimeEvent) => void) | undefined
  >(undefined);

  useEffect(() => {
    handlerRef.current = onMessageCreated;
  }, [onMessageCreated]);

  const shouldEnable =
    enabled && Boolean(websiteId && onMessageCreated);

  const events = useMemo(() => {
    if (!onMessageCreated) {
      return undefined;
    }

    return {
      dashboard: {
        MESSAGE_CREATED: (event: DashboardRealtimeEvent) => {
          const handler = handlerRef.current;
          if (handler) {
            handler(event);
          }
        },
      },
    } satisfies DashboardEventHandlers;
  }, [onMessageCreated]);

  return useRealtime<DashboardRealtimeSchema>({
    channel: websiteId ?? undefined,
    endpoint,
    enabled: shouldEnable,
    events,
    params: {
      websiteId: websiteId ?? undefined,
    },
  });
}

type DashboardEventHandlers = {
  dashboard: {
    MESSAGE_CREATED: (event: DashboardRealtimeEvent) => void;
  };
};
