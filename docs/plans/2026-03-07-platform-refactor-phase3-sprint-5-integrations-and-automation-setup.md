# Platform Refactor Phase 3 Sprint 5 — Integrations And Automation Setup

**Goal**

Reduce the setup friction around integrations and AI routing so users can actually operationalize tips without understanding internal implementation details.

## Problems This Sprint Resolves

- integration setup is still fragmented by connector type and internal implementation concepts
- routing rules are too close to internal schema fields
- the product promise includes support for WordPress, WooCommerce, CMS voler.ai, GSC, GA and n8n, but the setup experience is not yet one coherent flow
- Copilot can talk about automation, but the product still needs a usable deterministic setup layer

## Files To Modify

- `src/app/dashboard/projects/[projectId]/integrations/page.tsx`
- `src/components/integrations/AiRoutingTab.tsx`
- relevant connector routes under:
  - `src/app/api/integrations/google/`
  - `src/app/api/integrations/mcp/`
  - `src/app/api/integrations/n8n/`
  - `src/app/api/cms/`
- optional new components under `src/components/integrations/`

## Required Changes

### 1. Reframe integrations by user goal

Organize the setup UI around outcomes, not connector internals.

Recommended groups:

- `Data Sources`
  - GSC
  - GA
  - visibility sources
- `Publishing Destinations`
  - WordPress
  - WooCommerce
  - CMS voler.ai
- `Automation`
  - n8n
  - MCP tools when relevant

### 2. Add connection readiness states

Each integration card should expose:

- connected or not connected
- healthy or degraded
- project-shared or dedicated
- data coverage or routing coverage
- next action required

Do not make the user infer readiness from raw IDs or hidden tabs.

### 3. Simplify routing rule language

Replace raw-field-first presentation with product language:

- “What kind of tip”
- “Where to send it”
- “Approval required or fully automatic”
- “Preview payload”

Internal fields like `contentKind` and `mcpTool` can still exist, but they should not dominate the UI copy.

### 4. Add guided automation recipes

Provide deterministic starter recipes for common outcomes:

- publish SEO article draft to WordPress
- send schema or GEO intervention to CMS/MCP destination
- push social-ready content to n8n
- send monitoring or reporting payload to webhook/n8n

Each recipe should state prerequisites and which tip kinds it accepts.

## Verification

1. A user can understand what is connected, what is missing and what can be automated from one screen.
2. Routing rules can be created without understanding raw internal fields first.
3. Shared vs dedicated integrations are visible in the setup UI.
4. At least one end-to-end recipe is testable from tip -> route -> execution.

## Done Criteria

- integrations setup matches the product promise more closely
- routing setup is understandable to non-technical users
- Copilot advice and product UI speak the same integration language
