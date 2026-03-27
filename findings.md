# Findings

## Current State
- The repo is dirty in many unrelated areas. Old inbox analytics globe files were deleted by the user earlier, and a replacement in-repo map now exists. Do not revert unrelated changes.
- The monorepo root is the Tinybird CLI entrypoint, but the actual Tinybird project files live under `tinybird/`. The root `.tinyb` now uses `cwd: "./tinybird"` so CLI commands resolve the correct project.
- The previous `tinybird/.tinyb` file was an invalid stub that caused `tb info` and `tb dev` from `tinybird/` to fail before any project files could load.
- The previous `tinybird/package.json` script ran `cd .. && tb dev`, which made Tinybird Local boot from the monorepo root without loading `tinybird/endpoints/*.pipe` or `tinybird/datasources/*.datasource`.
- A Tinybird Local missing-pipe error like `The pipe 'unique_visitors' does not exist` can therefore happen even when JWT auth is correct, because the local instance came up without the project.
- Canonical live activity now writes through `POST /visitors/:id/activity` with the shared `visitorActivityRequestSchema`.
- Widget/browser tracking now posts `connected`, `route_change`, `focus`, and `heartbeat` activity over HTTP from `packages/core/src/rest-client.ts`.
- Websocket clients can no longer send `visitorPresenceUpdate`; the server emits that event only after the HTTP activity write path completes.
- `PATCH /visitors/:id` already persists durable visitor snapshot data and emits both `page_view` and `page_sync` when `currentPage` is present.
- Widget/browser tracking already has a durable HTTP sync path through `packages/core/src/rest-client.ts` via `syncVisitorSnapshot`.
- Live queries already use `visitor_activity_events`, 5-minute windows, and 2-minute refetch cadence in the dashboard hooks.
- Dashboard realtime invalidation now explicitly refreshes visitor list, online count, and presence map when `visitorPresenceUpdate` is emitted from the server.
- Realtime event fanout now falls back to `ctx.visitorId` when a visitor-facing event payload omits `visitorId`, which fixes an existing routing gap for `conversationSeen`, `conversationTyping`, and `conversationEventCreated`.
- `LiveVisitorActivity` is the companion live list only; the map remains the separate `LivePresenceGlobe` surface.

## Risk Inventory
- Geo is currently only guaranteed when the server has recent visitor snapshot data to enrich from.
- Manual Tinybird local verification is no longer blocked by CLI project discovery, but it still depends on a running Docker/Tinybird Local runtime.
- Manual staging validation still has to be executed before treating this area as release-ready.
- Because the repo is dirty, verification must focus on touched files and avoid accidental regressions in unrelated areas.
- `apps/web` typecheck depends on generated `.next/types`; stale generated files can produce unrelated validator errors and should be cleared before treating a failure here as source-level breakage.
- Tinybird Local auth can drift because `/tokens` rotate per running local workspace. The local source of truth should be `http://localhost:7181/tokens`, not a stale copied value from an earlier run.

## Metric Inventory
- `conversation_started`: required denominator for resolution score and must come from `conversation_metrics` / Tinybird `inbox_analytics`.
- `unique_visitors`: must come from `visitor_events.page_view`, not presence.
- Live count/list/map: must come from `visitor_activity_events`, visitor-only, using the same 5-minute online semantics.

## Live Activity Inventory
- Canonical producer target: widget HTTP endpoint.
- Realtime role target: dashboard invalidation/fanout only.
- Enrichment target: server attaches last-known geo from visitor record before writing `visitor_activity_events`.
- Request contract: `sessionId`, `activityType`, `attribution`, `currentPage`, and optional `occurredAt`.
- Query cadence: visitor list, online count, and presence map all refresh every 2 minutes.
- Online semantics: all live surfaces use a 5-minute online window.
