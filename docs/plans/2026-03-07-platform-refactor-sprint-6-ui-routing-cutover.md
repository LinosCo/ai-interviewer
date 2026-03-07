# Platform Refactor Sprint 6 — UI And Routing Cutover

> For a lower-capability model: cut over reads, not writes. Legacy generation can remain in place until parity is confirmed.

**Goal**

Expose the canonical tips to users and stop inferring routing coverage only from legacy JSON blobs.

## Files To Modify

- `src/app/api/projects/[projectId]/tip-routing-overview/route.ts`
- `src/app/dashboard/insights/page.tsx`

## Optional New UI Files

- `src/components/projects/ProjectTipList.tsx`
- `src/components/projects/ProjectTipDetail.tsx`

If creating new components is slower than editing the existing page, keep the UI change inside the existing page.

## Global Rules

1. Read from canonical `ProjectTip` first.
2. Keep the legacy fallback only if canonical data is empty.
3. Do not remove any legacy route or legacy table dependency in this sprint.

## Task 1: Update Routing Overview API

In `tip-routing-overview/route.ts`:

- use canonical `ProjectTip` counts by `category` and `contentKind` when canonical tips exist
- use `ProjectTipRoute` and `ProjectTipExecution` for draft/routed/executed history when available
- keep current fallback logic to `BrandReport.aiTips`, `WebsiteAnalysis.recommendations`, and `CMSSuggestion` only if canonical rows are absent

Required precedence:

1. canonical tips
2. brand report tips
3. website analysis recommendations

## Task 2: Update Insights UI

In `src/app/dashboard/insights/page.tsx`:

- fetch canonical tips for the selected project
- render canonical title, status, priority, evidence count, route count
- show source/origin label
- keep existing actions only if they still make sense

### Minimum detail panel fields

- title
- summary
- reasoning
- strategic alignment
- methodology summary
- evidence list
- routes
- execution history

## Task 3: Editing UX

Allow manual editing through the canonical `PATCH /tips/[tipId]` endpoint.

Minimum editable fields in UI:

- title
- summary
- reasoning
- strategic alignment
- starred
- status

Do not expose raw JSON editing for `sourceSnapshot` in this sprint.

## Task 4: Routing UX

If the current page already has routing actions, repoint them to canonical tip routes when possible.

Minimum requirement:

- show whether a tip is unrouted, planned, dispatched, or completed
- show number of executions
- show available destination types from project capabilities

Do not redesign the whole page in this sprint.

## Verification

Manual checks:

1. a project with canonical tips shows them in Insights
2. editing a canonical tip updates the page
3. routing overview counts match canonical tips when canonical data exists
4. legacy fallback still works for projects not yet materialized

## Done Criteria

- project insights UI can read canonical tips
- routing overview prefers canonical data
- manual editing works on canonical tips
- legacy fallback remains available
