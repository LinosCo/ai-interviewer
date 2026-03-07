# Platform Refactor Phase 3 Sprint 3 — Tip Explainability And Analysis

**Goal**

Make every canonical tip inspectable and trustworthy enough for human review before automation.

## Problems This Sprint Resolves

- a tip can exist without a clear explanation of where it came from
- evidence is present, but the UI and API do not yet expose a complete analysis surface
- users still cannot comfortably validate source logic before editing or routing a tip

## Files To Modify

- `src/lib/projects/project-intelligence-types.ts`
- `src/lib/projects/project-tip.service.ts`
- `src/app/api/projects/[projectId]/tips/[tipId]/route.ts`
- `src/app/dashboard/insights/page.tsx`
- optional new components under `src/components/projects/`

## Required Changes

### 1. Expand canonical tip detail shape

Tip detail must clearly expose:

- title
- summary
- status and lifecycle flags
- reasoning
- strategic alignment
- strategy summary
- methodology summary
- methodology refs
- source snapshot
- recommended actions
- suggested routing
- evidence list
- revision history
- route history
- execution history

If some fields already exist in the model but are not returned by the API, expose them now.

### 2. Add explainability grouping

Build a derived explainability view in the detail response:

- `why_this_tip`
- `project_inputs_used`
- `methodology_used`
- `automation_recommendation`
- `human_review_notes`

This can be derived server-side from the existing canonical record and evidence.
Do not generate new AI text in this sprint.
Use deterministic composition only.

### 3. Improve evidence fidelity

Evidence rows should distinguish:

- source type
- source label
- source entity reference
- detail
- metric value and unit

Where source references are known but currently missing from grounding, add them.
Do not invent missing source IDs.

### 4. Support manual analytical notes

Add a lightweight editable field for reviewer notes or analyst notes on a tip.

Requirements:

- stored canonically
- revisioned
- visible in tip detail
- separate from model-generated reasoning

This can be implemented as:

- a dedicated field on `ProjectTip`, or
- a structured extension inside revision snapshots if you want to avoid a migration

Pick the option that keeps retrieval simple for Copilot in Sprint 4.

## Verification

1. A canonical tip detail response contains enough information for a human to answer:
   - why was this tip generated
   - from which project sources
   - with which methodology
   - toward which automation
2. Evidence rows preserve labels and source references when available.
3. Analyst notes can be added and later retrieved from the tip detail screen.

## Done Criteria

- canonical tips are explainable, not just stored
- users can inspect logic before routing
- Copilot has a richer deterministic tip context to read in the next sprint
