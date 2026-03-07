# Platform Refactor Phase 1 Execution

**Date:** 2026-03-06
**Status:** Draft
**Depends on:** `docs/plans/2026-03-06-platform-refactor-blueprint.md`

## Sprint Documents

The Phase 1 execution is split into implementation sprints so it can be delegated with lower risk:

- `docs/plans/2026-03-07-platform-refactor-sprint-1-schema.md`
- `docs/plans/2026-03-07-platform-refactor-sprint-2-backfill.md`
- `docs/plans/2026-03-07-platform-refactor-sprint-3-services.md`
- `docs/plans/2026-03-07-platform-refactor-sprint-4-dual-write.md`
- `docs/plans/2026-03-07-platform-refactor-sprint-5-api-transfer.md`
- `docs/plans/2026-03-07-platform-refactor-sprint-6-ui-routing-cutover.md`

## 1. Goal

Phase 1 should introduce a canonical project intelligence layer without breaking the current product flows.

This phase is successful if:

- project strategy becomes a first-class model
- AI tips become a first-class persisted entity
- data sources can be bound to one or many projects
- Copilot and UI read the same project intelligence context
- routing becomes attached to the tip lifecycle instead of being reconstructed later
- project transfer keeps working with the new entities

This phase should **not** attempt a full UI rewrite or immediate removal of all legacy models.

## 2. Current Constraints In Code

The current codebase already contains the raw ingredients, but they are fragmented:

- `CrossChannelInsight` is currently the only persisted "tip-like" entity with lifecycle and editable actions.
- `WebsiteAnalysis.recommendations` stores actionable tips as JSON blobs.
- `BrandReport.aiTips` stores another tip format as JSON blobs.
- `TipRoutingRule` is project-scoped, but routing coverage is inferred by category/content kind instead of attached to an actual tip instance.
- project strategy is currently only `Project.strategicVision` and `Project.valueProposition`.
- methodology knowledge exists mostly at organization level through `PlatformSettings`.
- Copilot already supports org-level scope with project access filtering, but its project context builder is too light and its tip creation writes into `CrossChannelInsight`.
- project transfer already exists and must remain compatible with the new models.

Design implication:

- Phase 1 must be additive.
- Legacy generators stay online, but they must start feeding the canonical layer.
- New read models should sit on top of existing domain tables first, then gradually replace them.

## 3. Phase 1 Deliverables

### A. Canonical Strategy Layer

Add a dedicated `ProjectStrategy` model instead of continuing to overload `Project`.

Suggested fields:

- `id`
- `projectId` unique
- `positioning`
- `valueProposition`
- `targetAudiences` JSON
- `strategicGoals` JSON
- `priorityKpis` JSON
- `keyOffers` JSON
- `constraints` JSON
- `toneGuidelines`
- `editorialPriorities` JSON
- `channelPriorities` JSON
- `createdAt`
- `updatedAt`

Backfill source:

- `Project.strategicVision -> ProjectStrategy.positioning`
- `Project.valueProposition -> ProjectStrategy.valueProposition`

`Project.strategicVision` and `Project.valueProposition` should remain temporarily for backward compatibility, but Phase 1 code should read from `ProjectStrategy` first.

### B. Methodology Layer

Normalize methodology knowledge into reusable profiles instead of reading raw text directly from `PlatformSettings`.

Suggested models:

#### `MethodologyProfile`

- `id`
- `organizationId`
- `slug`
- `name`
- `category`
- `isDefault`
- `knowledge`
- `status`
- `createdAt`
- `updatedAt`

#### `ProjectMethodologyBinding`

- `id`
- `projectId`
- `methodologyProfileId`
- `role` (`primary`, `secondary`)
- `createdAt`

Backfill source:

- `PlatformSettings.methodologyKnowledge -> default stakeholder/interview profile`
- `PlatformSettings.strategicMarketingKnowledge -> default strategic marketing profile`
- optional derived profiles from existing product areas can be added later

This preserves organization-level governance while allowing each project to choose the methodology profile that should influence tips and Copilot reasoning.

### C. Shared Data Source Layer

Do not move existing integrations into a new polymorphic system in Phase 1.
Instead, add a registry and binding layer on top of current tables.

Suggested models:

#### `DataSource`

- `id`
- `organizationId`
- `sourceType`
- `entityId`
- `entityVersion`
- `ownershipMode` (`dedicated`, `shared`)
- `label`
- `status`
- `metadata` JSON
- `createdAt`
- `updatedAt`

`entityId` points to an existing record such as:

- `Bot`
- `KnowledgeSource`
- `VisibilityConfig`
- `GoogleConnection`
- `CMSConnection`
- `MCPConnection`
- `N8NConnection`

#### `ProjectDataSourceBinding`

- `id`
- `projectId`
- `dataSourceId`
- `bindingRole` (`primary`, `secondary`, `reference`, `execution`)
- `channelIntent`
- `relevanceScore`
- `metadata` JSON
- `createdAt`
- `updatedAt`

This is the minimum viable structure needed to support:

- one source linked to many projects
- one project with many sources
- transfer-safe shared sources
- access-filtered retrieval for Copilot and tip generation

