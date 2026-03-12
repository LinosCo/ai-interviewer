# Platform Refactor Phase 2 Sprint 4 — Access, Transfer, Shared Assets

**Goal**

Harden project-level access and make shared canonical dependencies safer during project transfer.

## Problems This Sprint Resolves

- `tip-routing-overview` still authorizes by organization membership instead of project access
- shared data sources and methodology dependencies remain ambiguous after project transfer

## Files To Modify

- `src/app/api/projects/[projectId]/tip-routing-overview/route.ts`
- `src/lib/projects/project-transfer-completeness.service.ts`
- `src/lib/domain/workspace.ts`
- `src/lib/projects/project-intelligence-context.service.ts`

## Required Changes

### 1. Enforce project access in route-related APIs

Replace organization-membership-only checks with `assertProjectAccess`.

This is mandatory in:

- `tip-routing-overview/route.ts`

Also review any other Phase 1 canonical route that still checks only organization membership.

### 2. Tighten cross-project context retrieval

In `ProjectIntelligenceContextService`:

- keep cross-project access filtered to accessible projects only
- add explicit tests for restricted users

### 3. Improve transfer semantics for shared canonical dependencies

Extend `syncTransferredProjectIntelligence()` to classify:

- dedicated-only canonical dependencies
- shared canonical dependencies
- shared methodology bindings inherited from source organization

For shared dependencies:

- add explicit structured return data or logs for follow-up
- do not silently leave ambiguous ownership

### 4. Define clone/split follow-up hooks

Do not implement full cloning if it is too large for this sprint.
Do implement clear hook points or TODO markers for:

- shared `DataSource`
- shared methodology profiles

## Verification

1. A user with organization membership but without project access cannot read routing overview for that project.
2. Transfer logs or return payload clearly identify unresolved shared dependencies.
3. Cross-project context for restricted users only contains accessible projects.

## Done Criteria

- project-level access is consistently enforced for routing overview
- transfer behavior is explicit for shared canonical dependencies
