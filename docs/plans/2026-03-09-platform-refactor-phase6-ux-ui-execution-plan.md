# Platform Refactor Phase 6 — UX/UI Execution Plan

**Date:** 2026-03-09
**Status:** Completed (execution verified on 2026-03-09)
**Scope:** Detailed execution plan for Phase 6 UX Rewrite, extending the general blueprint and the earlier Sprint 6 UI cutover notes.
**Sprint execution:** `docs/plans/2026-03-09-platform-refactor-phase6-execution.md`

## 1. Goal

Phase 6 must turn the current partial canonical cutover into a coherent product experience.

The target outcome is:

- the project workspace is organized around one operating loop
- the canonical `ProjectTip` is the main operational object
- users can move from evidence to decision to execution without changing page semantics
- AI tips expose related next-step actions, not only the primary recommendation
- the Copilot can suggest follow-up prompts that stay within the same strategic intent
- the platform is intuitive enough that a first-time user can understand what to do next without reading documentation
- analytics become strategic decision surfaces, not only reporting surfaces
- the product visually expresses the promise of a project intelligence and activation platform

This phase includes the general blueprint requirements plus three additional UX-functional requirements:

1. **AI Tip related actions**
   Every canonical tip should surface `2-3` related suggested actions/CTAs in addition to the primary action flow.

2. **Manual routing editing**
   Tip editing must support manual routing adjustments at the tip level, not only title/status edits.

3. **Copilot related prompt suggestions**
   The Copilot must propose follow-up prompts with similar intent and adjacent outcomes, not only a single generic follow-up.

4. **Guided project setup and tool creation**
   The platform must include a disattivabile guidance layer with contextual popup/help messages that assist the user while configuring a project and creating tools.

5. **Strategic analytics upgrade**
   Tool analytics must become more actionable, comparative and strategically legible, not just descriptive.

6. **Text and microcopy review**
   The platform must be made more self-explanatory through a systematic review of labels, helper text, empty states, CTA copy and nomenclature, avoiding unnecessary English terms when Italian is clearer.

## 2. Phase 6 Product Decision

For Phase 6, related suggestions should be persisted inside the canonical tip, but without adding a new dedicated DB column unless later justified by product scale.

Recommended persistence strategy:

- store derived related suggestions under `ProjectTip.suggestedRouting.derivedSuggestions`

Rationale:

- no Prisma migration required
- suggestions remain attached to the canonical tip lifecycle
- suggestions stay available in list/detail/edit contexts
- existing APIs already expose `suggestedRouting`
- future UI can read them without reshaping the contract again

Do **not** put this into `sourceSnapshot`.

Reason:

- `sourceSnapshot` should remain provenance/evidence-oriented
- related CTAs are product guidance, not source data

Do **not** overload `recommendedActions` for this phase.

Reason:

- `recommendedActions` already carries heterogeneous payloads from Copilot, website analysis and legacy materialization
- changing its shape would create avoidable compatibility risk

## 3. UX/UI Review Of Current State

This review is grounded in the currently shipped surfaces:

- `src/app/dashboard/insights/page.tsx`
- `src/app/dashboard/projects/[projectId]/page.tsx`
- `src/app/dashboard/projects/[projectId]/integrations/page.tsx`
- `src/components/copilot/StrategyCopilot.tsx`
- `src/app/dashboard/layout.tsx`

### 3.1 Information architecture is still semantically fragmented

Current issues:

- the project cockpit shows the operating loop labels (`Overview`, `Listen`, `Tips`, `Execute`, `Measure`, `Strategy`, `Connections`) but several entries route to the same pages
- `Listen`, `Tips`, and `Strategy` currently collapse into `Insights`
- `Execute` and `Connections` currently collapse into `Integrations`

Impact:

- the IA promises a strategic operating loop but the navigation still behaves like a historical dashboard
- users cannot predict where editing, routing, execution logs and strategic interpretation live

### 3.2 Canonical tip editing is incomplete

Current issues:

- canonical tips can be duplicated
- canonical tip editing exists only for basic textual fields and status/starred
- `suggestedRouting` is patchable at API level but not editable in the current tip editor
- related CTAs and adjacent suggested actions are absent

Impact:

- the tip is visually central but operationally still incomplete
- “tip as unit of action” is only partially true

### 3.3 Routing is still separated from tip intent

