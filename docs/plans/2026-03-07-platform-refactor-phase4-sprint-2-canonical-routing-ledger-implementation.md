# Platform Refactor Phase 4 Sprint 2 — Canonical Routing Ledger Implementation

**Goal**

Make `ProjectTipRoute` and `ProjectTipExecution` the real runtime ledger of automation and publishing activity.

## Problems This Sprint Resolves

- routing flows still write only `integrationLog` and legacy suggestion state
- canonical overview can read route/execution history, but no real executor writes it
- direct canonical tip operations still cannot produce trustworthy execution history

## Files To Modify

- `src/lib/projects/project-tip.service.ts`
- `src/lib/cms/tip-routing-executor.ts`
- `src/lib/integrations/n8n/dispatcher.ts`
- `src/lib/cms/connection.service.ts`
- `src/app/api/projects/[projectId]/tip-routing-overview/route.ts`

## Required Changes

### 1. Add canonical route helpers

In `ProjectTipService`, add helpers for:

- planning or upserting a route for one tip and destination
- attaching payload preview
- moving route status through `PLANNED`, `READY`, `DISPATCHED`, `SUCCEEDED`, `FAILED`

### 2. Add canonical execution helpers

Add helpers for:

- opening an execution
- marking success
- marking failure
- storing request and response payloads
- linking execution rows back to a route when applicable

### 3. Wire real operational flows

In routing and publishing paths:

- CMS push must create or update canonical route/execution rows
- MCP dispatch must create or update canonical route/execution rows
- n8n dispatch must create or update canonical route/execution rows

Do not fake this in the overview.
Write it where the event really happens.

### 4. Update tip lifecycle fields from real execution results

When execution state changes, update the parent tip conservatively:

- `routingStatus`
- `draftStatus`
- `publishStatus`
- `status` only when clearly justified

## Verification

1. Running a routing rule for a canonical tip produces a `ProjectTipRoute`.
2. A successful dispatch produces a `ProjectTipExecution`.
3. A failed dispatch produces a `FAILED` execution and leaves a useful error payload.
4. `tip-routing-overview` reflects real canonical executions, not only inferred status.

## Done Criteria

- the canonical ledger is written by the product, not only by read paths
- routing overview becomes operationally trustworthy
