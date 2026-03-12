# Platform Refactor Phase 3 Sprint 6 — Unified Project Intelligence UI

**Goal**

Replace the current mixed legacy/canonical experience with one coherent project workspace organized around the strategic operating loop.

## Problems This Sprint Resolves

- the current dashboard still reflects the history of the codebase more than the product promise
- insights, automations, strategy and integrations are still spread across pages with mixed semantics
- canonical tips exist, but the user journey around them is still partial

## Files To Modify

- `src/app/dashboard/insights/page.tsx`
- `src/app/dashboard/projects/[projectId]/page.tsx`
- `src/app/dashboard/projects/[projectId]/integrations/page.tsx`
- optional new components under `src/components/projects/`
- optional route helpers for aggregated project workspace data

## Required Changes

### 1. Reorganize the project workspace around the operating loop

Recommended information architecture:

- `Overview`
- `Listen`
- `Tips`
- `Execute`
- `Measure`
- `Strategy`
- `Connections`

Do not ship all seven as separate pages if that is too large.
But the screen structure and empty states must clearly express this loop.

### 2. Make the tip the central operational object

From one canonical tip detail or card, the user should be able to:

- inspect evidence and logic
- edit it
- duplicate it if multiple automation variants are needed
- see suggested routes
- send it to routing
- inspect executions

Avoid bouncing the user through legacy insight flows when the canonical tip already exists.

### 3. Add explicit automation state

Every tip card/detail should surface:

- manual only
- ready to route
- awaiting approval
- automated
- completed
- failed

Do not force the user to infer this from multiple low-level badges.

### 4. Narrow legacy fallback

Keep legacy fallback only where canonical parity is still missing.

For each fallback branch:

- document the condition
- isolate it in code
- avoid mixing canonical and legacy states in one UI fragment unless clearly labeled

### 5. Align page language with landing promise

UI copy should reinforce:

- project strategy
- AI tips grounded on project data
- automations and routing
- measurable execution outcomes

Avoid older product language that frames the product mainly as a qualitative research suite.

## Verification

1. A user can go from project context to tip inspection to automation execution without changing mental model.
2. Canonical tips are the primary interaction surface in the workspace.
3. Legacy fallback paths are limited and intentional.
4. The dashboard narrative is aligned with the landing and product promise.

## Done Criteria

- the product experience feels like one strategic operating system, not several historical modules
- canonical tips become the main unit of action across UX