Current issues:

- routing configuration lives mainly in the Integrations area
- the tip detail shows route/execution history but not a routing composer
- users still need to mentally bridge “why this tip matters” and “where this goes”

Impact:

- execution feels detached from evidence
- routing remains a technical subsystem instead of a natural next step

### 3.4 AI tips stop too early

Current issues:

- a tip can describe the primary content/action
- there is no persistent UI-ready representation of related amplification/distribution actions
- the system does not naturally suggest “what should happen around this tip”

Impact:

- tips feel single-channel
- the product promise of coordinated execution is underdelivered

### 3.5 Copilot prompt loop is too narrow

Current issues:

- the current chat metadata only supports one `suggestedFollowUp`
- quick actions are generic and mostly global
- the Copilot does not expose a structured set of related prompt variants around the same intent

Impact:

- the user must manually reformulate adjacent requests
- the Copilot under-leverages the strategic continuity between content, distribution and optimization

### 3.6 Visual hierarchy is informative but not decision-first

Current issues:

- the Insights experience already contains many useful badges and counts
- however users must infer priority, readiness and next step from multiple low-level labels
- automation state is still badge-heavy instead of action-oriented

Impact:

- scanability is acceptable
- decisiveness is weaker than the backend model now supports

### 3.7 Accessibility and usability gaps to close in Phase 6

Based on the current surfaces, Phase 6 should explicitly address:

- duplicated destinations behind different operating-loop labels
- overreliance on badge semantics without summary text
- missing explicit relationship between tip state and available actions
- weak keyboard-first affordances in multi-action tip cards and Copilot suggestion chips
- mobile risk from crowded card headers and stacked action rows

### 3.8 Analytics are still mostly descriptive, not decisional

Current issues:

- project analytics are framed as a general dashboard but still read as a collection of isolated metrics
- analytics blocks emphasize counts and charts but weakly answer:
  - what matters most now
  - what changed
  - why it matters
  - what to do next
- individual tool analytics remain too separated:
  - interview analytics
  - chatbot analytics
  - visibility analytics
  - CMS/site analytics
- there is not yet a coherent strategic layer that ties these together around business questions

Impact:

- users can observe numbers without understanding their operational implications
- analytics do not fully support prioritization
- the platform promise of “decide and activate” is not yet visible in analytics UX

### 3.9 The platform still expects too much user self-navigation

Current issues:

- there is no embedded product guidance layer for first-time or low-confidence users
- project setup, integrations, tool creation and early activation depend on the user understanding the product model
- the experience lacks contextual “why this step matters” explanations
- there is no persistent but user-respectful way to assist onboarding inside the workspace

Impact:

- setup friction is higher than necessary
- users can configure tools without understanding strategic sequence
- the product looks more powerful than approachable

### 3.10 The current visual system does not yet fully embody the product promise

Current issues:

- several pages still feel like separate admin modules rather than parts of one operating system
- pages vary in hierarchy, narrative framing and action density
- there is not yet a consistent visual grammar for:
  - signal
  - recommendation
  - execution readiness
  - outcome

Impact:

- the product promise is present in copy but weaker in visual structure
- the user perceives modules before perceiving the operating model

### 3.11 Text, labels and nomenclature are not yet coherent enough

Current issues:

- different pages still describe similar concepts with different names
- some labels are clear only to internal/product-native users
- helper text is inconsistent in depth and tone
- empty states often explain what is missing, but not what the user should do next
- some English terms remain where Italian wording would be more intuitive for the target audience
- some English terms are appropriate and already naturalized in product usage, but there is no explicit rule for when to keep them

Examples of terminology risk:

- `Tips`, `Insights`, `Actions`, `Routing`, `Execute`, `Connections` can overlap semantically if not sharply defined
- technical wording can leak into first-read UX before the user understands the business meaning

Impact:

- the platform requires more interpretation than necessary
- users can misread the purpose of sections and actions
- the product sounds less coherent than the underlying operating model actually is

## 4. Phase 6 Experience Principles

All design and implementation choices in this phase must follow these principles:

1. **One tip, one center of gravity**
   A canonical tip is where evidence, reasoning, related actions, routing and execution converge.

2. **Suggest the next move, not only the current object**
   Every tip should answer:
   - what this is
   - why it exists
   - what to do now
   - what to do next around it

