# AI Agent Event Flow Diagrams

## Scenario 1: AI Responds to Visitor Message

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VISITOR sends message                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKER: Job received                                                        │
│  ├─ Mark conversation as seen                                               │
│  ├─ 📤 emit: conversationSeen (👁 widget + 🖥 dashboard)                     │
│  ├─ 📤 emit: aiAgentProcessingStarted (🖥 dashboard only)                    │
│  │       → phase: "starting"                                                │
│  └─ Apply response delay (if configured)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE Step 1: INTAKE                                                     │
│  └─ Load conversation, history, visitor context                             │
│  (No events emitted - internal only)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE Step 2: DECISION                                                   │
│  └─ Decision: shouldAct=true, mode="respond_to_visitor"                     │
│  📤 emit: aiAgentDecisionMade (👁 widget + 🖥 dashboard)                     │
│       → shouldAct: true                                                     │
│       → reason: "All conditions met for AI response"                        │
│       → mode: "respond_to_visitor"                                          │
│  📤 emit: conversationTyping (👁 widget + 🖥 dashboard)                      │
│       → isTyping: true                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE Step 3: GENERATION (LLM with tools)                                │
│  ├─ Tool: searchKnowledgeBase                                               │
│  │   📤 emit: aiAgentProcessingProgress (👁 widget + 🖥 dashboard)           │
│  │        → phase: "tool"                                                   │
│  │        → message: "Searching knowledge base..." (👁 widget sees this)    │
│  │        → tool: { name: "searchKnowledgeBase", state: "partial" }         │
│  │                                                                          │
│  │   📤 emit: aiAgentProcessingProgress (👁 widget + 🖥 dashboard)           │
│  │        → tool: { state: "result", output: [...sources] }                 │
│  │                                                                          │
│  └─ LLM generates structured decision                                       │
│      📤 emit: aiAgentProcessingProgress (🖥 dashboard only)                  │
│           → phase: "generating"                                             │
│           → message: null (or reasoning preview)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE Step 4: EXECUTION                                                  │
│  └─ Execute action: send message                                            │
│  📤 emit: timelineItemCreated (👁 widget + 🖥 dashboard)                     │
│       → Full message with parts (text, sources, etc.)                       │
│  📤 emit: conversationTyping (👁 widget + 🖥 dashboard)                      │
│       → isTyping: false                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE Step 5: FOLLOWUP                                                   │
│  └─ Clear workflow state, update stats                                      │
│  📤 emit: aiAgentProcessingCompleted (👁 widget + 🖥 dashboard)              │
│       → status: "success"                                                   │
│       → action: "respond"                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Widget sees: 👁 seen → 👁 decision (typing) → 👁 tool progress → 👁 message → 👁 done
Dashboard sees: 🖥 started → 🖥 decision details → 🖥 full tool info → 🖥 message → 🖥 done
```

---

## Scenario 2: AI Decides NOT to Respond (Human Active)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VISITOR sends message                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKER: Job received                                                        │
│  ├─ 📤 emit: conversationSeen (👁 widget + 🖥 dashboard)                     │
│  └─ 📤 emit: aiAgentProcessingStarted (🖥 dashboard only)                    │
│           → phase: "starting"                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE Step 1: INTAKE → OK                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE Step 2: DECISION                                                   │
│  └─ Decision: shouldAct=false, reason="Human agent active"                  │
│  📤 emit: aiAgentDecisionMade (🖥 dashboard ONLY)                            │
│       → shouldAct: false                                                    │
│       → reason: "Conversation has an active human assignee"                 │
│       → mode: "background_only"                                             │
│                                                                             │
│  ❌ NO typing indicator (shouldAct is false)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE: Skip to followup                                                  │
│  📤 emit: aiAgentProcessingCompleted (🖥 dashboard ONLY)                     │
│       → status: "skipped"                                                   │
│       → reason: "Conversation has an active human assignee"                 │
└─────────────────────────────────────────────────────────────────────────────┘

Widget sees: 👁 seen only (message delivered indicator)
Dashboard sees: 🖥 started → 🖥 decision (skipped + reason) → 🖥 completed (skipped)

💡 This lets dashboard users know: "AI saw this but chose not to respond because..."
```

---

## Scenario 3: AI Workflow Superseded (Newer Message)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VISITOR sends message A                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKER: Job A received                                                      │
│  ├─ 📤 emit: conversationSeen                                               │
│  ├─ 📤 emit: aiAgentProcessingStarted (🖥 dashboard)                         │
│  └─ Apply response delay: 2000ms...                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
     ┌──────────────────────────────┴──────────────────────────────┐
     │  During delay, VISITOR sends message B                      │
     │  → New workflowRunId registered                             │
     │  → Job A's workflowRunId is now stale                       │
     └─────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKER: Job A checks isWorkflowRunActive → FALSE                            │
│  📤 emit: aiAgentProcessingCompleted (🖥 dashboard ONLY)                     │
│       → status: "cancelled"                                                 │
│       → reason: "Superseded by newer message"                               │
│                                                                             │
│  Job A exits cleanly                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKER: Job B runs normally...                                              │
│  (Goes through full pipeline for message B)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Widget sees: 👁 seen (for both messages)
Dashboard sees: 🖥 Job A started → 🖥 Job A cancelled → 🖥 Job B full flow
```

---

## Event Visibility Matrix

| Event | Widget (👁) | Dashboard (🖥) | Notes |
|-------|-------------|----------------|-------|
| `conversationSeen` | ✅ | ✅ | AI has seen the message |
| `aiAgentProcessingStarted` | ❌ | ✅ | Processing began |
| `aiAgentDecisionMade` (act) | ✅ | ✅ | Shows typing indicator |
| `aiAgentDecisionMade` (skip) | ❌ | ✅ | With reason why |
| `conversationTyping` | ✅ | ✅ | Only after shouldAct=true |
| `aiAgentProcessingProgress` (tool) | ✅* | ✅ | *Widget gets progressMessage only |
| `aiAgentProcessingProgress` (gen) | ❌ | ✅ | Internal generation phase |
| `timelineItemCreated` | ✅ | ✅ | Final message delivered |
| `aiAgentProcessingCompleted` | ✅* | ✅ | *Widget only if acted |

---

## Legend

- 👁 = Widget (visitor-facing)
- 🖥 = Dashboard (human agent-facing)
- ✅ = Event visible
- ❌ = Event filtered out
- ✅* = Conditional visibility or filtered payload
