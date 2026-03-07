# Platform Refactor Phase 3 Sprint 1 — Hardening And Permission Closure

**Goal**

Close the integrity and authorization gaps that still make the canonical layer unsafe as a primary write surface.

## Problems This Sprint Resolves

- `ProjectTipGroundingService` still builds website-analysis and brand-report grounding from `projectIds[0]`
- `ProjectTipService.materializeGrounding()` still writes `strategySummary` into `methodologySummary`
- `PATCH /api/projects/[projectId]/tips/[tipId]` does not enforce project access
- `POST /api/projects/[projectId]/tips/[tipId]/duplicate` does not enforce project access
- `GET /api/projects/[projectId]/tip-routing-overview` still authorizes by organization membership instead of project access
- `POST /api/projects/[projectId]/tips` currently passes `EDITOR` to `assertProjectAccess()`, but `EDITOR` is not a valid workspace role

## Files To Modify

- `src/lib/projects/project-tip-grounding.service.ts`
- `src/lib/projects/project-tip.service.ts`
- `src/app/api/projects/[projectId]/tips/route.ts`
- `src/app/api/projects/[projectId]/tips/[tipId]/route.ts`
- `src/app/api/projects/[projectId]/tips/[tipId]/duplicate/route.ts`
- `src/app/api/projects/[projectId]/tip-routing-overview/route.ts`
- `src/lib/domain/workspace.ts`
- optional migration only if needed for strategy/methodology field separation

## Required Changes

### 1. Rebuild grounding per target project

For website analysis and brand report:

- stop resolving one grounding payload and then reusing it across all target projects
- resolve all target project IDs from the shared visibility config
- for each target project, rebuild:
  - strategy summary
  - methodology refs
  - methodology summary
  - tip strategic alignment when derived from project context
- materialize one project-specific payload per target project

Do not keep `projectIds[0]` anywhere in the grounding path.

### 2. Separate strategy and methodology semantics

Make the internal grounding payload explicit:

- `strategySummary`
- `methodologySummary`
- `methodologyRefsSummary`

If Prisma already has enough storage fields, reuse them.
If not, add the smallest additive schema change possible.

Rules:

- never write strategy text into `methodologySummary`
- never infer methodology summary from strategy fields
- if methodology summary is unavailable, keep it null rather than writing the wrong semantic

### 3. Enforce project access on every canonical mutation

Before any write:

- `POST /tips` must require a valid existing role from the workspace model
- `PATCH /tips/[tipId]` must assert project access before updating
- `POST /tips/[tipId]/duplicate` must assert project access before duplicating

Do not rely only on the route layer.
Also add a service-level guard for canonical mutations where reasonable, so route mistakes do not silently reopen the bug later.

### 4. Normalize required role for tip writes

Pick one valid role level and use it consistently.

Recommended:

- create or edit tip: `MEMBER`
- duplicate tip: `MEMBER`
- read tip: `VIEWER`

Do not introduce `EDITOR` unless you first add it to the actual access model across schema and workspace logic.

### 5. Fix routing overview authorization

In `tip-routing-overview/route.ts`:

- replace membership-based authorization with `assertProjectAccess(session.user.id, projectId, 'VIEWER')`
- stop resolving access by user email plus organization membership only
- keep the response shape unchanged for this sprint

## Verification

1. A shared visibility config linked to multiple projects produces project-specific canonical tips without context leakage.
2. `methodologySummary` never contains project positioning/value proposition text.
3. A user with org membership but without project access receives `403` on:
   - `PATCH /tips/[tipId]`
   - `POST /tips/[tipId]/duplicate`
   - `GET /tip-routing-overview`
4. `POST /tips` compiles and uses a real workspace role.
5. `tsc --noEmit` no longer reports Phase 3 sprint specific type errors from these routes/services.

## Done Criteria

- no shared-source grounding leakage remains
- canonical tip semantics are not conflated
- canonical write routes are permission-safe
- role usage is consistent with the real access model