3. **Multi-channel by default**
   If a tip is suitable for site content, the experience should naturally suggest adjacent distribution/support actions.

4. **Technical complexity stays behind progressive disclosure**
   Routing rules, destination refs and execution payloads must be visible when needed, but not dominate the first-read UX.

5. **The project workspace must feel like an operating system**
   The product must feel like one continuous loop, not a set of disconnected tools.

6. **The platform should teach itself while being used**
   Guidance should be contextual, lightweight, dismissible and useful at the exact moment of setup or decision.

7. **Analytics must conclude with action**
   Every major analytics surface should end with priorities, interpretation and next recommended moves.

8. **Visual language should reinforce the product promise**
   Signals, strategy, actions and outcomes must look like parts of one system, not four different subsystems.

9. **Language must explain the product by itself**
   Labels, helper text, CTAs and empty states should help the user understand what the platform is doing and why it matters without requiring documentation or prior product fluency.

10. **Use Italian by default, keep only established product English**
   Avoid English terms unless they are already widely used and clearer in Italian product context, such as `analytics`, `chatbot`, `brand`, `prompt`, `routing` only where replacing them would create more confusion than clarity.

## 5. Target Phase 6 Information Architecture

Phase 6 should formalize the project workspace around these sections:

1. `Overview`
2. `Listen`
3. `Tips`
4. `Execute`
5. `Measure`
6. `Strategy`
7. `Connections`

Implementation rule:

- these may be separate pages, tabs, or a hybrid workspace shell
- but each label must map to distinct user meaning and distinct content blocks
- no label should exist only as a renamed link to another legacy screen without contextual differentiation

### Recommended shell behavior

- persistent project-level subnavigation
- page-level summary bar with project name, active section, tip counts, automation readiness
- deep-linkable states for:
  - selected tip
  - editor open
  - routing panel open
  - execution log open

## 6. Required New UX Capabilities

### 6.1 AI Tip related suggested actions

For each canonical tip, add a derived suggestion bundle:

- `relatedActionSuggestions`: 2-3 saved actions
- `relatedPromptSuggestions`: 2-3 saved prompt variants

Examples:

- if the main tip is a new site article:
  - create a LinkedIn post about it
  - create an email teaser/newsletter variant
  - extract 3 related FAQ items from the same content

- if the main tip is a FAQ/schema/page optimization:
  - update the core page copy
  - create a LinkedIn educational post
  - open a deeper blog/article expansion

- if the main tip is a social/LinkedIn asset:
  - connect it to a site page/article
  - create a nurture email
  - formalize FAQ or chatbot coverage from the same topic

These suggestions are:

- derived from `contentKind`, `category`, routing context, tip copy and recommended actions
- persisted under `suggestedRouting.derivedSuggestions`
- recalculated on create/update/duplicate/materialization

### 6.2 Manual routing editing at tip level

The Phase 6 tip editor must allow:

- inspecting current suggested routing
- changing or overriding destination intent
- selecting manual/approval/auto execution mode when relevant
- reviewing related action suggestions before saving

This is not raw JSON editing.

Required editor capabilities:

- destination type selector
- route policy mode selector
- optional destination references
- derived suggestion preview
- save/reset behavior

### 6.3 Copilot related prompt suggestions

The Copilot should generate a prompt suggestion set for the current request:

- one primary follow-up
- 2-3 additional prompt variants with the same strategic intent

Examples:

- user asks for a site article
  - “Crea anche un post LinkedIn collegato”
  - “Trasforma questo contenuto in una email teaser”
  - “Estrai FAQ da questo contenuto”

- user asks to improve a page
  - “Suggerisci anche un post social di supporto”
  - “Prepara una variante newsletter coerente”
  - “Trova 3 query FAQ da coprire con questa modifica”

Phase 6 UX should display these as contextual Copilot chips.

For pre-Phase-6 backend readiness:

- the API should already emit structured prompt variants in metadata

### 6.4 Guided usage layer

Add a product guidance system to assist users in:

- creating a project
- selecting the right tool type
- configuring integrations
- creating the first interview/chatbot/visibility setup
- understanding what the next recommended action is

The guidance system must be:

- contextual to page and project state
- dismissible
- re-openable
- stateful
- non-blocking by default

Required guidance patterns:

