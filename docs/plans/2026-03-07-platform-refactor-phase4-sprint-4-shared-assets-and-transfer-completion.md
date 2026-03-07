# Platform Refactor Phase 4 Sprint 4 — Shared Assets And Transfer Completion

**Goal**

Finish the shared-asset semantics of the platform so project transfer and integration readiness behave explicitly instead of optimistically.

## Problems This Sprint Resolves

- project transfer still handles shared canonical dependencies with warnings only
- methodology bindings are not part of the transfer completeness story
- integration readiness UI still presents scope as dedicated even when the system supports shared assets

## Files To Modify

- `src/lib/projects/project-transfer-completeness.service.ts`
- `src/lib/domain/workspace.ts`
- `src/components/integrations/ConnectionsTab.tsx`
- related integration list helpers if needed

## Required Changes

### 1. Return structured transfer completeness results

`syncTransferredProjectIntelligence()` should return a structured result describing:

- moved dedicated data sources
- shared data sources that require follow-up
- methodology bindings that remain attached to source organization assets
- any unresolved canonical dependencies

Do not rely on `console.warn` as the primary product behavior.

### 2. Include methodology dependencies in transfer completeness

Explicitly inspect `ProjectMethodologyBinding` and `MethodologyProfile`.

For shared or org-owned methodology assets:

- classify them
- report whether they remain valid after transfer
- define next actions or hook points

### 3. Make integration scope truthful in the UI

Readiness cards and integration summaries must show whether a connection is:

- dedicated
- shared
- healthy
- missing

Do not hardcode “Scope: dedicato al progetto” when that is not always true.

## Verification

1. Transfer flow returns actionable completeness data for shared assets.
2. Shared methodology dependencies are visible in transfer results.
3. Integration readiness UI correctly distinguishes shared versus dedicated scope.

## Done Criteria

- transfer semantics are explicit for canonical shared dependencies
- integration UI no longer misrepresents connection scope
