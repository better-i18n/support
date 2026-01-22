# Notes: AI Agent Progress Events

## Current Architecture Summary

### Pipeline Structure (apps/api/src/ai-agent/pipeline/)
The AI agent runs a 5-step pipeline orchestrated in `index.ts`:

1. **Intake** (`1-intake.ts`) - Gather context, validate agent is active
2. **Decision** (`2-decision.ts`) - Determine if/how AI should respond
3. **Generation** (`3-generation.ts`) - Call LLM with tools, get structured decision
4. **Execution** (`4-execution.ts`) - Execute chosen action (send message, escalate, etc.)
5. **Followup** (`5-followup.ts`) - Cleanup, emit events, update stats

### Current Event Emission Points

| Location | Event | When |
|----------|-------|------|
| Worker (`worker.ts:216`) | `conversationSeen` | Before pipeline starts |
| Pipeline (`index.ts:129`) | `conversationTyping` (start) | After decision.shouldAct = true |
| Pipeline (`index.ts:147,187,222`) | `conversationTyping` (stop) | After execution or superseded |

### Existing Event Types (realtime-events.ts)
Already defined but **NOT YET IMPLEMENTED**:
- `aiAgentProcessingStarted` - Has timelineItemId, phase
- `aiAgentProcessingProgress` - Has phase, message, tool info
- `aiAgentProcessingCompleted` - Has status (success/error)
- `timelineItemUpdated` - For updating existing items
- `timelineItemPartUpdated` - For granular part updates

### Decision Logic
Decision step returns:
- `shouldAct: boolean` - Whether AI should respond
- `reason: string` - Human-readable explanation
- `mode: 'respond_to_visitor' | 'respond_to_command' | 'background_only'`
- `humanCommand: string | null` - Command text if from human agent

---

## Requirements Analysis

### 1. Widget View (Visitor)
**SHOULD see:**
- AI has "seen" the message (indicator only, subtle)
- Typing indicator when AI is generating response
- Tool progress with user-friendly messages ("Searching knowledge base...")
- Final message when delivered

**SHOULD NOT see:**
- AI decided not to respond (silent)
- Internal processing details
- Reasoning/chain-of-thought
- Skip reasons
- Superseded notifications

### 2. Dashboard View (Human Agents)
**SHOULD see:**
- AI workflow started (with trigger message info)
- Decision outcome (shouldAct + reason)
- Tool invocations with full details (toolName, input, output)
- Generation progress
- Final action taken
- Workflow cancelled/superseded events
- Errors with details

---

## Event Schema Design

### New Events Needed

```typescript
// 1. AI Workflow Started - Dashboard only
aiAgentWorkflowStarted: {
  conversationId: string;
  aiAgentId: string;
  workflowRunId: string;
  triggerMessageId: string;
  phase: 'intake';
}

// 2. AI Decision Made - Dashboard always, Widget only if shouldAct
aiAgentDecisionMade: {
  conversationId: string;
  aiAgentId: string;
  workflowRunId: string;
  shouldAct: boolean;
  reason: string;
  mode: 'respond_to_visitor' | 'respond_to_command' | 'background_only';
}

// 3. AI Tool Progress - Both (different visibility)
// Already exists as aiAgentProcessingProgress, but need to enhance
// - Widget: Just the progressMessage
// - Dashboard: Full tool details

// 4. AI Workflow Completed/Cancelled
// Already exists as aiAgentProcessingCompleted
// Add: action taken, reason for completion
```

### Visibility Control Strategy

**Option A: Separate Event Types**
- `aiAgentProcessingProgress` → widget-visible
- `aiAgentProcessingProgressInternal` → dashboard-only

**Option B: Payload-based Filtering** (Recommended)
- Single event type with `audience: 'all' | 'dashboard'` field
- WebSocket router filters based on connection type
- Widget connections receive only `audience: 'all'` events

**Option C: Part of Payload**
- Events contain full details
- Widget SDK filters out internal details client-side

**Recommendation**: Option B - cleaner architecture, less client-side logic

---

## Implementation Plan

### Phase 1: Update Event Schemas (packages/types)

1. Add `audience` field to AI agent events
2. Add new event types if needed:
   - `aiAgentDecisionMade` (new)
   - `aiAgentWorkflowCancelled` (new, or use completed with status='cancelled')

### Phase 2: Create Event Emission Helpers (apps/api/src/ai-agent/events/)

New files:
- `progress.ts` - Emit aiAgentProcessingProgress events
- `decision.ts` - Emit aiAgentDecisionMade events
- `workflow.ts` - Emit start/complete/cancel events

### Phase 3: Integrate into Pipeline

| Step | Events to Emit |
|------|----------------|
| Worker start | `aiAgentWorkflowStarted` (dashboard) |
| After intake | (none - internal) |
| After decision | `aiAgentDecisionMade` (dashboard always, widget if shouldAct) |
| During generation | `aiAgentProcessingProgress` (tool calls) |
| After execution | `aiAgentProcessingCompleted` |
| Superseded | `aiAgentWorkflowCancelled` (dashboard) |

### Phase 4: Update WebSocket Router

1. Add audience filtering logic
2. Widget connections only receive:
   - `audience: 'all'` events
   - `conversationSeen` (existing)
   - `conversationTyping` (existing)
   - `timelineItemCreated` (existing)

### Phase 5: Frontend Integration (Future)

React hooks:
- `useAIProgress(conversationId)` - Track AI activity
- Update `useConversation` to include AI state

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `packages/types/src/realtime-events.ts` | Add audience field, new event types |
| `apps/api/src/ws/router.ts` | Add audience filtering logic |
| `apps/api/src/ai-agent/events/progress.ts` | New file - progress emission |
| `apps/api/src/ai-agent/events/workflow.ts` | New file - workflow lifecycle |
| `apps/api/src/ai-agent/pipeline/index.ts` | Integrate event emissions |
| `apps/api/src/ai-agent/pipeline/3-generation.ts` | Tool progress events |
| `apps/workers/src/queues/ai-agent/worker.ts` | Workflow started event |

---

## Open Questions Resolved

1. **Should we emit during intake?** No - too internal, no value for users
2. **How to handle superseded workflows?** Emit cancelled event to dashboard
3. **Timeline item ID for progress events?** Generate deterministic ULID at workflow start
4. **Tool streaming?** Use `aiAgentProcessingProgress` with tool details

---

## Testing Plan

1. Manual testing with WebSocket inspector
2. Verify widget only receives expected events
3. Verify dashboard receives all events
4. Test superseded workflow cancellation
5. Test tool progress emissions during knowledge search
