# Platform Refactor Sprint 1 — Schema

> For a lower-capability model: follow this document exactly. Do not rename legacy models, do not delete fields, do not touch UI, and do not cut over any existing route in this sprint.

**Goal**

Add the canonical Phase 1 schema in an additive way so later sprints can backfill and dual-write safely.

**Primary file**

- `prisma/schema.prisma`

**Allowed secondary files**

- the generated Prisma migration folder created by `prisma migrate`

## Non-Negotiable Rules

1. Additive only. No deletions, no renames, no data moves.
2. Keep unstable taxonomies as `String?`, not enums.
3. Do not add polymorphic foreign keys to `User`, `CMSConnection`, `MCPConnection`, `GoogleConnection`, or `N8NConnection`.
4. Use enums only for stable lifecycle and ownership states.
5. Do not modify any existing legacy relation names.

## Exact Schema Additions

### New enums

Add these enums near the existing enum block:

- `MethodologyProfileStatus`
  - `ACTIVE`
  - `ARCHIVED`
- `ProjectMethodologyRole`
  - `PRIMARY`
  - `SECONDARY`
- `DataSourceType`
  - `BOT`
  - `KNOWLEDGE_SOURCE`
  - `VISIBILITY_CONFIG`
  - `GOOGLE_CONNECTION`
  - `CMS_CONNECTION`
  - `MCP_CONNECTION`
  - `N8N_CONNECTION`
- `DataSourceOwnershipMode`
  - `DEDICATED`
  - `SHARED`
- `ProjectDataSourceBindingRole`
  - `PRIMARY`
  - `SECONDARY`
  - `REFERENCE`
  - `EXECUTION`
- `ProjectTipOriginType`
  - `CROSS_CHANNEL_INSIGHT`
  - `WEBSITE_ANALYSIS`
  - `BRAND_REPORT`
  - `COPILOT`
  - `MANUAL`
- `ProjectTipStatus`
  - `NEW`
  - `REVIEWED`
  - `APPROVED`
  - `DRAFTED`
  - `ROUTED`
  - `AUTOMATED`
  - `COMPLETED`
  - `ARCHIVED`
- `TipApprovalMode`
  - `MANUAL`
  - `AUTO_APPROVE`
  - `AUTO_EXECUTE`
- `TipDraftStatus`
  - `NONE`
  - `READY`
  - `GENERATED`
  - `FAILED`
- `TipRoutingStatus`
  - `NONE`
  - `PLANNED`
  - `READY`
  - `DISPATCHED`
  - `PARTIAL`
  - `FAILED`
- `TipPublishStatus`
  - `NOT_APPLICABLE`
  - `NOT_STARTED`
  - `DRAFT_READY`
  - `PUBLISHED`
  - `FAILED`
- `TipRevisionEditorType`
  - `SYSTEM`
  - `USER`
  - `COPILOT`
- `TipRouteDestinationType`
  - `CMS`
  - `MCP`
  - `N8N`
  - `WEBHOOK`
  - `SEO_INTERVENTION`
  - `INTERNAL_TASK`
- `TipRoutePolicyMode`
  - `MANUAL`
  - `AUTO_APPROVE`
  - `AUTO_EXECUTE`
- `TipRouteStatus`
  - `PLANNED`
  - `READY`
  - `DISPATCHED`
  - `SUCCEEDED`
  - `FAILED`
- `TipExecutionRunType`
  - `MANUAL`
  - `AUTOMATIC`
  - `COPILOT`
- `TipExecutionStatus`
  - `PENDING`
  - `RUNNING`
  - `SUCCEEDED`
  - `FAILED`
  - `CANCELED`

### New models

Add these models:

#### `ProjectStrategy`

- `id String @id @default(cuid())`
- `projectId String @unique`
- `positioning String?`
- `valueProposition String?`
- `targetAudiences Json?`
- `strategicGoals Json?`
- `priorityKpis Json?`
- `keyOffers Json?`
- `constraints Json?`
- `toneGuidelines String?`
- `editorialPriorities Json?`
- `channelPriorities Json?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- relation to `Project` with `onDelete: Cascade`

#### `MethodologyProfile`

- `id String @id @default(cuid())`
- `organizationId String`
- `slug String`
- `name String`
- `category String`
- `knowledge String`
- `isDefault Boolean @default(false)`
- `status MethodologyProfileStatus @default(ACTIVE)`
- `metadata Json?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- relation to `Organization` with `onDelete: Cascade`
- relation list to `ProjectMethodologyBinding`
- `@@unique([organizationId, slug])`
- `@@index([organizationId, status])`

#### `ProjectMethodologyBinding`

- `id String @id @default(cuid())`
- `projectId String`
- `methodologyProfileId String`
- `role ProjectMethodologyRole @default(PRIMARY)`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- relation to `Project` with `onDelete: Cascade`
- relation to `MethodologyProfile` with `onDelete: Cascade`
- `@@unique([projectId, methodologyProfileId])`
- `@@index([projectId, role])`

#### `DataSource`

