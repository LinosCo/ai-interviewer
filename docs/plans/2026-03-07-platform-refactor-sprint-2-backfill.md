# Platform Refactor Sprint 2 — Backfill

> For a lower-capability model: this sprint is script-only. Do not modify runtime routes or services yet.

**Goal**

Populate the new Phase 1 tables from existing data with idempotent scripts and a verification script.

**Files to create**

- `scripts/phase1/backfill-project-strategies.ts`
- `scripts/phase1/backfill-methodology-profiles.ts`
- `scripts/phase1/backfill-data-sources.ts`
- `scripts/phase1/backfill-project-tips.ts`
- `scripts/phase1/verify-project-intelligence-phase1.ts`

**Optional shared helper**

- `scripts/phase1/_shared.ts`

## Global Rules

1. Every script must be idempotent.
2. Use `upsert` or deterministic lookup before `create`.
3. Never delete legacy rows.
4. If a source cannot be mapped safely to a project, skip it and print a summary.
5. All scripts must log created, updated, skipped, and failed counts.

## Shared Helper Functions

If you create `scripts/phase1/_shared.ts`, it should contain:

- `buildOriginFingerprint(projectId, originType, originId, originItemKey)`
- `normalizeJsonArray(value)`
- `safeString(value)`
- `chunked<T>(items, size)`

`buildOriginFingerprint` must generate the exact string:

`"${projectId}:${originType}:${originId || 'none'}:${originItemKey || 'base'}"`

## Script 1: `backfill-project-strategies.ts`

### Read from

- `Project`

### Write to

- `ProjectStrategy`

### Mapping

- `Project.id -> ProjectStrategy.projectId`
- `Project.strategicVision -> ProjectStrategy.positioning`
- `Project.valueProposition -> ProjectStrategy.valueProposition`

### Behavior

- create one `ProjectStrategy` per project if missing
- update only `positioning` and `valueProposition` if the existing strategy row is empty in those fields
- leave JSON strategy fields null in this sprint

## Script 2: `backfill-methodology-profiles.ts`

### Read from

- `Organization`
- `PlatformSettings`
- `Project`

### Write to

- `MethodologyProfile`
- `ProjectMethodologyBinding`

### Exact profile creation rules

For each organization:

1. If `PlatformSettings.methodologyKnowledge` is non-empty, create or update:
   - `slug = "default-interview-methodology"`
   - `name = "Default Interview Methodology"`
   - `category = "stakeholder_research"`
   - `isDefault = true`
2. If `PlatformSettings.strategicMarketingKnowledge` is non-empty, create or update:
   - `slug = "default-strategic-marketing"`
   - `name = "Default Strategic Marketing"`
   - `category = "strategic_marketing"`
   - `isDefault = true`

### Exact binding rules

For every project in the organization:

- bind `default-strategic-marketing` as `PRIMARY` if it exists
- bind `default-interview-methodology` as `SECONDARY` if it exists

Do not attempt to enforce one-primary-at-db-level in this sprint.
Enforce the above rule only in the script behavior.

## Script 3: `backfill-data-sources.ts`

### Read from

- `Bot`
- `KnowledgeSource`
- `VisibilityConfig`
- `GoogleConnection`
- `CMSConnection`
- `MCPConnection`
- `N8NConnection`
- `ProjectCMSConnection`
- `ProjectMCPConnection`
- `ProjectVisibilityConfig`

### Write to

- `DataSource`
- `ProjectDataSourceBinding`

### Ownership rules

- `BOT`: always `DEDICATED`
- `KNOWLEDGE_SOURCE`: always `DEDICATED`
- `GOOGLE_CONNECTION`: always `DEDICATED`
- `N8N_CONNECTION`: always `DEDICATED`
- `VISIBILITY_CONFIG`: `SHARED` if it has any `projectShares`, otherwise `DEDICATED`
- `CMS_CONNECTION`: `SHARED` if it has any `ProjectCMSConnection`, otherwise `DEDICATED`
- `MCP_CONNECTION`: `SHARED` if it has any `ProjectMCPConnection`, otherwise `DEDICATED`

### Binding rules

- direct project-owned entities get one direct binding
- shared entities get one binding per linked project
- for `KnowledgeSource`, bind it to the same project as its `bot.projectId`

### Suggested binding roles

- `BOT`: `PRIMARY`
- `KNOWLEDGE_SOURCE`: `REFERENCE`
- `VISIBILITY_CONFIG`: `PRIMARY`
- `GOOGLE_CONNECTION`: `REFERENCE`
- `CMS_CONNECTION`: `EXECUTION`
- `MCP_CONNECTION`: `EXECUTION`
- `N8N_CONNECTION`: `EXECUTION`