- popup/welcome message for first relevant visit
- inline step explainer for complex configuration screens
- checklist for “project activation”
- contextual explainer tied to empty states
- optional “why this matters” helper copy on key setup actions

Disabling behavior:

- user can disable the guide globally
- user can dismiss a single step/card without disabling the whole system
- system should remember preferences

### 6.5 Strategic analytics upgrade

Each analytics area must be upgraded from “reporting” to “decision support”.

Required changes across analytics:

- show trend + interpretation + recommended action together
- distinguish lagging indicators from leading indicators
- connect metrics to tool outputs and business implications
- surface cross-tool relationships
- explain anomalies and opportunities in plain language

Examples:

- interview analytics should show not only sentiment/themes, but what messaging, offer or process decision is implied
- chatbot analytics should show not only gap counts and volumes, but likely friction points, lost-conversion patterns and what content/process should be adjusted
- visibility analytics should connect brand visibility signals to content/routing actions and channel priorities
- project analytics should summarize the full operating loop:
  - what signals changed
  - what actions were produced
  - what was executed
  - what improved or degraded

## 7. Phase 6 Workstreams

## Workstream A — Workspace IA rewrite

**Goal**

Make the project workspace structurally match the operating loop.

**Deliverables**

- project workspace shell
- distinct section entry points
- shared header/summary bar
- deep-linkable section state

**Primary files**

- `src/app/dashboard/projects/[projectId]/page.tsx`
- `src/app/dashboard/insights/page.tsx`
- `src/app/dashboard/projects/[projectId]/integrations/page.tsx`
- optional new components under `src/components/projects/`

**Acceptance criteria**

- no loop label routes to an ambiguous or semantically overloaded destination without section-specific framing
- `Tips` is clearly distinct from `Listen`
- `Execute` is clearly distinct from `Connections`

## Workstream B — Canonical tip workspace

**Goal**

Make the canonical tip the central object for action.

**Deliverables**

- richer tip card
- structured tip detail panel
- canonical editor
- duplicate flow
- related actions block

**Required tip detail sections**

1. Summary
2. Reasoning
3. Strategic alignment
4. Methodology summary
5. Evidence
6. Suggested related actions
7. Suggested prompt variants
8. Suggested routing
9. Executions/history

**Acceptance criteria**

- a user can inspect and edit a tip without jumping to a legacy insight flow
- related suggested actions are visible in detail and editor contexts

## Workstream C — Tip routing UX

**Goal**

Move routing from a detached technical tab to a tip-centric action flow.

**Deliverables**

- routing composer inside tip detail/editor
- explicit automation state
- execution status timeline
- link from tip to connection validation where needed

**Minimum states**

- manual only
- ready to route
- awaiting approval
- automated
- completed
- failed

**Acceptance criteria**

- a user understands if a tip can be executed now
- a user can inspect why routing is blocked
- a user can override/update routing intent manually

## Workstream D — Copilot phase 6 UX

**Goal**

Make the Copilot a contextual operator around the active tip and active project section.

**Deliverables**

- section-aware starter prompts
- tip-aware prompt variants
- multi-chip related prompt suggestions
- improved empty/opening state per project context

**Required behavior**

- if a tip is selected, Copilot suggestions should inherit its strategic domain
- if the user asks for one asset, Copilot should suggest adjacent assets with similar purpose
- if the project is in multi-project mode, prompt suggestions should stay generic and avoid false specificity

**Acceptance criteria**

- the Copilot suggests adjacent prompts without requiring user reformulation
- prompt chips remain grounded to project/tip context

## Workstream E — Language and narrative alignment

**Goal**

Align UX copy with the product promise from landing and blueprint.

**Copy rules**

- emphasize grounded project intelligence
- emphasize coordinated execution
- emphasize measurable outcomes
- avoid legacy framing as mainly a qualitative research suite

**Acceptance criteria**

- workspace language reads as one strategic operating model

## Workstream E.1 — Text, microcopy and nomenclature review

**Goal**

Make the platform self-explanatory through a coordinated content design pass.

**Deliverables**

- nomenclature audit across major product areas
- canonical terminology glossary
- rewritten labels and section headings
- CTA rewrite
- helper text rewrite
- empty state rewrite
- onboarding/guidance microcopy system
- tone and terminology rules for future features

**Areas in scope**

- dashboard navigation
- project workspace section names
- insights/tips/execute/connections language
- analytics labels and interpretations
- integration setup copy
- Copilot helper copy
- empty states, inline descriptions and popup guidance text

