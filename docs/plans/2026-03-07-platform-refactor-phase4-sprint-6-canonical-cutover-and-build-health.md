# Platform Refactor Phase 4 Sprint 6 — Canonical Cutover And Build Health

**Goal**

Prepare the platform for a credible canonical cutover by removing the remaining refactor-surface build issues and tightening fallback rules.

## Problems This Sprint Resolves

- the repo still fails `tsc --noEmit`
- at least one open type error remains in the phase-3 Copilot path
- canonical and legacy surfaces still coexist without a strict retirement threshold

## Files To Modify

- `src/lib/copilot/chat-tools.ts`
- `src/app/api/organizations/route.ts`
- `src/app/api/platform-settings/regenerate-marketing-kb/route.ts`
- `src/lib/training/training-service.ts`
- any final cutover config files or docs needed

## Required Changes

### 1. Fix phase-refactor surface type errors first

Start with errors introduced or kept open by the refactor surface, especially:

- Copilot canonical/legacy dual-write typing
- any route typings touched by phase 3 or 4

### 2. Clear remaining repository type errors

Resolve the known unrelated `tsc` blockers so that build health stops masking refactor regressions.

### 3. Define canonical cutover threshold

Document and encode the conditions under which legacy fallback can be removed for a project:

- canonical tip coverage
- canonical routing ledger coverage
- explainability coverage
- Copilot canonical-read coverage

### 4. Add a release checklist

Create a concise operator checklist for production cutover:

- schema state
- backfill status
- routing ledger verification
- Copilot permission verification
- project transfer smoke check
- UI navigation smoke check

## Verification

1. `tsc --noEmit` passes.
2. Canonical refactor flows no longer hide behind repo-wide type noise.
3. A clear cutover checklist exists for removing legacy fallbacks incrementally.

## Done Criteria

- build health is restored
- canonical cutover can be managed intentionally instead of opportunistically
