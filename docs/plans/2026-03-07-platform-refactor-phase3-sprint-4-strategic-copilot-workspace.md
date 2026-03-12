# Platform Refactor Phase 3 Sprint 4 — Strategic Copilot Workspace

**Goal**

Turn Copilot into the organization-level assistant you described, with project-scoped grounding, cross-project awareness under permission boundaries, and real canonical tip operations.

## Problems This Sprint Resolves

- Copilot can already create canonical tips, but it is not yet clearly grounded on the full project intelligence context
- project strategy, canonical tips, sources and methodology are not yet assembled into one reliable assistant context
- Copilot does not yet have a first-class action surface for editing canonical tips or listing relevant routing options

## Files To Modify

- `src/lib/copilot/system-prompt.ts`
- `src/lib/copilot/chat-tools.ts`
- `src/app/api/copilot/chat/route.ts`
- `src/lib/projects/project-intelligence-context.service.ts`
- optional new Copilot support files under `src/lib/copilot/`

## Required Changes

### 1. Define Copilot scope explicitly

Copilot is organization-level, but with permission-bounded visibility.

Required behavior:

- if the user is working inside one project, default to that project's full intelligence context
- if the user asks for comparison, reuse, patterns or references across projects, include only accessible projects
- never leak inaccessible project names, tips or patterns

### 2. Feed Copilot the canonical project intelligence context

Copilot context for one project must include:

- project strategy
- methodology profiles bound to the project
- data source bindings
- canonical tips
- routing capabilities
- recent route and execution history
- analyst notes from Sprint 3

Do not assemble this ad hoc in the prompt.
Use a stable server-side context builder.

### 3. Add canonical tip management tools

Copilot needs tools to:

- create a canonical tip
- update a canonical tip
- duplicate a canonical tip when multiple automation variants are needed
- list candidate routing destinations for a tip
- explain why a routing destination is or is not available

Use the canonical service layer, not legacy insight mutation paths, for these operations whenever possible.

### 4. Add automation planning assistance

Copilot must be able to help the user:

- understand active integrations
- understand missing integrations
- list routable destinations for a given tip
- explain which steps are needed before automation can run

For this sprint, planning assistance is enough.
Do not automate browser setup or OAuth flows inside Copilot.

## Verification

1. Copilot answers about one project using that project's strategy, tips, methodology and sources.
2. Copilot can compare patterns across accessible projects only when relevant or explicitly requested.
3. Copilot can edit an existing canonical tip without going through legacy insight tooling.
4. Copilot can explain which routing destinations are available for a tip and why.

## Done Criteria

- Copilot is grounded on canonical project intelligence
- cross-project references obey permission boundaries
- canonical tip operations are available directly to the assistant
