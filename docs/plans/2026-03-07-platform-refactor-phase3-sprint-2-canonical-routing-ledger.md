# Platform Refactor Phase 3 Sprint 2 — Canonical Routing Ledger

**Goal**

Make `ProjectTipRoute` and `ProjectTipExecution` the real operational ledger behind routing, automation dispatch and publish history.

## Problems This Sprint Resolves

- canonical route and execution tables still have no write paths
- routing overview counts canonical tips as sent or draft-ready without a trustworthy canonical ledger
- routing state still depends too much on legacy CMS suggestion history and log inference

## Files To Modify

- `src/lib/projects/project-tip.service.ts`
- `src/lib/cms/tip-routing-executor.ts`
- `src/lib/cms/suggestion-generator.ts`
- `src/lib/integrations/n8n/dispatcher.ts`
- `src/app/api/projects/[projectId]/tip-routing-overview/route.ts`
- any API routes that trigger routing or publish operations

## Required Changes

### 1. Add canonical route helpers

In `ProjectTipService`, add explicit helpers for:

- planning routes from a tip's `suggestedRouting`
- upserting a route by `(tipId, destinationType, destinationRefId)`
- updating route status transitions
- listing routes for one tip
- attaching a payload preview to the route

Use deterministic behavior.
The same tip routed to the same destination should not create duplicate route rows unless the product explicitly wants versioned route attempts.

### 2. Add canonical execution helpers

In `ProjectTipService`, add helpers for:

- starting an execution
- marking execution success
- marking execution failure
- linking an execution to a route when the route exists
- persisting request and response payload snapshots

Status changes must be consistent:

- route `PLANNED` -> `READY` when prepared
- `READY` -> `DISPATCHED` when sent
- `DISPATCHED` -> `SUCCEEDED` or `FAILED` after completion

Also update the parent tip:

- `routingStatus`
- `draftStatus`
- `publishStatus`
- `status` when appropriate

### 3. Wire real routing flows

When these flows happen for a canonical tip, they must write to the canonical ledger:

- CMS draft generation or push
- MCP execution
- n8n dispatch

Do not add synthetic writes in read paths.
Writes must happen where the operational event occurs.

### 4. Preserve legacy fallback only when canonical ledger is absent

In `tip-routing-overview/route.ts`:

- prefer canonical history only when route or execution rows actually exist for the project
- otherwise use legacy suggestion history
- do not switch to canonical mode just because canonical tips exist

### 5. Add conservative backfill hooks

For already-materialized canonical tips:

- backfill route/execution state from existing CMS suggestions and integration logs only when the mapping is high confidence
- leave tips unrouted when confidence is low
- record backfill provenance in route or execution payload metadata

## Verification

1. Routing a canonical tip creates a `ProjectTipRoute`.
2. Dispatching a canonical tip through CMS or n8n creates a `ProjectTipExecution`.
3. Failed dispatches create `FAILED` executions and update route status consistently.
4. Routing overview keeps legacy history when a project has canonical tips but no canonical route/execution rows.
5. Sent history in canonical mode reflects actual execution rows, not inferred UI state.

## Done Criteria

- canonical routing and execution tables are actively written
- routing overview is ledger-backed instead of inference-backed
- fallback rules are explicit and conservative
