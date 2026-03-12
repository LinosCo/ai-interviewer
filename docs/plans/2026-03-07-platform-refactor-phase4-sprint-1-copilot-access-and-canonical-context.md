# Platform Refactor Phase 4 Sprint 1 — Copilot Access And Canonical Context

**Goal**

Remove project-context leakage in Copilot and make canonical project intelligence the default source of truth for assistant grounding.

## Problems This Sprint Resolves

- `POST /api/copilot/chat` still resolves `projectContext` by `organizationId` only
- Copilot does not use `ProjectIntelligenceContextService` as the canonical project context builder
- `getProjectAiTips` still reads legacy `CrossChannelInsight` plus visibility tip actions instead of canonical `ProjectTip`
- Copilot can talk like a strategic project assistant while still being fed fragmented data paths

## Files To Modify

- `src/app/api/copilot/chat/route.ts`
- `src/lib/copilot/system-prompt.ts`
- `src/lib/copilot/chat-tools.ts`
- `src/lib/projects/project-intelligence-context.service.ts`

## Required Changes

### 1. Enforce project access before building project context

In `src/app/api/copilot/chat/route.ts`:

- if `projectId` is present, call `assertProjectAccess(session.user.id, projectId, 'VIEWER')`
- do not build any project-scoped prompt context unless access is confirmed
- if access is denied, return a project access error instead of silently falling back to org-only lookup

### 2. Replace `buildProjectContext()` with canonical context retrieval

Use `ProjectIntelligenceContextService.getContext()` as the primary project context source.

The Copilot prompt context should derive from:

- `strategy`
- `methodologies`
- `dataSources`
- `tips`
- `routingCapabilities`
- `crossProjectContext` only when explicitly enabled or needed

Retain a small summarized prompt payload, but build it from canonical context instead of the old ad hoc bot/theme summary helper.

### 3. Make `getProjectAiTips` canonical-first

Update `createProjectAiTipsTool()` so it:

- reads canonical `ProjectTip` records first
- can still include legacy records only as compatibility fallback
- returns enough metadata for Copilot to distinguish:
  - canonical tips
  - legacy insights
  - visibility tip actions

### 4. Align tool naming and system prompt

Update prompt/tool descriptions so they do not over-promise a unified intelligence workspace unless the data is really canonical-first.

## Verification

1. A user with organization membership but without project access cannot get a project-scoped Copilot context.
2. Copilot prompt context is derived from canonical project intelligence instead of `buildProjectContext()`.
3. `getProjectAiTips` includes canonical tips created manually or by Copilot.

## Done Criteria

- no project-context leakage remains in Copilot
- Copilot project grounding is canonical-first
- assistant answers about project tips are no longer legacy-biased
