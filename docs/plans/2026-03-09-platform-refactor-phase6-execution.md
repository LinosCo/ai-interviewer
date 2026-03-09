# Platform Refactor Phase 6 Execution

**Date:** 2026-03-09
**Status:** Draft
**Depends on:** `docs/plans/2026-03-09-platform-refactor-phase6-ux-ui-execution-plan.md`

## Goal

Phase 6 is the product-surface rewrite that makes the platform:

- easier to understand without prior product fluency
- more coherent across modules, language and visual structure
- more operational around canonical tips
- more strategic in analytics and next-step guidance
- more assistive during project setup, tool creation and activation

At the end of this phase, the platform should visibly behave like a project intelligence and activation operating system.

## Why This Execution Plan Exists

The Phase 6 UX/UI plan is intentionally broad because it spans:

- workspace information architecture
- canonical tip UX
- routing UX
- Copilot prompt guidance
- analytics redesign
- text and microcopy review
- in-product guidance layer
- visual coherence and accessibility

Without a sprinted plan, this work would become too large, too subjective and too risky to validate incrementally.

This execution document breaks Phase 6 into implementation units that:

- reduce integration risk
- let data/API readiness land before UI dependence
- let content design and UX coherence evolve alongside implementation
- preserve reviewability and testability

## Sprint Order

1. Sprint 1 — IA, glossary and experience foundations
2. Sprint 2 — Workspace shell and navigation rewrite
3. Sprint 3 — Canonical tip experience and related actions
4. Sprint 4 — Manual routing UX and execution state clarity
5. Sprint 5 — Strategic analytics redesign
6. Sprint 6 — Guided onboarding and setup assistance
7. Sprint 7 — Copilot UX and prompt guidance
8. Sprint 8 — Coherence pass, accessibility, responsive and release hardening

## Global Delivery Rules

1. Do not introduce a new UX concept without first defining its name in the glossary.
2. Prefer additive cutovers with clear fallback where canonical parity is incomplete.
3. Keep backend contracts stable unless a UX requirement materially depends on a contract improvement.
4. Every sprint must include:
   - product copy review for touched surfaces
   - responsive verification
   - keyboard/focus verification
   - regression checks on adjacent flows
5. No screen should ship if the user can see a state but not understand what action is available next.

## Sprint 1 — IA, Glossary And Experience Foundations

**Goal**

Freeze the semantic foundation of Phase 6 before implementation spreads across multiple pages.

**Primary outcomes**

- canonical terminology
- approved naming for sections and states
- IA decision for project workspace
- guidance architecture decision
- analytics hierarchy decision

**Scope**

- finalize workspace section semantics:
  - `Overview`
  - `Listen`
  - `Tips`
  - `Execute`
  - `Measure`
  - `Strategy`
  - `Connections`
- define canonical state labels for:
  - manual only
  - ready to route
  - awaiting approval
  - automated
  - completed
  - failed
- define glossary and microcopy rules
- define guidance-layer persistence model
- define analytics storytelling structure

**Deliverables**

- `docs/design/PRODUCT-LANGUAGE-GLOSSARY.md`
- `docs/design/MICROCOPY-GUIDELINES.md`
- Phase 6 IA map
- analytics information hierarchy note
- guidance state model note

**Suggested files**

- `docs/plans/2026-03-09-platform-refactor-phase6-ux-ui-execution-plan.md`
- `docs/design/PRODUCT-LANGUAGE-GLOSSARY.md`
- `docs/design/MICROCOPY-GUIDELINES.md`
- optional helper docs under `docs/design/`

**Implementation notes**

- decide which English terms stay because they are already naturalized
- normalize recurring verbs for CTAs
- define empty-state template structure
- define page intro and helper-text style

**Done criteria**

- no unresolved ambiguity remains around section naming or tip/routing terminology
- glossary exists and is usable by implementation sprints
- guidance persistence and analytics hierarchy are frozen enough to build against

