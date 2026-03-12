# Platform Refactor Phase 2 Sprint 3 — Routing And Execution State

**Goal**

Start writing canonical route and execution records so routing overview and sent-history no longer regress when canonical tips exist.

## Problems This Sprint Resolves

- `ProjectTipRoute` and `ProjectTipExecution` are readable but not actively written
- routing overview switches to canonical mode and therefore loses legacy history once canonical tips are present

## Files To Modify

- `src/lib/projects/project-tip.service.ts`
- `src/lib/cms/tip-routing-executor.ts`
- `src/lib/integrations/n8n/dispatcher.ts`
- `src/app/api/projects/[projectId]/tip-routing-overview/route.ts`

## Required Changes

### 1. Add canonical route creation helpers

In `ProjectTipService`, add helpers to:

- create planned routes from routing suggestions
- upsert routes per tip and destination
- list routes by tip

### 2. Log executions from real routing flows

When a tip is actually routed or dispatched through:

- CMS push
- MCP action
- n8n dispatch

write a `ProjectTipExecution` row and update route status accordingly.

### 3. Backfill minimal route state from existing history

For tips already materialized from legacy content flows:

- infer initial route/execution state from existing `CMSSuggestion` and integration logs where possible
- do this conservatively
- if mapping confidence is low, leave the canonical tip unrouted instead of inventing history

### 4. Tighten routing overview precedence

In `tip-routing-overview/route.ts`:

- prefer canonical history only if canonical route/execution records actually exist
- otherwise fall back to legacy suggestion history

This avoids the current "canonical exists therefore history disappears" regression.

## Verification

1. A newly routed canonical tip creates a `ProjectTipRoute`.
2. A successful dispatch creates a `ProjectTipExecution`.
3. Routing overview shows non-zero sent history in canonical mode when executions exist.
4. Projects with canonical tips but no canonical execution history still retain legacy fallback.

## Done Criteria

- canonical routing tables are not passive anymore
- overview and sent-history no longer regress when canonical data exists
