# Platform Refactor Sprint 3 — Canonical Services

> For a lower-capability model: create the service layer first. Do not dual-write yet. Do not modify generator behavior in this sprint.

**Goal**

Introduce the canonical read/write services that later sprints will call.

## Files To Create

- `src/lib/projects/project-intelligence-types.ts`
- `src/lib/projects/project-intelligence-context.service.ts`
- `src/lib/projects/project-tip-grounding.service.ts`
- `src/lib/projects/project-tip.service.ts`

## Files Allowed To Read But Not Modify

- `src/lib/domain/workspace.ts`
- `src/lib/insights/sync-engine.ts`
- `src/lib/visibility/website-analysis-engine.ts`
- `src/lib/visibility/brand-report-engine.ts`
- `src/app/api/copilot/chat/route.ts`
- `src/lib/copilot/chat-tools.ts`

## Global Rules

1. All service entry points must be project-scoped.
2. Access control must use existing workspace helpers, not ad hoc organization filtering.
3. Service methods must be usable by routes, jobs, and Copilot tools.
4. No service may import from `src/app/`.

## Task 1: Define Shared Types

In `project-intelligence-types.ts`, define:

- `ProjectStrategySnapshot`
- `MethodologyProfileSnapshot`
- `DataSourceBindingSnapshot`
- `ProjectTipSnapshot`
- `ProjectTipRouteSnapshot`
- `ProjectTipExecutionSnapshot`
- `ProjectIntelligenceContext`

Keep these types simple and serializable.

## Task 2: Implement `ProjectIntelligenceContextService`

Export:

```ts
export class ProjectIntelligenceContextService {
  static async getContext(params: {
    projectId: string;
    viewerUserId: string;
    includeCrossProjectContext?: boolean;
    limitPerSource?: number;
  }): Promise<ProjectIntelligenceContext>
}
```

### Required behavior

1. call `assertProjectAccess(viewerUserId, projectId, 'VIEWER')`
2. load `Project`, `ProjectStrategy`, `ProjectMethodologyBinding`, `MethodologyProfile`
3. load `ProjectDataSourceBinding` and linked `DataSource`
4. load canonical `ProjectTip` rows for the project
5. load active routing capabilities from:
   - `TipRoutingRule`
   - direct project integrations
   - shared CMS / MCP / visibility bindings if relevant
6. if `includeCrossProjectContext` is true:
   - load only projects accessible to the same user
   - exclude the current project
   - return only light references: project id, name, top tip titles, patterns

### Do not do yet

- do not aggregate full transcript bodies
- do not fetch unlimited data
- do not expose inaccessible projects

## Task 3: Implement `ProjectTipGroundingService`

Export:

```ts
export class ProjectTipGroundingService {
  static async buildFromCrossChannelInsight(insightId: string): Promise<ProjectTipGroundingPayload>
  static async buildFromWebsiteAnalysis(params: { analysisId: string; recommendationIndex: number }): Promise<ProjectTipGroundingPayload>
  static async buildFromBrandReport(params: { reportId: string; tipIndex: number }): Promise<ProjectTipGroundingPayload>
  static async buildFromCopilotInput(params: {
    projectId: string;
    organizationId: string;
    title: string;
    reasoning?: string | null;
    summary?: string | null;
    actions?: unknown;
    evidence?: unknown;
  }): Promise<ProjectTipGroundingPayload>
}
```

### Payload must include

- canonical `ProjectTip` base fields
- normalized evidence rows
- methodology refs summary
- source snapshot
- strategy snapshot summary

Do not write to the database in this service.

## Task 4: Implement `ProjectTipService`

Export:

```ts
export class ProjectTipService {
  static async materializeFromCrossChannelInsight(insightId: string): Promise<{ tipId: string | null; created: boolean }>
  static async materializeFromWebsiteAnalysis(analysisId: string): Promise<{ created: number; updated: number; skipped: number }>
  static async materializeFromBrandReport(reportId: string): Promise<{ created: number; updated: number; skipped: number }>
  static async createManualTip(input: CreateManualTipInput): Promise<ProjectTip>
  static async updateTip(input: UpdateProjectTipInput): Promise<ProjectTip>
  static async duplicateTip(input: DuplicateProjectTipInput): Promise<ProjectTip>
  static async listProjectTips(params: { projectId: string; viewerUserId: string }): Promise<ProjectTipSnapshot[]>
  static async getProjectTip(params: { projectId: string; tipId: string; viewerUserId: string }): Promise<ProjectTipSnapshot | null>
}
```

### Required implementation details

- use `ProjectTipGroundingService` for all materialization paths
- use `originFingerprint` for idempotent upsert
- create or refresh `ProjectTipEvidence`
- append `ProjectTipRevision` on manual or Copilot edits
- never delete revisions during update

### Important simplification

Keep `createdBy`, `lastEditedBy`, and `executedBy` as raw string IDs.
Do not add `User` relations in this sprint.

## Task 5: Minimal Local Verification

Run:

```bash
npx tsc --noEmit
```

Expected:

- no new type errors caused by the created services

## Done Criteria

- all four service files exist
- services compile
- no generator or route behavior changed yet
