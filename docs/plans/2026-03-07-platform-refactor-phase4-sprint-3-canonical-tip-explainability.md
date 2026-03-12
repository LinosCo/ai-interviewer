# Platform Refactor Phase 4 Sprint 3 — Canonical Tip Explainability

**Goal**

Turn canonical tips into explainable strategic objects, not just records with raw evidence arrays.

## Problems This Sprint Resolves

- `strategySummary` is computed in grounding but not persisted or exposed in tip APIs
- tip detail still exposes only raw fields, evidence, revisions, routes and executions
- there is no canonical place for reviewer notes or analyst interpretation

## Files To Modify

- `prisma/schema.prisma` if a small additive field is needed
- `src/lib/projects/project-intelligence-types.ts`
- `src/lib/projects/project-tip.service.ts`
- `src/app/api/projects/[projectId]/tips/[tipId]/route.ts`
- `src/app/dashboard/insights/page.tsx`

## Required Changes

### 1. Persist strategy context separately

Add or expose a distinct canonical field for project strategy summary.

Rules:

- do not overload `strategicAlignment`
- do not overload `methodologySummary`
- if storage changes are required, keep the migration additive and small

### 2. Add explainability view to tip detail

Extend the detail response with a deterministic explainability block:

- `whyThisTip`
- `projectInputsUsed`
- `strategyContext`
- `methodologyContext`
- `automationRecommendation`

Build this from canonical fields and evidence.
Do not generate free-form AI explanations in this sprint.

### 3. Add reviewer notes

Introduce a canonical reviewer or analyst note surface that is:

- editable
- revisioned
- returned by tip detail
- readable by Copilot in the next sprint

### 4. Surface explainability in the UI

In the canonical tip detail UI, show clearly:

- strategic context
- methodology context
- source evidence
- reviewer notes
- routing recommendation

## Verification

1. Tip detail distinguishes strategy context from methodology context.
2. Reviewer notes can be saved and reloaded.
3. A user can inspect why a tip exists without reading raw JSON blobs.

## Done Criteria

- canonical tips become auditable by humans
- explainability is explicit and usable in the UI and API