**Content design rules**

1. Use one canonical name for each core concept.
2. Prefer business meaning before technical meaning.
3. Every empty state should answer:
   - what is missing
   - why it matters
   - what to do next
4. Every setup screen should include short “why this matters” helper text.
5. Avoid unnecessary English words where a natural Italian alternative is clearer.
6. Keep only already naturalized or product-standard English terms where replacing them would reduce clarity.
7. Avoid label inflation: short labels, clearer supporting text.
8. Use consistent verb forms in CTAs across the product.

**Recommended nomenclature normalization**

- define whether `Tip` stays canonical in UI or becomes a paired form like `Tip operativi`
- distinguish clearly:
  - `Segnali`
  - `Tip`
  - `Esecuzione`
  - `Connessioni`
  - `Risultati`
- define approved usage for:
  - `analytics`
  - `chatbot`
  - `brand`
  - `prompt`
  - `routing`
  - `workspace`

**Acceptance criteria**

- section names are coherent across pages
- similar actions use similar wording
- setup, empty states and CTAs are understandable without prior platform knowledge
- English terms are used intentionally, not by default

## Workstream F — Strategic analytics redesign

**Goal**

Turn analytics into coordinated strategic decision surfaces.

**Deliverables**

- analytics IA review across project, interview, chatbot, visibility and CMS/site analytics
- unified metric hierarchy
- “what matters now” summary layer
- comparison and trend interpretation blocks
- action-oriented insight panels connected to canonical tips and Copilot

**Required analytics upgrades**

1. Project analytics
   - move from generic “virtuous cycle analytics” to strategic operating loop dashboard
   - add summary blocks for:
     - strongest signal
     - biggest risk
     - biggest opportunity
     - recommended next action

2. Tool analytics
   - interviews: quality, friction, objections, decision themes
   - chatbot: unresolved intent, lead quality, conversion blockers, knowledge debt
   - visibility: prompt coverage, topic share, source quality, trend deltas
   - CMS/site: traffic quality, search intent match, content performance, weak pages by opportunity

3. Cross-tool analytics
   - connect observed themes to created tips
   - connect created tips to routed/executed actions
   - connect executed actions to outcome movement where measurable

**Acceptance criteria**

- analytics clearly answer “so what?” and “what next?”
- analytics surfaces are coherent across tools
- strategic actions are not visually detached from metrics

## Workstream G — Guided onboarding and in-product assistance

**Goal**

Reduce setup friction and make the product self-explanatory during real use.

**Deliverables**

- dismissible guidance layer
- project activation checklist
- page-specific coachmarks/popup helpers
- configurable “guide on/off” preference
- optional re-open entry point in header/help area

**Recommended guidance architecture**

- global preference:
  - `enabled`
  - `dismissedSteps`
  - `completedCheckpoints`
- local persistence first:
  - `localStorage`
- optional Phase 6.1 extension:
  - sync to user settings for cross-device continuity

**Initial guidance coverage**

1. Project created but no tools
2. First interview creation
3. First chatbot creation
4. First visibility setup
5. First integration connection
6. First canonical tip review/edit/route action

**Acceptance criteria**

- the guide helps without blocking normal use
- the user can disable it completely
- the guidance reflects real project state, not generic static tips

- the guidance copy is clear, concise and non-technical

## Workstream H — Visual system and UX coherence pass

**Goal**

Make the platform visually answer the product promise.

**Deliverables**

- unified design grammar for signal, recommendation, execution, outcome
- consistent action hierarchy across dashboard surfaces
- harmonized page intros, empty states and section framing
- clearer visual relationship between analytics, tips, routing and Copilot

**Design rules**

- signal blocks should look observative
- tip/recommendation blocks should look decisive
- execution blocks should look operational
- outcome blocks should look evaluative

**Acceptance criteria**

- users perceive one product narrative across pages
- page visuals reinforce strategic flow, not module fragmentation

## Workstream I — Accessibility and responsive quality

**Goal**

Ship the Phase 6 rewrite without creating accessibility debt.

**Required checks**

- keyboard access for tip cards, editor actions, routing actions and Copilot prompt chips
- visible focus states
- mobile readability of status/action clusters
- action density reduction on narrow screens
- semantic headings and panel labeling