### Label rules

Use these labels:

- `Bot.name`
- `KnowledgeSource.title` else `KnowledgeSource.type`
- `VisibilityConfig.brandName`
- `"Google: " + project.name`
- `CMSConnection.name`
- `MCPConnection.name`
- `N8NConnection.name`

## Script 4: `backfill-project-tips.ts`

### Read from

- `CrossChannelInsight`
- `WebsiteAnalysis`
- `BrandReport`
- `VisibilityConfig`
- `ProjectVisibilityConfig`

### Write to

- `ProjectTip`
- `ProjectTipEvidence`
- `ProjectTipRevision`

### Global rules

1. `ProjectTip` is always project-scoped.
2. If a legacy source has no resolvable project, skip it and log it.
3. Use `originFingerprint` so rerunning the script updates instead of duplicating.

### CrossChannelInsight mapping

- one `ProjectTip` per insight
- skip insights with `projectId = null`
- `originType = CROSS_CHANNEL_INSIGHT`
- `originId = insight.id`
- `originItemKey = "base"`
- `title = topicName`
- `summary = first 280 chars of reasoning-like text if derivable, else null`
- `priority = priorityScore`
- `reasoning = visibilityData.globalReasoning` if present, else null
- `recommendedActions = suggestedActions`
- `sourceSnapshot = { interviewData, chatbotData, visibilityData }`

### WebsiteAnalysis mapping

- one `ProjectTip` per recommendation item
- resolve project targets from `VisibilityConfig.projectId` plus `ProjectVisibilityConfig`
- `originType = WEBSITE_ANALYSIS`
- `originId = analysis.id`
- `originItemKey = "rec:${index}"`
- `title = recommendation.title`
- `summary = recommendation.description`
- `reasoning = recommendation.impact`
- `strategicAlignment = recommendation.strategyAlignment`
- `recommendedActions = recommendation.contentDraft || recommendation`
- `sourceSnapshot = recommendation`

### BrandReport mapping

- one `ProjectTip` per `aiTips.tips[]`
- resolve project targets from the linked `VisibilityConfig`
- `originType = BRAND_REPORT`
- `originId = report.id`
- `originItemKey = "tip:${index}"`
- `title = tip.title`
- `summary = tip.description || tip.summary || null`
- `reasoning = tip.rationale || tip.reasoning || null`
- `category = tip.category || null`
- `priority = tip.priority || tip.score || null`
- `sourceSnapshot = tip`

### Status mapping

Use this table:

- `new` -> `NEW`
- `reviewed` -> `REVIEWED`
- `approved` -> `APPROVED`
- `drafted` -> `DRAFTED`
- `routed` -> `ROUTED`
- `automated` -> `AUTOMATED`
- `completed` or `done` -> `COMPLETED`
- `dismissed` or `archived` -> `ARCHIVED`
- everything else -> `NEW`

### Evidence creation rules

Create `ProjectTipEvidence` rows only when evidence is explicit.

- from WebsiteAnalysis: `evidencePoints[]`
- from Copilot-style action evidence if present inside legacy payload
- from CrossChannel raw blocks only as coarse evidence rows:
  - `sourceType = "interview"` if `interviewData` is non-empty
  - `sourceType = "chatbot"` if `chatbotData` is non-empty
  - `sourceType = "visibility"` if `visibilityData` is non-empty

Do not invent metric values if they are not explicit.

## Script 5: `verify-project-intelligence-phase1.ts`

Print:

- total projects
- total project strategies
- total methodology profiles
- total methodology bindings
- total data sources
- total source bindings
- total canonical tips
- canonical tips by origin type
- skipped legacy rows summary if persisted in logs or rerun summary

Verification target:

- `ProjectStrategy.count >= Project.count`
- `ProjectTip.count > 0` if any legacy tip source exists
- no duplicate `originFingerprint`

## Run Order

```bash
npx ts-node scripts/phase1/backfill-project-strategies.ts
npx ts-node scripts/phase1/backfill-methodology-profiles.ts
npx ts-node scripts/phase1/backfill-data-sources.ts
npx ts-node scripts/phase1/backfill-project-tips.ts
npx ts-node scripts/phase1/verify-project-intelligence-phase1.ts
```

## Done Criteria

- all five scripts exist
- all scripts are idempotent
- verification output is coherent
- no runtime application file changed yet