## Sprint 2 — Workspace Shell And Navigation Rewrite

**Goal**

Make the operating loop structurally real in the project workspace.

**Primary outcomes**

- shared workspace shell
- distinct semantics for major sections
- reduced navigation ambiguity

**Scope**

- introduce a project workspace shell
- replace overlapping loop links with section-specific framing
- ensure `Tips`, `Execute`, `Connections`, `Measure` read as distinct product areas
- align page-level intros and section summaries to the glossary

**Deliverables**

- project-level subnavigation
- shared summary/header pattern
- section framing content
- deep-linkable section selection if needed

**Suggested files**

- `src/app/dashboard/projects/[projectId]/page.tsx`
- `src/app/dashboard/insights/page.tsx`
- `src/app/dashboard/projects/[projectId]/integrations/page.tsx`
- `src/app/dashboard/projects/[projectId]/analytics/page.tsx`
- `src/components/projects/ProjectWorkspaceShell.tsx`
- `src/components/projects/ProjectLoopNav.tsx`

**Implementation notes**

- keep page boundaries if splitting is too large, but fix semantics immediately
- ensure project context remains visible while moving between loop sections
- rewrite page copy while restructuring

**Done criteria**

- operating loop labels no longer feel like aliases to the same destination
- users can predict where to inspect, edit, execute and measure
- primary navigation terminology matches the glossary

## Sprint 3 — Canonical Tip Experience And Related Actions

**Goal**

Make the canonical tip the real center of product action.

**Primary outcomes**

- richer tip card and detail experience
- saved related action suggestions
- saved related prompt suggestions
- clearer reasoning/evidence-to-action flow

**Scope**

- add derived related suggestions persistence under `suggestedRouting.derivedSuggestions`
- expose these suggestions in canonical tip list/detail payloads
- redesign tip detail to include:
  - why this exists
  - what to do now
  - what to do next around it
- make duplication preserve or recompute related suggestions correctly

**Deliverables**

- `relatedActionSuggestions`
- `relatedPromptSuggestions`
- richer canonical tip detail panel
- tip card state hierarchy aligned to glossary

**Suggested files**

- `src/lib/projects/project-tip-related-suggestions.ts`
- `src/lib/projects/project-tip.service.ts`
- `src/lib/projects/project-intelligence-types.ts`
- `src/app/api/projects/[projectId]/tips/[tipId]/route.ts`
- `src/app/api/projects/[projectId]/tips/route.ts`
- `src/app/dashboard/insights/page.tsx`
- `src/components/projects/ProjectTipCard.tsx`
- `src/components/projects/ProjectTipDetailPanel.tsx`
- `src/components/projects/RelatedActionSuggestions.tsx`

**Implementation notes**

- no raw JSON exposed in UI
- related actions must stay deterministic and actionable
- do not let the tip become an unstructured content dump

**Done criteria**

- every relevant canonical tip can show 2-3 adjacent actions
- duplication preserves intent coherence
- tip detail clearly connects signal, logic, action and next-step expansion

## Sprint 4 — Manual Routing UX And Execution State Clarity

**Goal**

Make routing feel like a natural extension of the tip, not a detached technical subsystem.

**Primary outcomes**

- manual routing editor
- clearer automation states
- clearer execution readability

**Scope**

- add routing editor controls to the tip editing flow
- surface routing policy and destination intent in understandable language
- show route/execution state with stronger summary semantics
- connect routing editor to project capabilities and destination availability

**Deliverables**

- tip-level routing editor
- improved automation state presentation
- route/execution timeline or readable history panel
- blocked-state explanations

**Suggested files**

- `src/app/dashboard/insights/page.tsx`
- `src/components/projects/ProjectTipEditor.tsx`
- `src/components/projects/ProjectTipRoutingEditor.tsx`
- `src/lib/projects/project-tip.service.ts`
- `src/lib/projects/project-intelligence-context.service.ts`

**Implementation notes**

