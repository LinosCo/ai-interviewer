# Platform Refactor Phase 2 Sprint 5 — UI Cutover And Legacy Retirement

**Goal**

Finish the canonical UI cutover without losing functionality, then reduce dependence on legacy insight presentation.

## Problems This Sprint Resolves

- Insights page shows canonical tips, but still inherits legacy assumptions and partial fields
- routing overview still depends on mixed canonical/legacy semantics
- legacy fallback is necessary today, but there is no clear retirement path

## Files To Modify

- `src/app/dashboard/insights/page.tsx`
- `src/app/api/projects/[projectId]/tip-routing-overview/route.ts`
- optional new components under `src/components/projects/`

## Required Changes

### 1. Complete canonical tip presentation

Ensure the canonical tip UI can show:

- title
- summary
- reasoning
- strategy summary
- methodology summary
- evidence
- routes
- executions
- routing recommendation preview if available

### 2. Surface canonical create flow

Expose a minimal "new canonical tip" action in the UI if Sprint 2 API exists.

### 3. Retire legacy-only actions where canonical equivalents exist

Examples:

- editing through canonical `PATCH /tips/[tipId]`
- duplication through canonical endpoint

Do not remove legacy actions that still have no canonical replacement.

### 4. Define legacy retirement threshold

Document or encode the condition for removing legacy fallback:

- canonical tip coverage per project above agreed threshold
- canonical route/execution history available
- no blocking regressions in routing overview

## Verification

1. Users can view and edit canonical tips without consulting legacy insight detail.
2. Routing overview and insight cards stay consistent for the same project.
3. Fallback logic is still available only where canonical parity is not reached.

## Done Criteria

- canonical UI is complete enough for normal project usage
- legacy fallback is narrow and intentional
