# Inbox Analytics And Live Visitor Activity Hardening

## Goal
Make inbox analytics and live visitor activity trustworthy enough to release by moving canonical live activity ingestion to widget HTTP, keeping websocket for invalidation/fanout, and proving the end-to-end data flow with written verification evidence.

## Phases
- [completed] Phase 1: Baseline audit and repo isolation
  - Confirm current implementation shape and dirty worktree boundaries
  - Create planning files and capture initial risks
  - Exit criteria: implementation scope and pre-existing repo state documented
- [completed] Phase 2: HTTP live activity design and API contract
  - Add a dedicated visitor activity request schema and REST endpoint
  - Define server enrichment and realtime invalidation behavior
  - Exit criteria: types, endpoint contract, and websocket role are aligned
- [completed] Phase 3: Client, server, and Tinybird implementation
  - Switch widget live writes to HTTP
  - Keep PATCH visitor sync for snapshot/page_view behavior
  - Remove websocket as canonical writer for `visitor_activity_events`
  - Exit criteria: one canonical ingestion path for live activity
- [completed] Phase 4: Automated verification
  - Update API, client, dashboard, and Tinybird-facing tests
  - Run targeted tests and typechecks
  - Exit criteria: targeted suites and typechecks pass
- [completed] Phase 5: Validation evidence and sign-off notes
  - Record Tinybird CLI state, remaining risks, and manual staging matrix
  - Exit criteria: release blockers and unresolved follow-ups clearly documented

## Release Gates
- Do not release if websocket is still the canonical writer for live activity.
- Do not release if live count, list, and map are not backed by the same 5-minute logic.
- Do not release if the 2-minute live query cadence is inconsistent across presence surfaces.
- Do not release if local Tinybird CLI validation is still broken without a documented reason and mitigation.

## Errors Encountered
| Error | Status | Notes |
|---|---|---|
| `tb info` fails with `None can't be loaded` | Resolved | Root `.tinyb` now points at `./tinybird`, the invalid `tinybird/.tinyb` stub was removed, and `tb info` now resolves the correct project root |
| Frontend Tinybird requests return `The pipe 'unique_visitors' does not exist` | Resolved in repo | Root cause was `tb dev` launching from the monorepo root instead of the Tinybird project folder, so local pipes were never loaded |
| Tinybird Local is unreachable on `http://localhost:7181` in this session | Open | Current validation is blocked by local Docker/runtime availability, not by repo configuration |
| `apps/web/.next/types/validator.ts` stale errors blocked `apps/web` typecheck | Resolved | Cleared generated `.next/types` artifacts and reran `bunx tsc -p apps/web/tsconfig.json --noEmit` successfully |

## Outcome
- Canonical live visitor activity ingestion now runs through `POST /visitors/:id/activity`.
- Widget websocket no longer writes live activity; websocket remains for dashboard invalidation/fanout.
- Live count, list, and map cadence is verified at 2 minutes, with a shared 5-minute online window.
- Automated verification passed across client, API, realtime routing, Tinybird payload, and dashboard surfaces.
- Local Tinybird project discovery is now fixed, but release is still gated on manual staging validation and a live local/staging Tinybird runtime check.