- keep advanced payload diagnostics behind disclosure
- first-read UX should talk about outcome, not low-level schema
- preserve API-level flexibility for future route types

**Done criteria**

- users can edit routing intent without raw JSON
- users understand whether a tip is executable now and why
- execution state reads as product behavior, not backend ledger leakage

## Sprint 5 — Strategic Analytics Redesign

**Goal**

Upgrade analytics from reporting to decision support.

**Primary outcomes**

- strategic summary layer
- better cross-tool coherence
- explicit “what changed / why it matters / what next”

**Scope**

- redesign project analytics around the operating loop
- enrich interview/chatbot/visibility/site analytics with interpretation and action
- connect analytics outputs to canonical tips and execution surfaces where possible

**Deliverables**

- strategic analytics summary
- highest-risk / highest-opportunity / strongest-signal summary
- next-action layer on analytics views
- cross-tool signal map

**Suggested files**

- `src/components/analytics/ProjectAnalytics.tsx`
- `src/lib/analytics/AnalyticsEngine.ts`
- `src/app/dashboard/projects/[projectId]/analytics/page.tsx`
- `src/app/dashboard/bots/[botId]/analytics/analytics-view.tsx`
- `src/app/dashboard/bots/[botId]/analytics/ChatbotAnalyticsView.tsx`
- `src/app/dashboard/visibility/page.tsx`
- `src/components/analytics/StrategicAnalyticsSummary.tsx`
- `src/components/analytics/AnalyticsNextActions.tsx`
- `src/components/analytics/CrossToolSignalMap.tsx`
- `src/lib/analytics/strategic-analytics.ts`

**Implementation notes**

- avoid adding more charts unless they improve decisions
- define leading vs lagging indicators visually
- every analytics block should answer:
  - what changed
  - why it matters
  - what action to take

**Done criteria**

- analytics feel strategic and coordinated across tools
- users can identify priorities without reading raw metrics first
- analytics produce next actions, not only observations

## Sprint 6 — Guided Onboarding And Setup Assistance

**Goal**

Make the platform teach itself during setup and activation.

**Primary outcomes**

- dismissible guidance system
- project activation checklist
- contextual setup helpers

**Scope**

- implement guide state model
- add contextual popup/help guidance to:
  - project setup
  - first tool creation
  - first integration connection
  - first tip review/routing moment
- add a global disable toggle and a re-open entry point

**Deliverables**

- guidance layer
- popup/help components
- project activation checklist
- stateful dismissed/completed steps

**Suggested files**

- `src/components/guidance/GuidanceLayer.tsx`
- `src/components/guidance/GuidancePopup.tsx`
- `src/components/guidance/ProjectActivationChecklist.tsx`
- `src/components/guidance/GuideToggle.tsx`
- `src/lib/guidance/guidance-state.ts`
- `src/lib/guidance/guidance-rules.ts`
- `src/app/dashboard/layout.tsx`
- relevant project/tool setup pages

**Implementation notes**

- guidance must be assistive, not blocking
- copy must be concise, plain-language and glossary-compliant
- prefer local persistence first, with later option to sync to user settings

**Done criteria**

- first-use setup is meaningfully easier
- guide can be disabled globally
- guide can be re-opened manually
- help appears only when contextually relevant

## Sprint 7 — Copilot UX And Prompt Guidance

**Goal**

Make the Copilot feel like an active operator within the project workflow.

**Primary outcomes**

- related prompt variants
- section-aware quick prompts
- tip-aware Copilot assistance

**Scope**

- extend Copilot metadata with `suggestedPromptVariants`
- use one variant as fallback if no explicit `suggestedFollowUp` exists
- add context-aware prompt chips in the Copilot panel
- align Copilot quick actions with project section and tip context

**Deliverables**

- related prompt suggestion engine
- contextual chips
- section-aware onboarding/help prompts

**Suggested files**

- `src/app/api/copilot/chat/route.ts`
- `src/components/copilot/StrategyCopilot.tsx`
- `src/lib/copilot/prompt-suggestions.ts`
- `src/lib/projects/project-tip-related-suggestions.ts`