Backfill source:

- direct project-owned integrations become `dedicated`
- `ProjectCMSConnection`, `ProjectMCPConnection`, `ProjectVisibilityConfig` become `shared` bindings
- `Bot` and `KnowledgeSource` entries become dedicated project sources

### D. Canonical Tip Layer

Introduce a single tip entity and keep legacy records as origins.

Suggested models:

#### `ProjectTip`

- `id`
- `organizationId`
- `projectId`
- `originType` (`cross_channel_insight`, `website_analysis`, `brand_report`, `copilot`, `manual`)
- `originId`
- `title`
- `summary`
- `status`
- `priority`
- `category`
- `contentKind`
- `executionClass`
- `approvalMode`
- `draftStatus`
- `routingStatus`
- `publishStatus`
- `starred`
- `reasoning`
- `strategicAlignment`
- `methodologySummary`
- `sourceSnapshot` JSON
- `recommendedActions` JSON
- `suggestedRouting` JSON
- `createdBy`
- `lastEditedBy`
- `createdAt`
- `updatedAt`

#### `ProjectTipEvidence`

- `id`
- `tipId`
- `sourceType`
- `sourceEntityId`
- `sourceLabel`
- `detail`
- `metricValue`
- `metricUnit`
- `sortOrder`

#### `ProjectTipRevision`

- `id`
- `tipId`
- `editorType` (`system`, `user`, `copilot`)
- `editorUserId`
- `changeSummary`
- `snapshot` JSON
- `createdAt`

#### `ProjectTipRoute`

- `id`
- `tipId`
- `destinationType`
- `destinationRefId`
- `policyMode`
- `status`
- `payloadPreview` JSON
- `lastDispatchedAt`
- `createdAt`
- `updatedAt`

#### `ProjectTipExecution`

- `id`
- `tipId`
- `routeId`
- `runType` (`manual`, `automatic`, `copilot`)
- `status`
- `requestPayload` JSON
- `responsePayload` JSON
- `errorMessage`
- `executedBy`
- `startedAt`
- `completedAt`

Important rule:

- one tip can have many routes
- duplication is only needed when a destination requires a content or logic variant

### E. Optional But Strongly Recommended Cache

Add `ProjectIntelligenceSnapshot` only if performance becomes a problem during rollout.
Do not make this a blocker for Phase 1.

## 4. Canonical Services To Introduce

### A. `ProjectIntelligenceContextService`

Single read model for UI, Copilot and generators.

Input:

- `projectId`
- `viewerUserId`
- `includeCrossProjectContext`

Output:

- project strategy
- attached methodology profiles
- active data source bindings
- grounded evidence summary
- existing tips with statuses
- active routing capabilities
- connected destinations
- optional cross-project references filtered to accessible projects only

This service replaces today's scattered context assembly in:

- `src/lib/insights/sync-engine.ts`
- `src/lib/visibility/website-analysis-engine.ts`
- `src/lib/visibility/brand-report-engine.ts`
- `src/app/api/copilot/chat/route.ts`

### B. `ProjectTipGroundingService`

Responsible for composing the exact grounding package used to create or update a tip.

The grounding contract should always include:

- source evidence items
- project strategy snapshot
- methodology profile refs
- automation capability snapshot
- explainability notes

Every generator and Copilot write path must call this service.

### C. `ProjectTipService`

Central CRUD and lifecycle service for:

- create tip
- update tip
- duplicate tip
- revise tip
- change lifecycle status
- star/unstar
- attach evidence

This replaces ad hoc writes to `CrossChannelInsight` for new tip creation.

### D. `ProjectTipRoutingService`

Central planner and executor for:

- route suggestion generation
- route validation
- preview payload generation
- dispatch execution
- execution logging

It should consume existing integration adapters instead of reimplementing them:

- CMS suggestion generation
- MCP gateway
- n8n dispatcher
- webhook dispatch

### E. `ProjectTransferCompletenessService`

Add a single service that lists all project-scoped entities that must move or split during transfer.

This service should cover:

- `ProjectStrategy`
- `ProjectMethodologyBinding`
- `ProjectDataSourceBinding`
- `ProjectTip`
- `ProjectTipEvidence`
- `ProjectTipRevision`
- `ProjectTipRoute`
- `ProjectTipExecution`

The existing `moveProjectToOrganization` flow remains the transfer entry point.
Phase 1 only extends its completeness.

## 5. API Surface For Phase 1

### New API Endpoints

- `GET /api/projects/[projectId]/intelligence-context`
- `GET /api/projects/[projectId]/tips`
- `POST /api/projects/[projectId]/tips`
- `GET /api/projects/[projectId]/tips/[tipId]`
- `PATCH /api/projects/[projectId]/tips/[tipId]`
- `POST /api/projects/[projectId]/tips/[tipId]/duplicate`
- `POST /api/projects/[projectId]/tips/[tipId]/route`
- `POST /api/projects/[projectId]/tips/[tipId]/execute`
- `GET /api/projects/[projectId]/tips/[tipId]/executions`

### Existing Endpoints To Convert Into Adapters

