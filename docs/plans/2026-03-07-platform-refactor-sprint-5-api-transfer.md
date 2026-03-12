# Platform Refactor Sprint 5 — APIs And Transfer Completeness

> For a lower-capability model: expose canonical reads first. Do not replace the old Insights UI yet.

**Goal**

Add stable project-scoped APIs for the canonical model and extend project transfer so the new entities remain consistent.

## Files To Create

- `src/app/api/projects/[projectId]/intelligence-context/route.ts`
- `src/app/api/projects/[projectId]/tips/route.ts`
- `src/app/api/projects/[projectId]/tips/[tipId]/route.ts`
- `src/app/api/projects/[projectId]/tips/[tipId]/duplicate/route.ts`
- `src/app/api/projects/[projectId]/tips/[tipId]/executions/route.ts`
- `src/lib/projects/project-transfer-completeness.service.ts`

## Files To Modify

- `src/lib/domain/workspace.ts`

## Global Rules

1. Every new route must assert project access.
2. Every route must stay project-scoped.
3. Do not change the behavior of existing legacy APIs in this sprint.

## Task 1: `GET /intelligence-context`

Use `ProjectIntelligenceContextService.getContext()`.

Requirements:

- require authenticated session
- resolve current user
- assert access with `assertProjectAccess`
- return a serializable context object only

## Task 2: `GET /tips`

Use `ProjectTipService.listProjectTips()`.

Requirements:

- return canonical tips only
- allow optional query params for `status` and `starred`
- do not fall back to legacy rows in this route

## Task 3: `GET /tips/[tipId]`

Use `ProjectTipService.getProjectTip()`.

Requirements:

- include evidence, revisions, routes, and executions
- 404 if the tip is not in the specified project

## Task 4: `PATCH /tips/[tipId]`

Use `ProjectTipService.updateTip()`.

Allowed editable fields:

- `title`
- `summary`
- `reasoning`
- `strategicAlignment`
- `category`
- `contentKind`
- `executionClass`
- `starred`
- `status`
- `recommendedActions`
- `suggestedRouting`

Do not allow direct patching of:

- `organizationId`
- `projectId`
- `originType`
- `originId`
- `originFingerprint`

## Task 5: `POST /tips/[tipId]/duplicate`

Use `ProjectTipService.duplicateTip()`.

Required behavior:

- duplicate the base tip
- duplicate evidence rows
- do not duplicate execution history
- append a revision note on the new tip saying it was duplicated

## Task 6: `GET /tips/[tipId]/executions`

Return only execution rows for that tip in descending `startedAt`.

## Task 7: Project Transfer Completeness

Create `project-transfer-completeness.service.ts` with one exported function:

```ts
export async function syncTransferredProjectIntelligence(params: {
  projectId: string;
  targetOrganizationId: string;
}): Promise<void>
```

It must update:

- `ProjectTip.organizationId`
- `DataSource.organizationId` only for `DEDICATED` sources bound exclusively to that project

It must preserve as-is:

- `ProjectStrategy`
- `ProjectMethodologyBinding`
- `ProjectDataSourceBinding`
- `ProjectTipEvidence`
- `ProjectTipRevision`
- `ProjectTipRoute`
- `ProjectTipExecution`

For `SHARED` data sources in this sprint:

- do not clone automatically yet
- log them for manual follow-up
- keep bindings intact

Then call the new function from `moveProjectToOrganization()` after the base project move succeeds.

## Verification

Run:

```bash
npx tsc --noEmit
```

Then manually verify:

- `GET /api/projects/[projectId]/tips`
- `GET /api/projects/[projectId]/tips/[tipId]`
- project transfer still completes for a project with canonical tips

## Done Criteria

- canonical read APIs exist
- patch and duplicate endpoints exist
- transfer updates canonical org-scoped rows
- no legacy route removed
