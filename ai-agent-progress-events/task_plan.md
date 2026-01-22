# Task Plan: AI Agent Progress Events & Multi-Party Context

## Goal
1. Implement comprehensive progress events for AI agent workflows with dashboard/widget visibility differentiation
2. **Implement strict multi-party conversation context with security safeguards**

## Status: ✅ COMPLETED

---

## Phases

- [x] Phase 1: Research & Design ✓
- [x] **Phase 2: Multi-Party Context & Security** ✓
  - [x] 2a: Implement message prefix protocol (modify `3-generation.ts`)
  - [x] 2b: Create security prompt templates (new `prompts/security.ts`)
  - [x] 2c: Update `system.ts` with layered prompt architecture
  - [x] 2d: Create prompt injection detection (new `analysis/injection.ts`)
- [x] Phase 3: Progress Events ✓
  - [x] 3a: Update event schemas (`realtime-events.ts`)
  - [x] 3b: Create event emission helpers (`events/*.ts`)
  - [x] 3c: Integrate events into pipeline
  - [x] 3d: Update WebSocket router with audience filtering
  - [x] 3e: Update worker with workflow started event

---

## Summary of Changes

### Phase 2: Multi-Party Context & Security

**Message Prefix Protocol** (`3-generation.ts`):
```typescript
// AI SDK message format preserved, content prefixed:
{ role: "user", content: "[VISITOR] How do I reset my password?" }
{ role: "user", content: "[VISITOR:John] I bought the pro plan" }
{ role: "assistant", content: "[TEAM:Sarah] Let me help you" }
{ role: "assistant", content: "[PRIVATE][TEAM:Sarah] Check billing" }
{ role: "assistant", content: "[AI] I can help with that!" }
```

**Security Prompt** (`prompts/security.ts`):
- Core security prompt (always first in system prompt)
- Multi-party conversation explanation
- Private information protection rules
- Prompt injection detection instructions
- Security reminder (always last)

**Layered Prompt Architecture** (`prompts/system.ts`):
```
Layer 0: Core Security (immutable)
Layer 1: Base Prompt (aiAgent.basePrompt)
Layer 2: Dynamic Context (visitor, tools, behavior)
Layer 3: Security Reminder (immutable)
```

**Injection Detection** (`analysis/injection.ts`):
- Pattern-based detection for common attacks
- Logging for monitoring
- AI handles via escalation instructions

### Phase 3: Progress Events

**Updated Event Schemas** (`realtime-events.ts`):
- Added `audience: 'all' | 'dashboard'` field
- Added `aiAgentDecisionMade` event
- Added `workflowRunId` to all AI agent events
- Added `status: 'skipped' | 'cancelled'` options

**Event Emission Helpers** (`events/*.ts`):
- `emitWorkflowStarted()` - Dashboard only
- `emitDecisionMade()` - Dashboard always, Widget only if shouldAct
- `emitToolProgress()` - Both (with user-friendly messages)
- `emitWorkflowCompleted()` - Both or Dashboard only depending on status
- `emitWorkflowCancelled()` - Dashboard only

**Pipeline Integration** (`pipeline/index.ts`):
- Decision events after step 2
- Completion events after step 4
- Cancelled events on supersede

**WebSocket Router** (`router.ts`):
- Added audience filtering in `dispatchEvent()`
- Events with `audience: 'dashboard'` not sent to visitors

**Worker** (`worker.ts`):
- Emits `aiAgentProcessingStarted` before pipeline

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/ai-agent/prompts/security.ts` | Core security prompts |
| `apps/api/src/ai-agent/analysis/injection.ts` | Injection detection |
| `apps/api/src/ai-agent/events/progress.ts` | Progress events |
| `apps/api/src/ai-agent/events/workflow.ts` | Workflow events |
| `apps/api/src/ai-agent/events/decision.ts` | Decision events |

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/ai-agent/pipeline/3-generation.ts` | Message prefix protocol |
| `apps/api/src/ai-agent/prompts/system.ts` | Layered architecture |
| `apps/api/src/ai-agent/prompts/index.ts` | Export security prompts |
| `apps/api/src/ai-agent/analysis/index.ts` | Export injection detection |
| `apps/api/src/ai-agent/events/index.ts` | Export new emitters |
| `packages/types/src/realtime-events.ts` | Add audience field, new events |
| `apps/api/src/ws/router.ts` | Audience filtering |
| `apps/api/src/ai-agent/pipeline/index.ts` | Integrate events |
| `apps/workers/src/queues/ai-agent/worker.ts` | Workflow started |

---

## Event Visibility Matrix

| Event | Widget | Dashboard |
|-------|--------|-----------|
| `conversationSeen` | ✅ | ✅ |
| `aiAgentProcessingStarted` | ❌ | ✅ |
| `aiAgentDecisionMade` (shouldAct=false) | ❌ | ✅ |
| `aiAgentDecisionMade` (shouldAct=true) | ✅ | ✅ |
| `conversationTyping` | ✅ | ✅ |
| `aiAgentProcessingProgress` (tool) | ✅ | ✅ |
| `aiAgentProcessingCompleted` (success) | ✅ | ✅ |
| `aiAgentProcessingCompleted` (skipped/cancelled) | ❌ | ✅ |
| `timelineItemCreated` | ✅ | ✅ |