## 8. Backend And Data Requirements

Phase 6 UX depends on these backend/data contracts.

### 8.1 Canonical tip derived suggestions

Add or finalize a suggestion engine that computes:

- `primaryContentKind`
- `relatedActionSuggestions`
- `relatedPromptSuggestions`

Persist at:

- `ProjectTip.suggestedRouting.derivedSuggestions`

Recompute on:

- manual tip creation
- Copilot tip creation
- legacy-to-canonical materialization
- duplication
- update when any of these change:
  - title
  - summary
  - contentKind
  - category
  - executionClass
  - recommendedActions
  - suggestedRouting

### 8.2 Tip editing API

Phase 6 editor should continue using:

- `PATCH /api/projects/[projectId]/tips/[tipId]`

But the UI must explicitly support:

- editing non-JSON routing intent fields
- previewing derived suggestions after edits

### 8.3 Copilot metadata contract

Extend Copilot response metadata with:

- `suggestedFollowUp`
- `suggestedPromptVariants: string[]`
- optional `promptSuggestionSource`

Rule:

- if the model does not provide a `FOLLOW_UP`, fallback to the first generated prompt variant

### 8.4 Copilot tools

Canonical tip tools should expose `suggestedRouting` consistently in list/detail responses where relevant so the Copilot can reason about saved related suggestions.

## 9. UI Component Plan

Recommended new components:

- `src/components/projects/ProjectWorkspaceShell.tsx`
- `src/components/projects/ProjectLoopNav.tsx`
- `src/components/projects/ProjectTipBoard.tsx`
- `src/components/projects/ProjectTipCard.tsx`
- `src/components/projects/ProjectTipDetailPanel.tsx`
- `src/components/projects/ProjectTipEditor.tsx`
- `src/components/projects/ProjectTipRoutingEditor.tsx`
- `src/components/projects/RelatedActionSuggestions.tsx`
- `src/components/projects/CopilotPromptSuggestions.tsx`
- `src/components/guidance/GuidanceLayer.tsx`
- `src/components/guidance/GuidancePopup.tsx`
- `src/components/guidance/ProjectActivationChecklist.tsx`
- `src/components/guidance/GuideToggle.tsx`
- `src/components/analytics/StrategicAnalyticsSummary.tsx`
- `src/components/analytics/AnalyticsNextActions.tsx`
- `src/components/analytics/CrossToolSignalMap.tsx`

Recommended backend/helper files:

- `src/lib/projects/project-tip-related-suggestions.ts`
- `src/lib/copilot/prompt-suggestions.ts`
- `src/lib/guidance/guidance-state.ts`
- `src/lib/guidance/guidance-rules.ts`
- `src/lib/analytics/strategic-analytics.ts`
- `docs/design/PRODUCT-LANGUAGE-GLOSSARY.md`
- `docs/design/MICROCOPY-GUIDELINES.md`

## 10. Proposed Execution Sequence

### Step 0 — UX audit freeze

- document final IA decisions
- freeze naming for workspace sections
- freeze action state terminology
- define content design review scope and glossary owner

### Step 1 — Data readiness

- finalize derived suggestion persistence in canonical tips
- expose derived suggestions through API/service snapshots
- extend Copilot metadata with prompt variants
- define guidance state model and disabled preference behavior
- define canonical product glossary and approved terminology map

### Step 2 — Workspace shell and navigation

- introduce project workspace shell
- separate `Tips`, `Execute`, `Connections` semantics
- add deep-linkable section state
- normalize section labels and explanatory copy

### Step 3 — Analytics redesign foundations

- define strategic analytics hierarchy
- add summary/priority/next-action logic to major analytics views
- align tool analytics semantics across modules
- rewrite analytics labels, interpretations and “next action” copy

### Step 4 — Tip detail and editor rewrite

- create canonical detail panel
- add related action suggestions
- add prompt suggestion block
- add manual routing editor

### Step 5 — Execution integration

- connect routing editor to project capabilities
- show route readiness and failures in a clear state model
- expose execution history in a readable timeline/table hybrid

### Step 6 — Guided onboarding layer

- implement dismissible guidance layer
- add project activation checklist
- add contextual setup popups on project/tool flows
- align guidance text with glossary and microcopy rules

### Step 7 — Copilot UX integration

- contextual prompt chips
- tip-aware follow-ups
- section-aware opening states

