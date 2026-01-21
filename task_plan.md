# Task Plan: Timeline Item AI SDK v6 Compatibility Audit

## Goal
Audit and redesign the timeline-item primitives to be compatible with Vercel AI SDK v6 types (UIMessage, tool calling, parts), enabling rich AI agent features like tool invocations, thought process, sources, and privacy controls.

## Phases
- [x] Phase 1: Research AI SDK v6 types and structure
- [x] Phase 2: Audit current timeline-item.tsx implementation
- [x] Phase 3: Audit current types in @packages/types
- [x] Phase 4: Design new type system extending AI SDK
- [x] Phase 5: Plan component architecture changes
- [x] Phase 6: Define privacy/trimming strategy
- [x] Phase 7: Create implementation roadmap

## Key Questions - All Answered ✅

1. **What are the exact types in AI SDK v6 for UIMessage, parts, and tool calls?**
   ✅ UIMessage has id, role, metadata, parts array. Parts include TextUIPart, ReasoningUIPart, ToolUIPart (typed as `tool-${NAME}`), FileUIPart, SourceUrlUIPart, SourceDocumentUIPart, StepStartUIPart, DataUIPart.

2. **How does the current TimelineItem type compare to UIMessage?**
   ✅ Major gaps identified - missing reasoning parts, typed tool parts (only string field), source attribution, step markers, streaming state. Full comparison in notes.md.

3. **What new primitives are needed for tool invocations, thoughts, sources?**
   ✅ New components planned: text-part, reasoning-part, tool-part (with tool-specific variants), source-url-part, source-document-part, step-start-part, parts-renderer, sources-list.

4. **How should we handle privacy (trimming sensitive data for widget)?**
   ✅ Part-level visibility field + privacy filter function + privacy presets (TRANSPARENT, STANDARD, MINIMAL). See IMPLEMENTATION_PLAN.md.

5. **Where should AI SDK be integrated?**
   ✅ Add `ai` package to `@packages/core` with conversion utilities (toUIMessage, fromUIMessage).

## Decisions Made

1. **Hybrid Integration**: Add `ai` package to @packages/core as dependency, create compatible types that extend AI SDK patterns while maintaining Cossistant-specific fields (visibility, knowledgeId references, etc.)

2. **Role Mapping**: visitor → user, aiAgent → assistant, human user → user (distinguished by userId vs visitorId)

3. **Part Type Expansion**: Add 10+ new part types matching AI SDK v6:
   - text (with job state)
   - reasoning (AI chain-of-thought)
   - tool-* (typed tool invocations with state machine)
   - source-url, source-document (knowledge attribution)
   - step-start (multi-step markers)

4. **Part-Level Privacy**: Each part can have visibility: 'public' | 'private', filtered before sending to widget

5. **Cossistant Extensions**: Add knowledgeId to source parts, visibility via providerMetadata, reply threading (replyToId - future feature)

6. **Backward Compatibility**: Old `text` field deprecated but supported, parts array now required

7. **Use AI SDK States with Job Semantics**: Keep AI SDK's exact state values but interpret for job-based system:
   - Text/Reasoning: `streaming` (= still processing) → `done` (= complete)
   - Tools: `partial` (= executing) → `result` (= success) | `error` (= failed)
   - Our WebSocket updates transition these states as workers progress

8. **New WebSocket Events**: Add `timelineItemUpdated`, `aiAgentProcessingStarted`, `aiAgentProcessingProgress`, `aiAgentProcessingCompleted`, `timelineItemPartUpdated` events for progressive UI updates

9. **AI SDK Extension Points**: Use AI SDK's designated extension points instead of custom fields:
   - `UIMessage.metadata` → Cossistant message metadata (conversationId, visibility, sender IDs)
   - `providerMetadata.cossistant` → Part-level extensions (visibility, progressMessage)
   - Transient data parts → Progress events (not persisted, for live display)