**Implementation notes**

- suggestions must remain scoped to user intent
- avoid generic “AI slop” prompt chips
- when no project is selected, suggestions should stay platform-level and safe

**Done criteria**

- Copilot suggests adjacent prompts without forcing user reformulation
- prompt suggestions feel grounded to the project or selected tip
- prompt chips remain understandable and low-noise

## Sprint 8 — Coherence Pass, Accessibility, Responsive And Release Hardening

**Goal**

Unify the experience and remove the last product-surface inconsistencies before rollout.

**Primary outcomes**

- visual coherence
- consistent microcopy
- responsive quality
- accessibility closure
- release-safe regression confidence

**Scope**

- visual and hierarchy pass across touched surfaces
- glossary compliance pass
- CTA and helper-text consistency pass
- keyboard, focus and mobile checks
- fallback branch labeling and cleanup

**Deliverables**

- final copy consistency pass
- accessibility fixes
- responsive fixes
- release checklist for Phase 6 rollout

**Suggested files**

- all major Phase 6 surfaces
- `docs/design/PRODUCT-LANGUAGE-GLOSSARY.md`
- `docs/design/MICROCOPY-GUIDELINES.md`
- optional rollout checklist doc

**Implementation notes**

- treat this sprint as quality closure, not backlog overflow
- anything structurally new discovered here should be pushed to a follow-up phase unless clearly blocking release

**Done criteria**

- platform language is self-explanatory and consistent
- mobile and keyboard flows remain usable
- visual system reads as one product narrative
- no critical UX contradictions remain across workspace, analytics, guidance and Copilot

## Cross-Sprint Dependencies

### Sprint 1 enables all later sprints

No downstream sprint should finalize labels or state naming before Sprint 1 glossary decisions are locked.

### Sprint 2 must land before full detail polish in Sprints 3-7

The workspace shell defines the semantic container for:

- tips
- analytics
- guidance
- Copilot context

### Sprint 3 and Sprint 4 are tightly coupled

Sprint 3 makes the canonical tip operationally rich.
Sprint 4 makes that richness executable.

### Sprint 5 should begin only after Sprint 1 hierarchy decisions

Analytics redesign depends on:

- agreed terminology
- agreed operating-loop narrative
- agreed action-state language

### Sprint 6 and Sprint 7 should share copy rules

Guidance and Copilot suggestions must read like the same product voice.

## Testing Strategy By Sprint

### Sprint 1

- documentation review
- naming consistency review

### Sprint 2

- navigation sanity
- empty state meaning
- mobile nav checks

### Sprint 3

- related suggestion generation tests
- tip detail rendering
- duplicate behavior verification

### Sprint 4

- routing editor interactions
- blocked-state behavior
- execution history readability

### Sprint 5

- analytics summary helper tests
- interpretation and next-action rendering
- regression on existing analytics APIs

### Sprint 6

- guidance state persistence
- dismiss / disable / re-open flows
- setup journey walkthroughs

### Sprint 7

- Copilot metadata tests
- suggestion chip rendering
- prompt relevance review

### Sprint 8

- full regression pass
- responsive pass
- accessibility pass
- microcopy review pass

## Exit Criteria

Phase 6 is complete when:

- the workspace loop is structurally real, not just named
- canonical tips are the product’s main unit of action
- routing can be understood and edited at the tip level
- related actions and prompt variants make the product feel multi-channel by default
- analytics feel strategic and action-oriented
- setup is assisted through a dismissible and useful guidance layer
- microcopy, labels and page framing are coherent and self-explanatory
- the platform visually reflects one product promise end to end

## Recommended Follow-Up After This Document

If execution starts immediately, the next planning layer should be:

1. one implementation doc per sprint for Sprint 1 and Sprint 2 first
2. glossary approval before UI code rewrite
3. first-release scope lock before Sprint 5 to avoid analytics sprawl
