# Notes for Next Iteration: Timeline Item Primitives

## Overview

This document contains findings and plans for implementing new React primitives to render AI SDK v6 compatible timeline items. This work was scoped out of the initial implementation to focus on the type system first.

---

## Planned Primitives Structure

```
@packages/react/src/primitives/
├── timeline-item.tsx              # (existing - needs updates)
├── timeline-item-parts/
│   ├── index.tsx                  # Re-exports all part components
│   ├── text-part.tsx              # Text content with state indicator
│   ├── reasoning-part.tsx         # AI reasoning/thought bubble
│   ├── tool-part.tsx              # Base tool invocation display
│   ├── tool-knowledge-search.tsx  # Knowledge search specific UI
│   ├── tool-escalate.tsx          # Escalation specific UI
│   ├── tool-resolve.tsx           # Resolution specific UI
│   ├── tool-identify.tsx          # Identification form UI
│   ├── source-url-part.tsx        # URL citation
│   ├── source-document-part.tsx   # Document citation
│   ├── step-start-part.tsx        # Step boundary marker
│   ├── image-part.tsx             # (extract from timeline-item)
│   ├── file-part.tsx              # (extract from timeline-item)
│   └── parts-renderer.tsx         # Smart renderer for parts array
├── sources-list.tsx               # Aggregated sources footer
└── ai-activity-indicator.tsx      # Progress indicator component
```

---

## Updated TimelineItemRenderProps

The existing `TimelineItemRenderProps` should be extended:

```typescript
export type TimelineItemRenderProps = {
  // Existing
  isVisitor: boolean;
  isAI: boolean;
  isHuman: boolean;
  timestamp: Date;
  text: string | null;
  senderType: "visitor" | "ai" | "human";
  itemType: "message" | "event" | "identification";

  // NEW: Full parts array (AI SDK compatible)
  parts: UIMessagePart[];

  // NEW: Filtered by type for convenience
  textParts: TextUIPart[];
  reasoningParts: ReasoningUIPart[];
  toolParts: ToolUIPart[];
  sourceParts: (SourceUrlUIPart | SourceDocumentUIPart)[];
  fileParts: (FileUIPart)[];

  // NEW: Reply context (future feature)
  isReply: boolean;
  replyToId: string | null;

  // NEW: Processing state
  hasStreamingParts: boolean;  // Any part with state='streaming' or state='partial'
};
```

---

## PartsRenderer Component

A smart component that renders parts based on type:

```tsx
export type PartsRendererProps = {
  parts: UIMessagePart[];

  // Custom renderers (optional - falls back to defaults)
  renderText?: (part: TextUIPart, index: number) => React.ReactNode;
  renderReasoning?: (part: ReasoningUIPart, index: number) => React.ReactNode;
  renderTool?: (part: ToolUIPart, index: number) => React.ReactNode;
  renderSourceUrl?: (part: SourceUrlUIPart, index: number) => React.ReactNode;
  renderSourceDocument?: (part: SourceDocumentUIPart, index: number) => React.ReactNode;
  renderFile?: (part: FileUIPart, index: number) => React.ReactNode;
  renderStepStart?: (part: StepStartUIPart, index: number) => React.ReactNode;
  renderUnknown?: (part: unknown, index: number) => React.ReactNode;

  // Grouping options
  groupSources?: boolean;  // Collect sources at the end
  hideReasoning?: boolean; // For widget mode
};

export const PartsRenderer: React.FC<PartsRendererProps> = ({
  parts,
  groupSources = true,
  hideReasoning = false,
  ...customRenderers
}) => {
  // Implementation: iterate parts, call appropriate renderer
  // If groupSources=true, collect source parts and render at end
};
```

---

## Tool Part Components

Each tool type needs its own component for proper UI:

### ToolPart (Base)

```tsx
type ToolPartProps = {
  part: ToolUIPart;
  // Show loading state while partial
  showLoadingState?: boolean;
  // Custom progress message (from providerMetadata.cossistant.progressMessage)
  progressMessage?: string;
};

// Renders:
// - Loading spinner + progressMessage when state='partial'
// - Tool output when state='result'
// - Error message when state='error'
```

### Tool-specific Components