### Step 8 — Visual system, responsive, a11y, and copy polish

- visual coherence pass across workspace and analytics
- keyboard pass
- mobile pass
- contrast/focus pass
- copy alignment pass
- final microcopy consistency pass across key user journeys

## 11. Detailed Acceptance Criteria

Phase 6 is done only when all are true:

1. The project workspace clearly expresses the operating loop.
2. The canonical tip is the default action surface.
3. Tip detail includes related suggested actions and prompt variants.
4. Tip editor supports manual routing edits without raw JSON.
5. Duplicating a tip preserves or recalculates related suggestions correctly.
6. Copilot emits related prompt variants and can use one as fallback follow-up.
7. Routing status is explicit and understandable without reading raw technical badges.
8. Analytics surfaces are more strategic, comparative and action-oriented.
9. The in-product guide assists project/tool setup and can be disabled.
10. Visual language across major product areas feels coherent and coordinated.
11. Mobile and keyboard flows remain usable.
12. Labels, CTAs, helper text and empty states are self-explanatory and terminology is consistent.

## 12. Verification Plan

### Manual scenarios

1. Open a project and understand where `Listen`, `Tips`, `Execute`, and `Connections` differ.
2. Open a canonical site-content tip and verify 2-3 related suggested actions appear.
3. Duplicate the tip and confirm suggestions remain coherent.
4. Edit the tip and manually change routing intent.
5. Save the tip and confirm derived suggestions update accordingly.
6. Ask the Copilot for a content action and verify it returns prompt variants with similar scope.
7. Ask the Copilot for a non-content action and verify prompt variants remain relevant, not generic spam.
8. Verify the project/tool setup guide appears contextually and can be disabled.
9. Verify the guide can be re-opened manually.
10. Verify analytics surfaces produce explicit next actions, not only metrics.
11. Test mobile layout on tip cards/detail/editor actions.
12. Review glossary compliance on primary pages and verify unnecessary English wording has been removed or justified.

### Automated coverage

Add tests for:

- derived suggestion generation by `contentKind`
- recomputation on tip update
- duplication preserving suggestion integrity
- Copilot prompt suggestion generation
- API serialization of `suggestedRouting.derivedSuggestions`
- guidance preference persistence and disabled state handling
- analytics summary derivation / strategic action blocks where pure helpers exist
- nomenclature helper/formatter tests where terminology mapping logic exists

## 13. Risks And Mitigations

### Risk 1 — IA changes become too large

Mitigation:

- ship a shared workspace shell first
- keep page boundaries if needed, but fix semantics immediately

### Risk 2 — Routing editor leaks raw technical complexity

Mitigation:

- expose destination and policy controls first
- move low-level payloads behind expandable diagnostics

### Risk 3 — Suggestion engine becomes noisy

Mitigation:

- cap related actions at 3
- prefer deterministic templates over vague generative recommendations
- store only actionable suggestions

### Risk 4 — UI shows canonical and legacy states together confusingly

Mitigation:

- isolate fallback rendering branches
- visually label legacy fallback when used

### Risk 5 — Guidance becomes noisy or patronizing

Mitigation:

- show it only when contextually relevant
- allow full disable
- use short, action-oriented copy
- decay repeated prompts after dismissal

### Risk 6 — Analytics become heavier but not clearer

Mitigation:

- prioritize hierarchy over metric density
- require each analytics section to state:
  - what changed
  - why it matters
  - what to do next
- move lower-level detail behind expandable sections

### Risk 7 — Copy cleanup becomes subjective and inconsistent

Mitigation:

- create a glossary and approved terminology list first
- review high-traffic journeys before long-tail screens
- define when English is acceptable and when Italian is required
- centralize recurring CTA and helper wording patterns

## 14. Recommendation

Phase 6 should be treated as a **product-surface rewrite**, not a cosmetic pass.

The main success criterion is not “the page looks cleaner”.

The main success criterion is:

**a user can understand, adapt, distribute, route and measure a canonical tip without leaving the same mental model.**

That is also the correct place to integrate:

- AI tip related CTA suggestions
- manual routing editing
- Copilot related prompt suggestions
- strategic analytics redesign
- dismissible guided setup/onboarding layer
- text, microcopy and nomenclature review

because all three are UX multipliers on top of the canonical model, not isolated backend tasks.
