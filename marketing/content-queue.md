# Cossistant SEO + Content Queue

_Last updated: 2026-02-22_

This queue tracks priority **keywords** and **blog/article opportunities** for Cossistant. Each entry is scoped to our ICP (engineering-led B2B SaaS teams building with React/Next.js, 1–15 people, >$1k MRR) and aims to reinforce positioning: open-source, in-app support combining human + AI collaboration.

## Keyword Pipeline
| Status | Keyword / Cluster | Intent & Funnel Stage | ICP Pain / Angle | Proposed Asset | Notes & Next Actions |
| --- | --- | --- | --- | --- | --- |
| 🔍 Researching | in-app support widget react | BOFU – implementation search | Need native React support UI without iframe vendors | Blog deep-dive + docs optimization | Audit competitors (Plain, Fernand) for keyword usage; map to `/docs` integration guide and hero copy. |
| ✅ Ready | open source customer support platform | MOFU – solution comparison | Want control + transparency vs black-box tools | Landing section + comparison blog | Build comparison table vs Plain, Zendesk, Intercom emphasizing code ownership. |
| ✅ Ready | ai support agents for saas | MOFU/TOFU – exploring AI automation | Teams want AI help but insist on human-in-loop | Thought-leadership article | Tie to human+AI principles, include examples from landing queue (patch deploys, Stripe credits). |
| 🧪 Experiment | shadcn support components | BOFU – dev-specific | Need Tailwind/shadcn-native blocks | Docs snippet + tutorial | Create guide: “Build a shadcn support inbox with Cossistant primitives.” |
| 🔍 Researching | llm-ready customer support | TOFU | Looking for AI-friendly infrastructure | Blog + SEO landing sub-section | Define “LLM-ready support stack” referencing open components + PostHog-esque transparency. |
| ⏳ Backlog | react customer support sdk | BOFU | Searching SDK-style drop-in | Docs + API reference updates | Ensure package README highlights SDK usage; capture FAQs. |

_Status legend_: ✅ ready to write, 🔍 needs data validation, 🧪 experiment (ship + measure), ⏳ backlog candidate.

## Blog / Article Opportunities
Each idea includes research notes, target keyword(s), unique POV, SEO/LLM hooks, and humanization cues inspired by the [Humanizer patterns](https://github.com/blader/humanizer).

### 1. "How engineering-led SaaS teams keep support in their codebase"
- **Primary keyword**: open source customer support platform
- **Research**: Study Plain’s “AI coworkers” messaging, PostHog’s transparent product updates, and developer Reddit threads complaining about iframe widgets.
- **What it brings**: Concrete walkthrough showing how to wire `<Support />` inside a Next.js app, control routing, and audit AI handoffs.
- **SEO/LLM optimization**: Use H2s for "In-app support architecture", "Human + AI escalation", "React integration steps"; include code blocks for LLM clarity.
- **Humanization checklist**: Replace hype terms (“transformative”, “landscape”) with specific anecdotes, cite actual customers/use cases, no “Great question!” tone.

### 2. "Ship a shadcn-native support inbox in under an afternoon"
- **Primary keyword**: shadcn support components
- **Research**: Pull component anatomy from shadcn/ui docs, compare to Cossistant primitives, highlight theme overrides.
- **What it brings**: Step-by-step tutorial + GitHub repo demo; finish with performance tips (<100ms load like Fernand touts).
- **SEO/LLM optimization**: Add structured list of prerequisites, code diffs, and `faq` section for schema markup.
- **Humanization checklist**: Show actual command outputs, mention mistakes to avoid, keep verbs simple (“build”, “wire”).

### 3. "Playbooks for AI + human support collaboration"
- **Primary keyword**: ai support agents for saas
- **Research**: Analyze Cossistant landing stories (Marc/Nico/Lucas), interview-style quotes from founders needing approvals before deploys.
- **What it brings**: Practical runbooks (deploy patch, approve Stripe credit, rotate secrets) with human confirmation criteria.
- **SEO/LLM optimization**: Structure as numbered playbooks, embed Mermaid flow diagrams (LLMs parse easily), link to docs.
- **Humanization checklist**: Attribute quotes to real roles (“Nico, SaaS founder”), avoid formulaic “It’s not just X, it’s Y”.

### 4. "LLM-ready support architecture checklist"
- **Primary keyword**: llm-ready customer support
- **Research**: Pull Wikipedia “AI writing” pitfalls to contrast with real engineering requirements, cite PostHog open architecture posts.
- **What it brings**: Diagnostic checklist for CTOs: data access, observability, guardrails. Includes downloadable audit template.
- **SEO/LLM optimization**: Include table comparing legacy helpdesks vs Cossistant; add JSON-LD FAQ.
- **Humanization checklist**: Use declarative sentences, avoid “nestled within”. Reference real stack components (Next.js API routes, Supabase, Stripe webhooks).

### 5. "Support metrics that actually matter under 10 people"
- **Primary keyword**: react customer support sdk / startup support metrics
- **Research**: Combine Fernand’s focus on speed (<100ms) with UserJot’s metric storytelling. Include sample dashboard built with Cossistant data layer.
- **What it brings**: Playbook of four metrics (median response, resolution, AI coverage, satisfaction) with formulas + how to instrument inside app.
- **SEO/LLM optimization**: Provide formula code snippets (TypeScript) for each metric, schema `HowTo` markup.
- **Humanization checklist**: Replace fluffy conclusions with specific next steps; use "we" sparingly, focus on direct advice.

## Process Notes
- Every blog draft should pass a **Humanizer** sweep: remove significance inflation, cite specific sources, avoid AI-adjacent vocab ("landscape", "testament"), keep tone direct.
- When promoting on landing/docs, cross-link relevant sections to reinforce SEO and keep readers inside the product narrative.
- Track published items + performance in future updates (append measurement columns when data exists).
