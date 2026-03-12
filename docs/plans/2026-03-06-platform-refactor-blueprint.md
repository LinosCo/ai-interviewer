# Platform Refactor Blueprint

**Date:** 2026-03-06
**Status:** Draft

## 1. Product Promise To Preserve

Business Tuner is not a collection of disconnected AI tools.
Its canonical promise is:

**listen -> decide -> execute -> measure**

In product terms this means:

- gather project signals from interviews, chatbots, visibility, analytics and connected systems
- interpret them through project strategy and methodology
- turn them into explainable, editable operational tips
- route approved tips into concrete workflows and publishing systems
- measure outcomes and feed the next iteration

The platform should therefore behave like an **operating system for project intelligence and activation**, not like a dashboard with unrelated modules.

## 2. Main Product Problem Today

The current product evolved by adding modules over time:

- interviews
- chatbots
- visibility / brand monitoring
- CMS suggestions
- AI tips
- routing
- copilot
- training

Each piece has value, but the user experience and the codebase no longer express one coherent model.

Current symptoms:

- the landing positions the product as a continuous strategic cycle, while some internal pages still present it as an interview/qualitative research suite
- organization is treated as the real container, while project often behaves like a weak filter
- AI tips have multiple generation paths and no single lifecycle
- Copilot is used as a compensating layer to explain or finish workflows the UI should already make clear
- routing and automations exist, but they are not the natural continuation of the AI tip lifecycle

## 3. Refactor Principles

1. The **project** is the real unit of strategy, context, analysis and activation.
2. The **organization** is the workspace, billing, governance and methodology container.
3. Every AI tip must be a **first-class entity** with provenance, explainability, editability and routing state.
4. Copilot must operate on the same canonical model used by the UI and backend jobs.
5. Automations must be attached to a stable lifecycle, not bolted onto ad hoc endpoints.
6. UX must expose one dominant workflow, with progressive detail only when needed.

## 4. Canonical Domain Model

### Organization

Organization should own:

- billing and credits
- members and permissions
- shared methodology knowledge bases
- shared automation templates
- shared connection pools when intentionally reusable
- cross-project governance views, always filtered by the projects accessible to the current user

Organization should **not** be the primary strategic brain for execution.
That belongs to the project.

### Project

Project should own:

- strategic identity
- data scope
- bindings to shared or dedicated data sources
- active brands / websites / channels
- AI tips
- automation routing
- execution history
- project-specific knowledge and memory

Each project needs a true strategic layer, not only two free-text fields.

### Proposed Project Strategy Layer

Introduce a structured project strategy model with at least:

- positioning
- value proposition
- target audiences
- strategic goals
- priority outcomes / KPIs
- key offers / services / entities
- constraints / tone / exclusions
- editorial and channel priorities
- project-level methodology overrides or selected methodology profiles

### Project Transfer Semantics

Project transfer is already a supported platform behavior and should be treated as an invariant to preserve during the refactor, not as a new feature.

Today the codebase already provides a project move flow that transfers the project to a target organization, reassigns project ownership inside the target organization and recalculates project access from the target organization memberships.

The refactor should formalize and complete this behavior so that, when a project is transferred between organizations:

- the project strategic layer moves with it
- the project AI tips, revisions, routing state and execution history move with it
- the project-owned data and content artifacts move with it
- the project integrations and automation configuration move with it
- project users and memberships do **not** move with it

In other words, a project transfer is a transfer of the project operating context, not of the source organization user base.

This principle already matches the current product intent. The refactor work is mainly to make the rule explicit, comprehensive and reliable across every project-scoped entity, especially newer AI tips, routing and shared-source models.

For shared assets, the transfer logic must distinguish between:

- **dedicated assets**: move them directly with the project
- **shared assets**: preserve continuity for both sides by cloning or splitting bindings

Examples of shared assets that may need clone/split behavior:

- data sources linked to multiple projects
- shared CMS connections
- shared MCP connections
- methodology profiles reused across projects

Transfer rule for shared sources and integrations:

- if the asset is used only by the transferred project, move it
- if the asset is also used by other projects in the source organization, create an equivalent asset or cloned binding in the target organization for the transferred project
- the source organization must retain continuity for its remaining projects
- the transferred project must retain continuity of data, routing and execution history

This implies transfer-safe entities need:

- ownership mode: dedicated vs shared
- provenance metadata
- clone/split support for bindings and connection references

## 5. Knowledge Architecture

### Canonical Knowledge Inputs For A Project

