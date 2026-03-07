# Platform Refactor Phase 2 Sprint 2 — Canonical Tip Write Paths

**Goal**

Make canonical tip creation and editing complete enough that new flows do not need to go through legacy `CrossChannelInsight` unless explicitly intended.

## Problems This Sprint Resolves

- `createManualTip()` exists but no canonical `POST /api/projects/[projectId]/tips` route exposes it
- Copilot still creates legacy insights first and only then materializes canonical tips
- Phase 1 canonical APIs are read-heavy but not a complete write surface

## Files To Modify

- `src/app/api/projects/[projectId]/tips/route.ts`
- `src/lib/projects/project-tip.service.ts`
- `src/lib/projects/project-tip-grounding.service.ts`
- `src/lib/copilot/chat-tools.ts`

## Required Changes

### 1. Add canonical `POST /tips`

In `src/app/api/projects/[projectId]/tips/route.ts`, add `POST`.

Allowed input:

- `title`
- `summary`
- `priority`
- `category`
- `contentKind`
- `executionClass`
- `reasoning`
- `strategicAlignment`
- `recommendedActions`
- `suggestedRouting`
- `sourceSnapshot`

Required behavior:

- assert project access
- resolve organization from project, not from client input
- create canonical tip with revision row

### 2. Expand `createManualTip()`

Allow it to persist:

- `contentKind`
- `executionClass`
- `suggestedRouting`
- `approvalMode`

### 3. Add canonical-first Copilot path

Add a new path in `src/lib/copilot/chat-tools.ts` that can create a canonical tip directly.

For Phase 2:

- keep the legacy path for compatibility
- add a feature-flagged or explicit-path canonical write
- return both canonical tip ID and legacy ID when both exist

### 4. Normalize update semantics

`updateTip()` should support canonical writes for:

- `approvalMode`
- `draftStatus`
- `routingStatus`
- `publishStatus`
- `methodologySummary` if editable

## Verification

1. `POST /api/projects/[projectId]/tips` creates a canonical tip and revision.
2. Manual tips can carry routing-relevant fields from creation time.
3. Copilot can return a canonical tip ID without depending exclusively on legacy insight creation.

## Done Criteria

- canonical tip creation is available by API
- canonical write path is viable without mandatory legacy indirection
