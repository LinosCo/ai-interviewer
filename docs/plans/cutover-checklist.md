# Platform Refactor — Canonical Cutover Checklist

> Use this checklist to determine when legacy fallbacks can be safely removed for a project.
> This is a per-project evaluation, not a global flag.

---

## Canonical Cutover Threshold (per project)

A project is **canonical-ready** when ALL of the following are true:

| Area | Threshold | Source |
|------|-----------|--------|
| Tip coverage | `ProjectTip` records exist for the project (`project_tip` table) | DB query |
| Routing ledger | At least one `TipRoutingExecution` record exists for the project | DB query |
| Explainability | Tips have `whyThisTip` or `strategyContext` populated | DB query |
| Copilot canonical read | `ProjectTipService.listCopilotTips` returns results for the project | API call |
| Transfer integrity | `ProjectDataSourceBinding` rows reference correct org after any transfer | DB query |

---

## Pre-Cutover Schema State Check

Run before removing legacy fallback code:

```sql
-- Check for canonical tips
SELECT COUNT(*) FROM "ProjectTip" WHERE "projectId" = '<id>' AND "organizationId" = '<org>';

-- Check routing ledger
SELECT COUNT(*) FROM "TipRoutingExecution" WHERE "projectId" = '<id>';

-- Check explainability coverage
SELECT COUNT(*) FROM "ProjectTip"
WHERE "projectId" = '<id>'
AND ("whyThisTip" IS NOT NULL OR "strategyContext" IS NOT NULL);

-- Check orphaned data sources
SELECT COUNT(*) FROM "DataSource" ds
JOIN "ProjectDataSourceBinding" b ON b."dataSourceId" = ds.id
WHERE b."projectId" = '<id>'
AND ds."organizationId" != '<target_org>';
```

---

## Production Cutover Checklist

### 1. Schema State
- [ ] All Prisma migrations applied: `prisma migrate deploy`
- [ ] `ProjectTip`, `TipRoutingExecution`, `TipRoutingRoute`, `ProjectDataSourceBinding`, `ProjectMethodologyBinding` tables exist
- [ ] No pending migration drift: `prisma migrate status` shows all applied

### 2. Backfill Status
- [ ] Legacy `CrossChannelInsight` actions backfilled to `ProjectTip` (script: `scripts/phase1/`)
- [ ] `organizationId` set on all `ProjectTip` rows (no nulls)
- [ ] Transferred projects: `ProjectTip.organizationId` matches target org

### 3. Routing Ledger Verification
- [ ] `TipRoutingExecution` populated for at least one tip per active project
- [ ] `TipRoutingRoute` has entries referencing real channel/destination pairs
- [ ] Write path: `createStrategicTipCreationTool` using `canonical_dual_write` or `canonical_only` mode

### 4. Copilot Permission Verification
- [ ] `assertProjectAccess` called before all tip reads (not `assertOrganizationAccess` alone)
- [ ] `ProjectTipService.listCopilotTips` returns correct project-scoped results
- [ ] Copilot chat-tools `writeMode` environment variable set to `canonical_dual_write` in staging

### 5. Project Transfer Smoke Check
- [ ] Run `moveProjectToOrganization` on a test project
- [ ] Verify `syncTransferredProjectIntelligence` result: `hasUnresolvedDependencies: false`
- [ ] Verify `ProjectTip` rows moved to target org
- [ ] Verify dedicated `DataSource` rows moved; shared ones left in place

### 6. UI Navigation Smoke Check
- [ ] Project cockpit URL: `/dashboard/projects/[projectId]` loads without 404
- [ ] Integrations tab shows connections scoped to project (not org)
- [ ] Routing overview tab (`/api/projects/[projectId]/tip-routing-overview`) returns non-empty response
- [ ] Intelligence context tab (`/api/projects/[projectId]/intelligence-context`) returns non-empty response

---

## Legacy Retirement Gates

Remove legacy code **only after**:

1. Canonical cutover threshold met for ≥ 90% of active projects
2. Production cutover checklist passed for each affected org
3. `writeMode = canonical_only` active in all environments for ≥ 7 days with no errors
4. Legacy `CrossChannelInsight` read paths no longer called (verify via logs)

---

## Write Mode Reference

| Value | Behavior |
|-------|----------|
| `legacy_dual_write` | Writes to legacy `CrossChannelInsight` only (default, safe rollback) |
| `canonical_dual_write` | Writes to both `ProjectTip` + legacy (migration phase) |
| `canonical_only` | Writes to `ProjectTip` only — legacy retired |

Set via `CANONICAL_WRITE_MODE` env var or per-request override.

---

*Generated: 2026-03-07 — Phase 4 Sprint 6*
