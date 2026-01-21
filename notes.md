# Notes: Timeline Item AI SDK v6 Compatibility Audit

## Critical Architecture Difference

**AI SDK** uses **SSE streaming** - tokens flow directly from model to client.

**Cossistant** uses **WebSocket + Background Jobs**:
1. Message triggers BullMQ job
2. Worker processes in background
3. Worker updates DB + emits WebSocket events
4. Client receives updates via WebSocket

**Implication**: We don't use "streaming" states. Instead we use **job-oriented states**:
- `pending` → `processing` → `completed` | `error`
- For tools: `pending` → `executing` → `awaiting-input` → `completed` | `error`

---

## AI SDK v6 Types Research

### UIMessage Interface (Source of Truth)
The `UIMessage` interface in AI SDK v6 is the source of truth for application state. It contains:

```typescript
interface UIMessage<
  METADATA = unknown,
  DATA_PARTS extends UIDataTypes = UIDataTypes,
  TOOLS extends UITools = UITools,
> {
  id: string;                                    // Unique identifier
  role: 'system' | 'user' | 'assistant';         // Message role
  metadata?: METADATA;                           // Custom metadata
  parts: Array<UIMessagePart<DATA_PARTS, TOOLS>>; // Content parts array
}
```

### UI Part Types in AI SDK v6

| Part Type | Description | Properties |
|-----------|-------------|------------|
| `TextUIPart` | Plain text content | `type: 'text'`, `text: string`, `state?: 'streaming' \| 'done'` |
| `ReasoningUIPart` | AI reasoning/chain-of-thought | `type: 'reasoning'`, `text: string`, `state?`, `providerMetadata?` |
| `ToolUIPart<TOOLS>` | Tool invocations | `type: 'tool-${NAME}'`, `toolCallId`, `input`, `output`, `state` |
| `FileUIPart` | File attachments | `type: 'file'`, `mediaType`, `filename?`, `url` |
| `SourceUrlUIPart` | URL source citations | `type: 'source-url'`, `sourceId`, `url`, `title?`, `providerMetadata?` |
| `SourceDocumentUIPart` | Document source citations | `type: 'source-document'`, `sourceId`, `mediaType`, `title`, `filename?` |
| `StepStartUIPart` | Step boundary marker | `type: 'step-start'` |
| `DataUIPart<DATA_TYPES>` | Custom data parts | `type: 'data-${NAME}'`, `id?`, `data` |

### Tool Part States
Tool parts have these possible states:
- `input-streaming` - Tool input is being streamed
- `input-available` - Tool input is complete, awaiting execution
- `output-available` - Tool executed successfully, output available
- `output-error` - Tool execution failed, `errorText` available

### Key Differences from Current Cossistant Types

#### Current Cossistant TimelineItem:
```typescript
{
  id: string;
  conversationId: string;
  organizationId: string;
  visibility: 'public' | 'private';
  type: 'message' | 'event' | 'identification';
  text: string | null;
  tool: string | null;                          // Single tool field
  parts: TimelineItemParts;                     // Limited part types
  userId: string | null;
  aiAgentId: string | null;
  visitorId: string | null;
  createdAt: string;
  deletedAt?: string | null;
}
```

#### Current Cossistant Part Types:
- `text` - Text content
- `image` - Image with url, mediaType, dimensions
- `file` - File with url, mediaType, fileName, size
- `event` - Conversation events (assigned, resolved, etc.)
- `metadata` - Source channel (email, widget, api)

### Gaps Analysis

| AI SDK Feature | Cossistant Status | Priority |
|----------------|------------------|----------|
| `reasoning` parts | Missing | High (for AI agent transparency) |
| `tool-*` typed parts | Missing (only `tool` string field) | High (for tool invocations) |
| `source-url` parts | Missing | High (for knowledge attribution) |
| `source-document` parts | Missing | Medium (for document sources) |
| `step-start` parts | Missing | Medium (for multi-step flows) |
| Custom `data-*` parts | Missing | Low (can extend later) |
| Part `state` field | Missing | High (for streaming support) |
| Generic metadata | Missing | Medium |
| `role` field | Derived from userId/aiAgentId/visitorId | Keep existing pattern |

### Architecture Considerations

1. **Role Mapping**:
   - AI SDK uses `role: 'system' | 'user' | 'assistant'`
   - Cossistant uses `userId`, `aiAgentId`, `visitorId` fields
   - We can map: visitor → user, aiAgent → assistant, human → user (with metadata)