- `id String @id @default(cuid())`
- `organizationId String`
- `sourceType DataSourceType`
- `entityId String`
- `ownershipMode DataSourceOwnershipMode @default(DEDICATED)`
- `label String?`
- `status String?`
- `metadata Json?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- relation to `Organization` with `onDelete: Cascade`
- relation list to `ProjectDataSourceBinding`
- `@@unique([sourceType, entityId])`
- `@@index([organizationId, sourceType])`

#### `ProjectDataSourceBinding`

- `id String @id @default(cuid())`
- `projectId String`
- `dataSourceId String`
- `bindingRole ProjectDataSourceBindingRole @default(PRIMARY)`
- `channelIntent String?`
- `relevanceScore Float?`
- `metadata Json?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- relation to `Project` with `onDelete: Cascade`
- relation to `DataSource` with `onDelete: Cascade`
- `@@unique([projectId, dataSourceId])`
- `@@index([projectId, bindingRole])`

#### `ProjectTip`

- `id String @id @default(cuid())`
- `organizationId String`
- `projectId String`
- `originType ProjectTipOriginType`
- `originId String?`
- `originItemKey String?`
- `originFingerprint String? @unique`
- `title String`
- `summary String?`
- `status ProjectTipStatus @default(NEW)`
- `priority Float?`
- `category String?`
- `contentKind String?`
- `executionClass String?`
- `approvalMode TipApprovalMode @default(MANUAL)`
- `draftStatus TipDraftStatus @default(NONE)`
- `routingStatus TipRoutingStatus @default(NONE)`
- `publishStatus TipPublishStatus @default(NOT_APPLICABLE)`
- `starred Boolean @default(false)`
- `reasoning String?`
- `strategicAlignment String?`
- `methodologySummary String?`
- `methodologyRefs Json?`
- `sourceSnapshot Json?`
- `recommendedActions Json?`
- `suggestedRouting Json?`
- `createdBy String?`
- `lastEditedBy String?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- relations to `Organization` and `Project` with `onDelete: Cascade`
- relation lists to evidence, revisions, routes, executions
- `@@index([projectId, status])`
- `@@index([projectId, starred])`
- `@@index([projectId, originType])`

#### `ProjectTipEvidence`

- `id String @id @default(cuid())`
- `tipId String`
- `sourceType String`
- `sourceEntityId String?`
- `sourceLabel String?`
- `detail String`
- `metricValue Float?`
- `metricUnit String?`
- `sortOrder Int @default(0)`
- `createdAt DateTime @default(now())`
- relation to `ProjectTip` with `onDelete: Cascade`
- `@@index([tipId, sortOrder])`

#### `ProjectTipRevision`

- `id String @id @default(cuid())`
- `tipId String`
- `editorType TipRevisionEditorType`
- `editorUserId String?`
- `changeSummary String`
- `snapshot Json`
- `createdAt DateTime @default(now())`
- relation to `ProjectTip` with `onDelete: Cascade`
- `@@index([tipId, createdAt])`

#### `ProjectTipRoute`

- `id String @id @default(cuid())`
- `tipId String`
- `destinationType TipRouteDestinationType`
- `destinationRefId String?`
- `policyMode TipRoutePolicyMode @default(MANUAL)`
- `status TipRouteStatus @default(PLANNED)`
- `payloadPreview Json?`
- `lastDispatchedAt DateTime?`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- relation to `ProjectTip` with `onDelete: Cascade`
- relation list to `ProjectTipExecution`
- `@@index([tipId, status])`

#### `ProjectTipExecution`

- `id String @id @default(cuid())`
- `tipId String`
- `routeId String?`
- `runType TipExecutionRunType`
- `status TipExecutionStatus @default(PENDING)`
- `requestPayload Json?`
- `responsePayload Json?`
- `errorMessage String?`
- `executedBy String?`
- `startedAt DateTime @default(now())`
- `completedAt DateTime?`
- relation to `ProjectTip` with `onDelete: Cascade`
- optional relation to `ProjectTipRoute` with `onDelete: SetNull`
- `@@index([tipId, startedAt])`
- `@@index([routeId, startedAt])`

### Existing models that must receive new relation fields

#### `Organization`

Add:

- `methodologyProfiles MethodologyProfile[]`
- `dataSources DataSource[]`
- `projectTips ProjectTip[]`

#### `Project`

Add:

- `strategy ProjectStrategy?`
- `methodologyBindings ProjectMethodologyBinding[]`
- `dataSourceBindings ProjectDataSourceBinding[]`
- `projectTips ProjectTip[]`

## Explicitly Do Not Add In This Sprint

- no new routes
- no new services
- no new scripts
- no edits to `src/`
- no edits to project transfer logic
- no removal of `Project.strategicVision` or `Project.valueProposition`

## Commands

Run only after editing `prisma/schema.prisma`:

```bash
npx prisma validate
npx prisma migrate dev --name add_project_intelligence_phase1_schema
npx prisma generate
```

## Verification Checklist

1. `prisma validate` passes.
2. The migration only adds new enums, tables, indexes, and relation columns generated by Prisma.
3. No legacy table is altered destructively.
4. `Project`, `Organization`, and the new models compile under Prisma generate.

## Done Criteria

- schema merged
- migration created
- Prisma client generated
- no app code changed yet