- `insights/sync` should continue working, but write or project into `ProjectTip`
- `website-analysis` should keep producing analysis records, but recommendations should also be materialized as `ProjectTip`
- `brand-report` should keep its report output, but `aiTips` should also be materialized as `ProjectTip`
- Copilot tip creation should stop writing directly to `CrossChannelInsight` and use `ProjectTipService`

## 6. Migration Strategy

Phase 1 should be released in additive steps.

### Step 1. Schema Migration

Add the new tables without deleting any legacy fields or tables.

### Step 2. Backfill Strategy And Methodology

Backfill:

- `ProjectStrategy` from `Project`
- `MethodologyProfile` from `PlatformSettings`
- `ProjectMethodologyBinding` with one primary strategic profile per project

### Step 3. Backfill Source Registry

Create `DataSource` and `ProjectDataSourceBinding` rows for:

- bots
- knowledge sources
- visibility configs
- Google connections
- CMS connections
- MCP connections
- n8n connections

Rules:

- if the source is linked to one project only, mark `ownershipMode = dedicated`
- if the source is attached by a share table, mark `ownershipMode = shared`

### Step 4. Backfill Tips

Create `ProjectTip` rows from:

#### `CrossChannelInsight`

- `originType = cross_channel_insight`
- map `topicName -> title`
- map `priorityScore -> priority`
- map `status -> status`
- map `suggestedActions -> recommendedActions`
- derive evidence from `interviewData`, `chatbotData`, `visibilityData`

#### `WebsiteAnalysis.recommendations`

- one `ProjectTip` per recommendation item
- `originType = website_analysis`
- link to the parent analysis in `originId`
- preserve `dataSource`, `strategyAlignment`, `evidencePoints`, `contentDraft`

#### `BrandReport.aiTips`

- one `ProjectTip` per tip
- `originType = brand_report`
- preserve category, affected pages, rationale and score

#### Existing tip state

If a legacy record already has completion or dismissal data, translate it to the nearest canonical lifecycle state and preserve the raw origin in `sourceSnapshot`.

### Step 5. Dual Write

Update generators so new runs create:

- their original legacy record
- the canonical `ProjectTip` record

This avoids a hard cutover.

### Step 6. Read Cutover

Switch these consumers to read from canonical models:

- tips list/detail UI
- Copilot tip editing
- routing overview
- automation status

Legacy views can remain as fallbacks until validation is complete.

## 7. Copilot Changes In Phase 1

### Replace The Current Lightweight Project Context

Current Copilot context is too shallow for the product promise.
Phase 1 should replace it with `ProjectIntelligenceContextService`.

The Copilot should receive:

- project strategy
- methodology profiles
- source bindings
- latest grounded signals
- existing tips
- routing options
- execution history summary

### Cross-Project References

Cross-project context must be:

- opt-in by prompt or tool intent
- filtered to accessible projects only
- expressed as comparison or reusable pattern, never as silent leakage

### Tip Operations

Copilot tools should use `ProjectTipService` for:

- create
- edit
- explain
- duplicate
- route
- execute where allowed

## 8. UI Scope For Phase 1

Do not attempt the full IA rewrite yet.
Phase 1 UI should focus on one usable vertical slice:

### Minimum UI To Ship

- new project tips list
- tip detail drawer/page with sources, logic, methodology refs and routes
- manual edit form
- route preview panel
- execution history panel

### Existing Screens To Repoint

- current Insights page should become a thin view over `ProjectTip`
- current routing overview should read canonical tips and routes, not infer from JSON blobs
- Copilot CTA from project pages should open in project intelligence mode

## 9. Rollout Order

1. Add schema and backfill scripts.
2. Implement `ProjectIntelligenceContextService`.
3. Implement `ProjectTipService` and `ProjectTipGroundingService`.
4. Dual-write from CrossChannel, WebsiteAnalysis, BrandReport and Copilot.
5. Switch new tips UI to canonical reads.
6. Switch routing planner/executor to canonical tips.
7. Extend project transfer completeness.
8. Remove legacy reads only after parity verification.

## 10. Acceptance Criteria

Phase 1 is done when:

- every new tip is persisted as `ProjectTip`
- every tip detail shows sources, reasoning, strategy and methodology refs
- one tip can route to multiple destinations
- Copilot can create and edit canonical tips
- routing previews and execution logs are attached to the tip
- project transfer preserves the new models
- access control blocks cross-project data the user cannot access

## 11. Immediate Build Tasks

The next implementation sprint should contain exactly these tasks:

1. add Prisma models for `ProjectStrategy`, `MethodologyProfile`, `ProjectMethodologyBinding`, `DataSource`, `ProjectDataSourceBinding`, `ProjectTip`, `ProjectTipEvidence`, `ProjectTipRevision`, `ProjectTipRoute`, `ProjectTipExecution`
2. add one backfill script for strategy/methodology and one backfill script for sources/tips
3. implement `ProjectIntelligenceContextService`
4. implement `ProjectTipService` with create, update and revise operations
5. switch Copilot strategic tip creation to `ProjectTipService`

That is the smallest Phase 1 slice that materially improves architecture without blocking the product.