10. **API-Level Filtering**: Dashboard vs Widget filtering happens in the API layer, not baked into types:
    - Types are pure AI SDK compatible
    - `filterMessageForAudience(message, 'widget')` removes private parts
    - Same data structure, different views

11. **AI SDK Tool States**: Use AI SDK's exact state values:
    - `partial` → Tool executing (maps to our "in progress")
    - `result` → Tool completed successfully
    - `error` → Tool failed

12. **Custom Tool Progress**: Developers add `providerMetadata.cossistant.progressMessage` to define what to show during execution

## Deliverables Created

1. **notes.md** - Detailed research findings and gap analysis
2. **IMPLEMENTATION_PLAN.md** - Implementation plan for this iteration:
   - New Zod schemas for all part types (AI SDK compatible)
   - AI SDK conversion utilities (`toUIMessage`, `fromUIMessage`)
   - Privacy filtering utilities (`filterMessageForAudience`)
   - New WebSocket events for progress updates
   - Database schema updates
   - Migration script for existing data
3. **NOTES_FOR_NEXT.md** - Plans for React primitives (deferred):
   - PartsRenderer component
   - Tool-specific UI components
   - AI activity indicator
   - Updated TimelineItem render props

## Errors Encountered
- None

## Implementation Status

### Phase 1: Type Foundation - COMPLETE ✅
- [x] Update `@packages/types/src/api/timeline-item.ts` with new part schemas (AI SDK compatible)
- [x] Add new WebSocket events to `@packages/types/src/realtime-events.ts`
- [x] Add `ai` package dependency to `@packages/core`
- [x] Create AI SDK conversion utilities (`toUIMessage`, `fromUIMessage`) in `@packages/core/src/ai-sdk-utils.ts`
- [x] Create privacy filter utilities (`filterMessageForAudience`) in `@packages/core/src/privacy-filter.ts`

### Files Modified/Created
1. `packages/types/src/api/timeline-item.ts` - New AI SDK compatible part schemas:
   - `textPartSchema` - Text with streaming state
   - `reasoningPartSchema` - AI reasoning with providerMetadata
   - `toolPartSchema` - Tool-* pattern with toolCallId, toolName, input, output, state
   - `sourceUrlPartSchema` - URL citations with providerMetadata
   - `sourceDocumentPartSchema` - Document citations
   - `stepStartPartSchema` - Multi-step boundary markers
   - `filePartSchema` - File attachments
   - `imagePartSchema` - Image attachments
   - `cossistantProviderMetadataSchema` - Extension point for visibility, progressMessage, knowledgeId

2. `packages/types/src/realtime-events.ts` - New WebSocket events:
   - `aiAgentProcessingStarted` - When AI agent begins processing
   - `aiAgentProcessingProgress` - Progress updates with phase and tool info
   - `aiAgentProcessingCompleted` - When AI agent finishes
   - `timelineItemUpdated` - When timeline item parts are updated
   - `timelineItemPartUpdated` - Granular part updates

3. `packages/core/package.json` - Added `ai` package dependency (v6.0.43)

4. `packages/core/src/ai-sdk-utils.ts` - New AI SDK conversion utilities:
   - `toUIMessage()` / `toUIMessages()` - Convert TimelineItem to UIMessage
   - `fromUIMessage()` / `fromUIMessages()` - Convert UIMessage to TimelineItem
   - `extractSources()`, `extractToolCalls()`, `hasProcessingParts()` - Helpers
   - All AI SDK compatible types exported

5. `packages/core/src/privacy-filter.ts` - New privacy filter utilities:
   - `filterMessageForAudience()` / `filterMessagesForAudience()` - Filter for dashboard/widget
   - `filterTimelineItemForAudience()` / `filterTimelineItemsForAudience()` - Direct filtering
   - `PrivacyPresets` - TRANSPARENT, STANDARD, MINIMAL presets
   - `hasVisibleContent()`, `countVisibleParts()`, `extractVisibleText()` - Helpers

## Status
**PHASE 1 COMPLETE** ✅ - Type system and utilities implemented. Ready for Phase 2 (React primitives) in next iteration.
