# Platform Refactor Phase 2 Sprint 1 — Grounding And Tip Shape

**Goal**

Fix canonical tip grounding correctness and persist the full canonical tip shape needed by routing, filtering, and explainability.

## Problems This Sprint Resolves

- `ProjectTipGroundingService` builds website-analysis and brand-report payloads using only the first target project strategy/methodology context
- `ProjectTipService.materializeGrounding()` does not persist `contentKind`, `executionClass`, `suggestedRouting`, or lifecycle-adjacent fields needed by the canonical UI and routing overview
- `methodologySummary` is currently populated with strategy summary text

## Files To Modify

- `src/lib/projects/project-intelligence-types.ts`
- `src/lib/projects/project-tip-grounding.service.ts`
- `src/lib/projects/project-tip.service.ts`

## Required Changes

### 1. Separate strategy summary from methodology summary

Add two distinct fields to the internal grounding payload:

- `strategySummary`
- `methodologySummary`

Do not overload one into the other.

If the Prisma model needs a new field for this split, add it in a small additive migration before changing service logic.

### 2. Build per-project grounding for shared visibility sources

Replace the current `projectIds[0]` pattern.

For website analysis and brand report:

- resolve all target projects
- for each target project, rebuild:
  - strategy summary
  - methodology refs
  - methodology summary
- do not reuse a payload built for project A when materializing project B

### 3. Persist the full canonical tip shape

`materializeGrounding()` must persist when present:

- `contentKind`
- `executionClass`
- `suggestedRouting`
- `approvalMode`
- `draftStatus`
- `routingStatus`
- `publishStatus`
- `starred`

On update:

- preserve existing values only when the new payload does not specify them
- do not blindly null fields that legacy materializers still cannot infer

### 4. Improve origin mapping

When materializing from website analysis and brand report:

- populate `category` whenever it is explicit in source data
- populate `contentKind` only when source data makes it explicit
- avoid fake inference if confidence is low

## Verification

1. One shared visibility config linked to two projects produces two canonical tips with project-specific strategy/methodology summaries.
2. Canonical tips no longer default to empty routing fields when source data includes them.
3. Tip detail UI shows methodology summary and strategy alignment without semantic mix-up.

## Done Criteria

- no more first-project grounding leakage
- full canonical tip shape is persisted where known
- strategy and methodology summaries are no longer conflated
