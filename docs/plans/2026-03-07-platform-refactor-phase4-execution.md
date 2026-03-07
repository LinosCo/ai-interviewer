# Platform Refactor Phase 4 Execution

**Date:** 2026-03-07
**Status:** Draft
**Depends on:** `docs/plans/2026-03-07-platform-refactor-phase3-execution.md`

## Goal

Phase 4 closes the gap between the canonical architecture and the actual product behavior.

The primary objective is no longer introducing new models. It is making the platform trustworthy:

- Copilot must respect project permissions and read canonical project intelligence
- canonical routing and execution state must be written by real operational flows
- canonical tips must become the real source of truth for analysis and assistance
- explainability must be first-class, not only raw evidence rows
- shared assets and transfers must behave explicitly and safely
- the project workspace must stay project-scoped end to end

## Why This Phase Exists

Phase 3 improved grounding and access around canonical tips, but the review confirms that important product-level gaps still remain:

- Copilot still builds `projectContext` with an organization-level lookup instead of `assertProjectAccess`
- Copilot still reads AI tips from legacy `CrossChannelInsight` and visibility tip actions, not from canonical `ProjectTip`
- `ProjectTipRoute` and `ProjectTipExecution` still have no real write paths in the routing executor
- canonical explainability is still partial: `strategySummary` is computed but not persisted or exposed
- transfer completeness for shared dependencies is still warning-based
- some project workspace and integration surfaces still describe the experience as project-scoped while routing users through global or shared-agnostic flows

## Sprint Documents

- `docs/plans/2026-03-07-platform-refactor-phase4-sprint-1-copilot-access-and-canonical-context.md`
- `docs/plans/2026-03-07-platform-refactor-phase4-sprint-2-canonical-routing-ledger-implementation.md`
- `docs/plans/2026-03-07-platform-refactor-phase4-sprint-3-canonical-tip-explainability.md`
- `docs/plans/2026-03-07-platform-refactor-phase4-sprint-4-shared-assets-and-transfer-completion.md`
- `docs/plans/2026-03-07-platform-refactor-phase4-sprint-5-project-scoped-workspace-and-navigation.md`
- `docs/plans/2026-03-07-platform-refactor-phase4-sprint-6-canonical-cutover-and-build-health.md`

## Exit Criteria

Phase 4 is complete when:

- Copilot cannot read project summaries without project-level access
- Copilot uses canonical project intelligence as its default project context
- canonical routes and executions are written by real routing flows
- canonical tip detail exposes strategy context, methodology context, evidence and reviewer analysis distinctly
- project transfer returns explicit results for shared canonical dependencies instead of warning-only behavior
- the project workspace no longer bounces users into global pages for project-level loop steps
- TypeScript is clean for the platform refactor surface, and canonical flows are testable end to end