Every AI tip and every Copilot reasoning step should interpolate these four blocks:

1. **Project signals**
   - interviews
   - chatbot conversations and knowledge gaps
   - visibility / brand monitoring
   - SEO / GSC / GA
   - CMS / commerce / content performance
   - existing AI tips and execution history

2. **Project strategy**
   - project strategic profile
   - project goals
   - project constraints
   - target channels and priorities

3. **Methodology knowledge**
   - organization-level methodological KBs
   - selected KB profile relevant to the use case
   - optional project-level refinements

4. **Connected systems context**
   - active integrations
   - automation capabilities
   - routable destinations
   - approval requirements

### Shared Sources And Access Control

Data sources must not be assumed to belong to only one project.

The canonical model should support:

- one source linked to one or many projects
- one project consuming one or many sources
- per-binding metadata, for example relevance, role, primary/secondary status and channel intent
- permission-filtered retrieval based on the projects accessible to the current user

This means the platform needs a source binding layer, for example:

- `DataSource`
- `ProjectDataSourceBinding`

Copilot and AI tip generation should read:

- the current project by default
- other accessible projects only when explicitly requested, or when the user asks for cross-project comparison or reusable learnings

They must never read or infer from projects the user cannot access.

### Methodology Direction

The methodology KB should not be a single generic text blob.
It should support named profiles, for example:

- strategic marketing
- SEO / GEO / LLMO
- stakeholder research
- content operations
- ecommerce optimization
- brand recovery / reputation

Each project can attach one primary profile plus optional secondary profiles.

## 6. Canonical AI Tip Model

Create a single persisted entity, for example `ProjectTip`, with:

- id
- organizationId
- projectId
- title
- summary
- status
- priority
- category
- contentKind
- executionClass
- sourceType
- sourceSnapshot
- evidence
- reasoning
- strategicAlignment
- methodologyRefs
- recommendedActions
- suggestedRouting
- approvalMode
- draftStatus
- routingStatus
- publishStatus
- lastEditedBy
- createdBy
- createdAt
- updatedAt

### Required Tip Behaviors

Every tip must:

- show its sources
- show the reasoning path
- show why it fits project strategy
- show which methodology rules influenced it
- be editable manually
- be editable via Copilot
- be routable to one or many destinations
- be duplicable / forkable when the same strategic intent needs multiple automation variants
- retain revision history

### Tip Lifecycle

Suggested lifecycle:

`new -> reviewed -> approved -> drafted -> routed -> automated -> completed -> archived`

`starred` should be treated as an orthogonal flag, not as a lifecycle step.

If an approved tip is fully automated and activated successfully, it can be marked `completed` while still remaining starred for reuse or visibility.

This replaces the current fragmented mix of virtual tips, insights, CMS suggestions and social dispatch states.

## 7. Copilot Role

The Strategic Copilot should become the **orchestrator of the project intelligence model**, not a side assistant.

It should remain an organization-level assistant, but its effective data scope must always be restricted to the projects accessible to the current user.

It must be able to:

- read all project data sources
- read the project strategy layer
- read the selected methodology KBs
- read existing tips and their execution state
- reference patterns, reusable learnings and operational connections across other accessible projects when relevant and requested
- create new tips
- edit existing tips
- explain why a tip exists
- propose routing
- inspect existing routing rules
- configure integrations where allowed
- assist the user in creating n8n agents and workflows
- test and list connected destinations

### Copilot Output Contract

When operating on tips, Copilot should always return:

- what it read
- which sources it used
- what it changed or created
- which automations are available
- which automation it recommends
- what still requires manual approval

## 8. Automation And Routing Model

### Canonical Routing

Routing must be attached to the tip entity itself, not reconstructed later.

Each tip should carry:

- eligible destinations
- suggested destination
- routing policy
- approval mode
- payload preview

One tip may generate multiple routing bindings and multiple execution records.
Duplication is only needed when the user wants a branched variant of the same tip with different content, logic or destination-specific edits.

### Routing Destination Types

- CMS publish target
- WordPress / WooCommerce action
- SEO / schema / GEO intervention
- n8n workflow
- webhook event
- internal backlog / task system

### Routing Rules

Routing rules should be human-readable and validated:

- trigger scope
- content kind / category
- destination
- approval required
- transformation template
- fallback behavior

No raw `mcpTool` or internal taxonomy should be necessary in the primary UX.

### Automation State Model

Separate these events clearly:

- tip_created
- tip_updated
- draft_ready
- routing_requested
- routing_executed
- content_pushed
- content_published
- measurement_updated

