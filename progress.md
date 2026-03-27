# Progress Log

## 2026-03-26
- Initialized file-based execution workflow for inbox analytics/live activity hardening.
- Ran session catchup script from the planning-with-files skill.
- Confirmed no prior `task_plan.md`, `findings.md`, or `progress.md` existed.
- Captured current dirty worktree status and verified this area must avoid touching unrelated changes.
- Confirmed initial mismatch with approved plan: websocket was still the canonical live activity writer.
- Confirmed current dashboard query state: live queries already point at `visitor_activity_events`, use a 5-minute window, and refresh every 2 minutes.
- Added `visitorActivityRequestSchema` / `visitorActivityResponseSchema` to `packages/types/src/api/visitor.ts`.
- Added canonical `POST /visitors/:id/activity` ingestion to `apps/api/src/rest/routers/visitor.ts` with server-side geo reuse, Tinybird `trackVisitorActivity`, `markVisitorPresence`, and post-persistence `realtime.emit("visitorPresenceUpdate")`.
- Switched widget live activity writes in `packages/core/src/rest-client.ts` to HTTP for `connected`, `route_change`, `focus`, and `heartbeat`.
- Removed websocket as a client write path for `visitorPresenceUpdate` in `apps/api/src/ws/socket.ts` and `apps/api/src/ws/router.ts`.
- Added a router dispatch fallback to `ctx.visitorId` in `apps/api/src/ws/router.ts` after tests exposed missing visitor fanout for some visitor-facing events.
- Added or updated tests for:
  - widget HTTP activity lifecycle in `packages/core/src/rest-client.test.ts`
  - live activity endpoint enrichment/invalidation in `apps/api/src/rest/routers/visitor.test.ts`
  - visitor presence routing in `apps/api/src/ws/router.test.ts`
  - 2-minute live query cadence in `apps/web/src/data/live-presence-query-cadence.test.tsx`
  - dashboard invalidation on `visitorPresenceUpdate` in `apps/web/src/app/(dashboard)/[websiteSlug]/providers/realtime.test.tsx`
- Cleaned stale generated `apps/web/.next/types` artifacts after they caused unrelated validator errors during `apps/web` typecheck.
- Automated verification completed:
  - `bun test packages/core/src/rest-client.test.ts apps/api/src/lib/tinybird-sdk.test.ts apps/api/src/rest/routers/visitor.test.ts apps/api/src/ws/router.test.ts apps/api/src/ws/socket.test.ts apps/web/src/data/use-inbox-analytics.test.ts apps/web/src/data/use-visitor-presence.test.ts apps/web/src/data/live-presence-query-cadence.test.tsx apps/web/src/components/inbox-analytics/inbox-analytics-display.test.tsx apps/web/src/components/inbox-analytics/live-presence-globe.test.tsx apps/web/src/components/inbox-analytics/live-visitor-activity.test.tsx apps/web/src/components/conversations-list/index.test.tsx apps/web/src/app/'(dashboard)'/'[websiteSlug]'/providers/realtime.test.tsx apps/web/src/app/'(dashboard)'/'[websiteSlug]'/overlays/detail-page-overlay.test.tsx` -> 55 pass / 0 fail
  - `bunx tsc -p packages/core/tsconfig.json --noEmit` -> pass
  - `bunx tsc -p packages/react/tsconfig.json --noEmit` -> pass
  - `bunx tsc -p apps/api/tsconfig.json --noEmit` -> pass
  - `bunx tsc -p apps/web/tsconfig.json --noEmit` -> pass
- Tinybird CLI status:
  - `tb info` in `tinybird/` still fails with `None can't be loaded, remove it and run the command again` and `Expecting value: line 1 column 1 (char 0)`.
- Remaining release blockers:
  - manual staging matrix has not been executed in this session
  - local Tinybird CLI validation is still broken

## 2026-03-27
- Investigated new Tinybird Local frontend failures after the analytics hardening landed.
- Confirmed JWT auth had progressed from signature failures to missing-pipe failures, which narrowed the issue from auth drift to local project loading.
- Confirmed `tb info` at repo root was loading `/Users/anthonyriera/code/cossistant-monorepo/.tinyb` and treating the monorepo root as the project, while `tinybird/.tinyb` was an invalid comment-only file that broke `tb info` inside `tinybird/`.
- Updated `/Users/anthonyriera/code/cossistant-monorepo/.tinyb` to include `cwd: "./tinybird"` so Tinybird CLI resolves the real project folder.
- Removed the invalid `/Users/anthonyriera/code/cossistant-monorepo/tinybird/.tinyb` stub.
- Updated `/Users/anthonyriera/code/cossistant-monorepo/tinybird/package.json` so the workspace `dev` script runs `tb dev` directly from `tinybird/` instead of `cd .. && tb dev`.
- Added `/Users/anthonyriera/code/cossistant-monorepo/scripts/tinybird-local-env.sh` to print `TINYBIRD_TOKEN`, `TINYBIRD_SIGNING_KEY`, and `TINYBIRD_WORKSPACE` from the live Tinybird Local `/tokens` endpoint.
- Updated Tinybird local setup docs in `/Users/anthonyriera/code/cossistant-monorepo/tinybird/README.md`, `/Users/anthonyriera/code/cossistant-monorepo/.env.example`, and `/Users/anthonyriera/code/cossistant-monorepo/apps/api/.env.default` to point developers at the local `/tokens` source of truth.
- Validation:
  - `cd tinybird && tb info` -> pass for project discovery; now resolves `.tinyb` at repo root and `project: /Users/anthonyriera/code/cossistant-monorepo/tinybird`
  - `bunx tsc -p apps/api/tsconfig.json --noEmit` -> pass
  - `curl -sS http://localhost:7181/tokens` -> failed in this session because Tinybird Local was not reachable
  - `cd tinybird && tb build` -> blocked by missing Docker/Tinybird Local runtime in this session
