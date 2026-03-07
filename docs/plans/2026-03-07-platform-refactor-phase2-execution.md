# Platform Refactor Phase 2 Execution

**Date:** 2026-03-07
**Status:** Draft
**Depends on:** `docs/plans/2026-03-06-platform-refactor-phase1-execution.md`

## Goal

Phase 2 completes the canonical model introduced in Phase 1.

It exists to fix the remaining structural gaps:

- incorrect grounding when one visibility source fans out to multiple projects
- incomplete canonical tip shape persistence
- missing canonical route and execution writes
- incomplete canonical creation flow for manual tips
- inconsistent project access enforcement in route-related APIs
- incomplete transfer semantics for shared assets
- partial UI cutover that still depends on legacy assumptions

## Sprint Documents

- `docs/plans/2026-03-07-platform-refactor-phase2-sprint-1-grounding-and-tip-shape.md`
- `docs/plans/2026-03-07-platform-refactor-phase2-sprint-2-canonical-tip-write-paths.md`
- `docs/plans/2026-03-07-platform-refactor-phase2-sprint-3-routing-and-execution-state.md`
- `docs/plans/2026-03-07-platform-refactor-phase2-sprint-4-access-transfer-shared-assets.md`
- `docs/plans/2026-03-07-platform-refactor-phase2-sprint-5-ui-cutover-and-legacy-retirement.md`

## Exit Criteria

Phase 2 is complete when:

- every canonical tip is grounded with the correct project strategy and methodology context
- canonical tips persist all fields needed by routing and UI
- canonical route and execution tables are actively written and readable
- manual tip creation is available through the canonical API
- route-related APIs enforce project-level access, not only organization membership
- project transfer no longer leaves shared canonical dependencies in an ambiguous state
- Insights and routing UI can prefer canonical data without losing historical behavior