This will make n8n, webhooks and audit logs much more coherent.

## 9. UX / UI Information Architecture

### Primary Navigation Should Follow The Promise

The product should be organized around the cycle:

1. Listen
2. Decide
3. Execute
4. Measure

Not around the implementation history of modules.

### Proposed Project Workspace Structure

For a selected project:

- Overview
- Listen
- Tips
- Execute
- Measure
- Strategy
- Connections
- Settings

### Screen Intent

**Overview**
- project status
- active signals
- top priorities
- blocked automations
- recent outcomes

**Listen**
- interviews
- chatbot
- visibility
- analytics
- data freshness and coverage

**Tips**
- canonical queue of explainable AI tips
- filters by status, source, priority, routing readiness
- manual edit and Copilot edit

**Execute**
- drafts
- routing policies
- pending approvals
- automation runs
- publish state

**Measure**
- outcome metrics by tip / action / channel
- learning loop back into strategy and tips

**Strategy**
- project strategy profile
- methodology profile selection
- key goals
- governance notes

**Connections**
- GA
- GSC
- WordPress
- WooCommerce
- Voler CMS
- n8n
- webhooks

### UX Rules

- never hide core workflow behind Copilot-only guidance
- never use “modifica” for actions that also create/persist downstream objects
- expose explainability first, not implementation jargon first
- progressive disclosure for advanced routing details
- default to approval-first flows for impactful automations

## 10. Suggested Technical Refactor

### Phase 1: Canonical Models

- introduce `ProjectTip`
- introduce `ProjectStrategyProfile`
- introduce `MethodologyProfile` + project attachments
- introduce `DataSource` + `ProjectDataSourceBinding`
- introduce `TipRevision`
- introduce `TipRoutingExecution`

### Phase 2: Unified Grounding

- create a single `ProjectGroundingService`
- centralize retrieval of project signals, strategy, methodology and integration capabilities
- enforce access-filtered retrieval for current project and optional cross-project comparisons
- make every generator depend on this service

### Phase 3: Unified Tip Generation

- replace current fragmented generators with adapters that all output `ProjectTip`
- stop generating virtual tips in read-time aggregation
- preserve explicit `contentKind`, `category`, `routing hints` and explainability at creation time

### Phase 4: Draft And Routing

- make CMS drafts a child step of approved tips
- make routing an explicit action on a tip
- align webhook/n8n events with the new lifecycle

### Phase 5: Copilot Alignment

- make Copilot read/write only the canonical models
- expose tip editing, routing listing and integration testing as first-class actions
- add project-aware methodology prompts

### Phase 6: UX Rewrite

- rebuild project navigation around the cycle
- merge the current insights / suggestion / routing fragmentation
- separate strategic review from execution plumbing

## 11. Features Worth Adding

### A. Tip Explainability Panel

For each tip:

- source timeline
- evidence snippets
- strategy mapping
- methodology rules applied
- affected channels
- proposed outcome metric

### B. Project Memory

A persistent project memory layer with:

- glossary
- strategic decisions taken
- important exclusions
- channel rules
- recurring stakeholder truths

This improves Copilot consistency over time.

### C. Automation Playbooks

Prebuilt recipes per goal:

- publish content from high-confidence SEO tip
- create FAQ from recurring chatbot gap
- alert on brand visibility drop
- push ecommerce optimization to WooCommerce
- send editorial brief to n8n / Slack / Notion

### D. Approval Policies

Allow project-level approval modes:

- manual always
- manual for high-impact only
- auto for low-risk content
- auto to draft, manual to publish

### E. Outcome Learning Loop

After routing or publish, the system should learn:

- what happened
- whether the action executed
- whether performance improved
- whether similar tips should be prioritized more or less

## 12. Product Alignment Recommendation

The landing, the product IA and the backend model should all tell the same story:

**Business Tuner is a project intelligence and activation platform.**

Not:

- just a research tool
- just a chatbot suite
- just a visibility monitor
- just a copilot
- just an automation layer

Those are capabilities.
The product is the operating model that connects them.

## 13. Immediate Next Step

The strategic decisions above are now translated into a Phase 1 execution document:

- `docs/plans/2026-03-06-platform-refactor-phase1-execution.md`

Implementation should now proceed in this order:

1. confirm the project as the canonical strategic unit
2. approve the unified `ProjectTip` lifecycle
3. approve the project strategy + methodology model
4. implement the additive Phase 1 schema and service layer

Once these are fixed, the code refactor and UX rewrite become much simpler and much safer.