2. **Visibility/Privacy**:
   - AI SDK doesn't have visibility concept
   - Cossistant needs `visibility: 'public' | 'private'` for internal notes
   - Need to add privacy trimming for widget consumers

3. **Tool Typing**:
   - AI SDK uses typed `tool-${NAME}` pattern with generics
   - Need to define tool registry for type safety
   - Consider: `tool-knowledge-search`, `tool-escalate`, `tool-identify`, etc.

4. **Sources Integration**:
   - Map Cossistant's `Knowledge` types to `SourceUrlUIPart` / `SourceDocumentUIPart`
   - Knowledge entries have `sourceUrl`, `sourceTitle` - fits well

## Privacy Strategy Ideas

1. **Part-level filtering**: Filter out private parts before sending to widget
2. **Content redaction**: Strip internal notes, tool arguments with sensitive data
3. **Source limiting**: Only show public knowledge sources, not internal docs
4. **Reasoning hiding**: Option to hide AI reasoning from visitors

## Integration Options

### Option A: Extend AI SDK Types
- Make Cossistant types extend AI SDK types
- Add custom fields (conversationId, organizationId, visibility, etc.)
- Pros: Full compatibility, familiar to AI SDK users
- Cons: Dependency on AI SDK package

### Option B: Compatible Types (No Dependency)
- Define types that are structurally compatible
- Use same naming conventions and patterns
- Pros: No dependency, lighter package
- Cons: Need to maintain compatibility manually

### Option C: Hybrid (Recommended)
- Add `ai` package as dependency in `@packages/core`
- Export utility functions to convert between formats
- Keep Cossistant types as source of truth in DB
- Provide AI SDK compatible views for consumers

## Proposed New Part Types for Cossistant

```typescript
// Text with streaming state
type TextPart = {
  type: 'text';
  text: string;
  state?: 'streaming' | 'done';
};

// AI reasoning (visible in dashboard, hidden from widget by default)
type ReasoningPart = {
  type: 'reasoning';
  text: string;
  state?: 'streaming' | 'done';
};

// Tool invocation with full lifecycle
type ToolPart<T extends string = string> = {
  type: `tool-${T}`;
  toolCallId: string;
  input: Record<string, unknown>;
  output?: unknown;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  errorText?: string;
};

// Source attribution (knowledge used)
type SourceUrlPart = {
  type: 'source-url';
  sourceId: string;
  url: string;
  title?: string;
  knowledgeId?: string; // Link to Cossistant knowledge entry
};

type SourceDocumentPart = {
  type: 'source-document';
  sourceId: string;
  mediaType: string;
  title: string;
  filename?: string;
  knowledgeId?: string;
};

// Step boundary for multi-step responses
type StepStartPart = {
  type: 'step-start';
  stepId?: string;
  description?: string;
};

// Existing parts with potential updates
type ImagePart = {
  type: 'image';
  url: string;
  mediaType: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
};

type FilePart = {
  type: 'file';
  url: string;
  mediaType: string;
  fileName?: string;
  size?: number;
};

type EventPart = {
  type: 'event';
  eventType: ConversationEventType;
  // ... existing fields
};

type MetadataPart = {
  type: 'metadata';
  source: 'email' | 'widget' | 'api';
};
```

## Cossistant-Specific Tools to Define

Based on AI agent behaviors in `ai-agent.ts`:

| Tool Name | Purpose | Visibility |
|-----------|---------|------------|
| `knowledge-search` | Search knowledge base | Dashboard only |
| `escalate` | Escalate to human | Public |
| `resolve` | Mark conversation resolved | Public |
| `assign` | Assign to team member | Dashboard only |
| `categorize` | Add to view | Dashboard only |
| `set-priority` | Change priority | Dashboard only |
| `identify-visitor` | Request visitor identification | Public |
| `schedule` | Schedule appointment | Public |
| `collect-feedback` | Collect feedback | Public |

## Next Steps

1. Create new timeline part types schema with Zod
2. Add AI SDK as dependency to `@packages/core`
3. Create conversion utilities between formats
4. Update `timeline-item.tsx` primitive to handle new part types
5. Create new primitives for tool display, reasoning, sources
6. Implement privacy filtering for widget consumers
7. Update API/workers to generate new part types