```tsx
// Knowledge Search - shows sources found
<ToolKnowledgeSearch part={part} />
// When partial: "Searching knowledge base..."
// When result: List of found articles (clickable)

// Escalate - shows escalation notice
<ToolEscalate part={part} />
// When partial: "Connecting you with a team member..."
// When result: "You've been connected to [name]"

// Identify - shows identification form
<ToolIdentify part={part} onSubmit={...} />
// When partial: Form fields based on input.fields
// When result: "Thanks, [name]!"
```

---

## Source Components

### SourceUrlPart

```tsx
<SourceUrlPart part={part} />
// Renders: 📄 [title](url)
// Optional: Show knowledge entry preview on hover
```

### SourcesList (Aggregated)

```tsx
<SourcesList parts={sourceParts} />
// Renders:
// Sources:
// • Shipping FAQ
// • Returns Policy
// • Contact Us
```

---

## AI Activity Indicator

For showing what the AI is doing:

```tsx
type AIActivityIndicatorProps = {
  conversationId: string;
  // 'widget' = only helpful messages, 'dashboard' = all messages
  audience?: 'widget' | 'dashboard';
};

export function AIActivityIndicator({ conversationId, audience = 'widget' }: Props) {
  const progress = useAIProgress(conversationId);

  if (!progress.isProcessing) return null;

  // For widget: show progress.message (null = just show dots)
  // For dashboard: show full activity details

  return (
    <div className="flex items-center gap-2">
      <TypingDots />
      {progress.message && <span>{progress.message}</span>}
    </div>
  );
}
```

---

## Hooks to Implement

### useAIProgress

```typescript
type AIProgress = {
  isProcessing: boolean;
  phase: string | null;
  message: string | null;
  toolName: string | null;
  toolCallId: string | null;
};

function useAIProgress(conversationId: string): AIProgress {
  // Listen to aiAgentProgress WebSocket events
  // Return current processing state
}
```

### useTimelineItemUpdates

```typescript
function useTimelineItemUpdates(conversationId: string) {
  // Listen to timelineItemCreated, timelineItemUpdated, timelineItemPartUpdated
  // Return reactive items array that updates in real-time
}
```

---

## Styling Considerations

All primitives should follow the existing pattern:
- Unstyled by default (headless)
- Accept `className` prop
- Support `asChild` pattern with Radix Slot
- Use `useRenderElement` helper for consistent rendering

Example:

```tsx
export const TextPart = React.forwardRef<HTMLDivElement, TextPartProps>(
  ({ part, className, asChild = false, ...props }, ref) => {
    return useRenderElement(
      "div",
      { className, asChild },
      {
        ref,
        props: {
          ...props,
          children: part.text,
          "data-state": part.state,
        },
      }
    );
  }
);
```

---

## Migration Notes

### Existing timeline-item.tsx

The current component has `MemoizedMarkdownBlock` for rendering markdown. This should be:
1. Extracted to its own file
2. Used by `TextPart` when `renderMarkdown` is true
3. Keep backward compatibility with current API

### Breaking Changes to Avoid

- Keep existing `TimelineItem`, `TimelineItemContent`, `TimelineItemTimestamp` APIs
- Add new `parts` prop alongside existing `text` prop
- New primitives are additive, not replacing

---

## Testing Plan

1. Unit tests for each primitive component
2. Storybook stories showing different states
3. Integration tests with mock WebSocket events
4. Visual regression tests for styling

---

## Dependencies to Add

```json
// @packages/react/package.json
{
  "dependencies": {
    "ai": "^6.0.0"  // For AI SDK types (UIMessage, UIMessagePart, etc.)
  },
  "peerDependencies": {
    "ai": "^6.0.0"  // Optional peer dep for full type inference
  }
}
```

---

## Open Questions for Next Iteration

1. **Part ordering**: Should we maintain insertion order or group by type?
2. **Reasoning visibility**: Default collapsed in dashboard? Hidden in widget?
3. **Tool approval flow**: Some tools might need human approval before execution
4. **Source deduplication**: Multiple messages citing same source - dedupe in SourcesList?
5. **Streaming text**: Should TextPart show character-by-character animation for `state='streaming'`?
