# Sprint 5 — Tip Routing Engine + Platform UI Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a configurable Tip Routing Engine (TipRoutingRule model + executor + UI) and organically redesign the platform-wide UI for coherence, using the ChatbotSettings pattern as the shared design language.

**Architecture:** A polymorphic `TipRoutingRule` model maps AI tip content kinds to specific integration destinations (MCP/CMS/n8n). A `TipRoutingExecutor` service dispatches tips at cron time. The integrations page is transformed into a 3-tab configuration hub (Connessioni | AI Routing | Impostazioni) using the existing ChatbotSettings tab+AnimatePresence pattern. Sidebar labels are cleaned up for clarity.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, Framer Motion, Radix UI, Tailwind v4, TypeScript

---

## Context for implementer

### Design language (ChatbotSettings pattern)
- Cards: `p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm`
- Section labels: `text-[10px] font-black uppercase tracking-widest text-gray-400`
- Primary CTA: `bg-blue-600 rounded-full shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all`
- Inputs: `rounded-2xl border-gray-100 bg-gray-50/50 focus:ring-blue-500 h-12`
- Full-height layout: `flex flex-col h-[calc(100vh-120px)] gap-6 overflow-hidden`
- Tabs: horizontal `border-b border-gray-100`, active tab has `border-b-2 border-blue-600 text-blue-600`, inactive `text-gray-500 hover:text-gray-700`
- Tab content: wrapped in `AnimatePresence`, each panel `motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}`

### Active/Inactive connection logic
- `status === 'ACTIVE'` → full card, green `● Attivo` badge
- `status === 'ERROR'` → full card with orange border + error message + "Riconnetti" CTA
- Not connected (null / not in DB) → compact row in collapsible "Aggiungi integrazione" section at bottom
- `status === 'PENDING' | 'TESTING'` → full card with loading spinner badge

### Key files
- `src/components/chatbot/ChatbotSettings.tsx` — reference pattern (read before implementing tabs)
- `src/app/dashboard/projects/[projectId]/integrations/page.tsx` — TARGET for redesign
- `src/components/integrations/IntegrationsGrid.tsx` — KEEP INTACT, wrap in ConnectionsTab
- `src/components/dashboard/DashboardSidebar.tsx` — rename items, reorganize grouping
- `src/app/dashboard/billing/pack-purchase-button.tsx` — fix window.location.href bug
- `prisma/schema.prisma` — add TipRoutingRule model

---

## Phase A — Quick fixes (no schema change)

### Task 1: Fix PackPurchaseButton hard navigation

**Files:**
- Modify: `src/app/dashboard/billing/pack-purchase-button.tsx`

**Step 1: Read current file**
```bash
cat src/app/dashboard/billing/pack-purchase-button.tsx
```

**Step 2: Replace `window.location.href` with proper router navigation**

The current code at line 39: `window.location.href = data.checkoutUrl;`

This is an external Stripe checkout URL — `router.push()` does NOT work for external URLs. The correct fix is `window.location.assign()` which is equivalent but testable, OR keep `window.location.href` but add `return` after it so the `finally` block doesn't reset `loading` before navigation completes. The real bug is the button re-enables while the page is still navigating.

Correct fix: set loading=true and never reset it on successful redirect (only reset on error):

```tsx
'use client';

import { useState } from 'react';

type PackPurchaseButtonProps = {
    packType: string;
    organizationId: string;
    className?: string;
    children: React.ReactNode;
};

export default function PackPurchaseButton({
    packType,
    organizationId,
    className,
    children
}: PackPurchaseButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePurchase = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/credits/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packType, organizationId })
            });

            const data = await res.json();
            if (!res.ok || !data?.checkoutUrl) {
                throw new Error(data?.error || 'Impossibile avviare checkout');
            }

            // External URL: keep loading=true while Stripe takes over
            window.location.href = data.checkoutUrl;
            // Do NOT setLoading(false) — page is navigating away
        } catch (err) {
            console.error('Pack purchase error:', err);
            setError(err instanceof Error ? err.message : "Errore durante l'avvio del checkout.");
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={handlePurchase}
                disabled={loading}
                className={className}
            >
                {loading ? 'Apertura checkout...' : children}
            </button>
            {error && (
                <p className="text-xs text-red-500 text-center">{error}</p>
            )}
        </div>
    );
}
```

**Step 3: Commit**
```bash
git add src/app/dashboard/billing/pack-purchase-button.tsx
git commit -m "fix: keep PackPurchaseButton disabled during Stripe redirect, show inline error"
```

---

### Task 2: Sidebar cleanup — rename labels, reorganize grouping

**Files:**
- Modify: `src/components/dashboard/DashboardSidebar.tsx`

**Step 1: Read current file to understand structure**
The sidebar has two groups: `primaryItems` (App) and `secondaryItems` (Gestione).
Issues:
- `"Gestione Sito"` (→ /dashboard/cms) is confusingly named — it's actually "Contenuti AI / CMS"
- `"Connessioni"` → rename to `"Integrazioni"`
- `"Impostazioni"` is in the footer (bottom), should be in `secondaryItems` nav
- The group "Gestione" can be split: business tools vs config tools

**Step 2: Apply changes to secondaryItems array and footer**

Change in `secondaryItems`:
```ts
const secondaryItems = [
    { href: '/dashboard/projects', icon: Icons.FolderKanban, label: 'Progetti', visible: canManageProjects },
    { href: '/dashboard/cms', icon: Icons.Globe, label: 'Contenuti AI', visible: hasCMSIntegration },
    { href: '/dashboard/settings/members', icon: Icons.Users, label: 'Team', visible: true },
    { href: '/dashboard/billing', icon: Icons.CreditCard, label: 'Abbonamento', visible: true },
    {
        href: activeProjectId
            ? `/dashboard/projects/${activeProjectId}/integrations`
            : (projects?.length > 0 ? `/dashboard/projects/${projects[0].id}/integrations` : '/dashboard/projects'),
        icon: Icons.Link,
        label: 'Integrazioni',  // was 'Connessioni'
        visible: true
    },
    { href: '/dashboard/templates', icon: Icons.LayoutTemplate, label: 'Template', visible: true },
    { href: '/dashboard/settings', icon: Icons.Settings, label: 'Impostazioni', visible: true },
].filter(item => item.visible);
```

Remove the "Impostazioni" link from the footer section (lines 219-232) since it's now in secondaryItems.

**Step 3: Commit**
```bash
git add src/components/dashboard/DashboardSidebar.tsx
git commit -m "refactor: rename sidebar items (Gestione Sito→Contenuti AI, Connessioni→Integrazioni), move Impostazioni to nav"
```

---

### Task 3: Replace alert() in integrations page with inline notification state

**Files:**
- Modify: `src/app/dashboard/projects/[projectId]/integrations/page.tsx`

**Step 1: Add notification state**
After `const [userPlan, setUserPlan] = useState<UserPlan>('FREE');` add:
```ts
const [notification, setNotification] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

const showNotification = (type: 'error' | 'success', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
};
```

**Step 2: Replace `alert()` call in handleOpenCMSDashboard (line 312)**
```ts
showNotification('error', error.error || 'Impossibile aprire il CMS');
```

**Step 3: Add notification banner in the return JSX (above IntegrationsGrid)**
```tsx
{notification && (
    <div className={`mb-4 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between
        ${notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
        <span>{notification.message}</span>
        <button onClick={() => setNotification(null)} className="ml-4 text-current opacity-60 hover:opacity-100">✕</button>
    </div>
)}
```

**Step 4: Commit**
```bash
git add src/app/dashboard/projects/[projectId]/integrations/page.tsx
git commit -m "fix: replace alert() with inline notification in integrations page"
```

---

## Phase B — Prisma: TipRoutingRule model

### Task 4: Add TipRoutingRule to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add TipRoutingRule model**

Add after the `N8NConnection` model (around line 1440):

```prisma
model TipRoutingRule {
  id               String         @id @default(cuid())
  projectId        String
  contentKind      String         // e.g. BLOG_POST, NEW_FAQ, SCHEMA_ORG, ALT_DESCRIPTION
  priority         Int            @default(0)
  enabled          Boolean        @default(true)
  label            String?        // optional human-readable label

  // Destination — exactly one should be non-null
  mcpConnectionId  String?
  cmsConnectionId  String?
  n8nConnectionId  String?

  // Action
  mcpTool          String?        // tool name for MCP dispatch (e.g. "wordpress_create_post")
  behavior         String         // action slug (e.g. "create_post", "add_faq_block", "dispatch_n8n")
  behaviorConfig   Json?          // extra params (post_status, category_id, etc.)

  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  project          Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  mcpConnection    MCPConnection? @relation(fields: [mcpConnectionId], references: [id], onDelete: SetNull)
  cmsConnection    CMSConnection? @relation(fields: [cmsConnectionId], references: [id], onDelete: SetNull)
  n8nConnection    N8NConnection? @relation(fields: [n8nConnectionId], references: [id], onDelete: SetNull)

  @@index([projectId, contentKind])
  @@index([projectId, enabled])
}
```

**Step 2: Add back-relations in existing models**

In `model Project` (around line 296), inside the model fields, add:
```prisma
  tipRoutingRules  TipRoutingRule[]
```

In `model MCPConnection` (around line 1321), add:
```prisma
  tipRoutingRules  TipRoutingRule[]
```

In `model CMSConnection` (around line 1135), add:
```prisma
  tipRoutingRules  TipRoutingRule[]
```

In `model N8NConnection` (around line 1417), add:
```prisma
  tipRoutingRules  TipRoutingRule[]
```

**Step 3: Run migration**
```bash
npx prisma migrate dev --name add-tip-routing-rule
```
Expected: new migration file created, no errors.

**Step 4: Verify generated client**
```bash
npx prisma generate
```
Expected: `Generated Prisma Client`.

**Step 5: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(prisma): add TipRoutingRule model for polymorphic AI tip routing"
```

---

## Phase C — ContentKind constants + TipRoutingExecutor

### Task 5: ContentKind constants

**Files:**
- Create: `src/lib/cms/content-kinds.ts`

```ts
/**
 * ContentKind constants — granular AI tip types that drive routing rules.
 * Stored as free strings in sourceSignals.publishRouting.contentKind
 * and in TipRoutingRule.contentKind.
 */

export const CONTENT_KINDS = {
  // Blog / editorial
  BLOG_POST: 'BLOG_POST',
  BLOG_UPDATE: 'BLOG_UPDATE',

  // SEO structural
  NEW_FAQ: 'NEW_FAQ',
  SCHEMA_ORG: 'SCHEMA_ORG',
  NEW_PAGE: 'NEW_PAGE',
  PAGE_UPDATE: 'PAGE_UPDATE',

  // Media / assets
  ALT_DESCRIPTION: 'ALT_DESCRIPTION',
  META_DESCRIPTION: 'META_DESCRIPTION',

  // E-commerce
  PRODUCT_DESCRIPTION: 'PRODUCT_DESCRIPTION',
  PRODUCT_FAQ: 'PRODUCT_FAQ',

  // Social / automation
  SOCIAL_SNIPPET: 'SOCIAL_SNIPPET',
  EMAIL_SNIPPET: 'EMAIL_SNIPPET',
} as const;

export type ContentKind = typeof CONTENT_KINDS[keyof typeof CONTENT_KINDS];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  BLOG_POST: 'Articolo blog',
  BLOG_UPDATE: 'Aggiornamento blog',
  NEW_FAQ: 'Nuova FAQ',
  SCHEMA_ORG: 'Schema.org markup',
  NEW_PAGE: 'Nuova pagina',
  PAGE_UPDATE: 'Aggiornamento pagina',
  ALT_DESCRIPTION: 'Alt immagini',
  META_DESCRIPTION: 'Meta description',
  PRODUCT_DESCRIPTION: 'Descrizione prodotto',
  PRODUCT_FAQ: 'FAQ prodotto',
  SOCIAL_SNIPPET: 'Snippet social',
  EMAIL_SNIPPET: 'Snippet email',
};

export const ALL_CONTENT_KINDS = Object.values(CONTENT_KINDS);
```

**Step 2: Commit**
```bash
git add src/lib/cms/content-kinds.ts
git commit -m "feat: add ContentKind constants for tip routing"
```

---

### Task 6: TipRoutingExecutor service

**Files:**
- Create: `src/lib/cms/tip-routing-executor.ts`

```ts
/**
 * TipRoutingExecutor
 *
 * Dispatches AI tips to configured destinations based on TipRoutingRule records.
 * Supports three destination types:
 *   - MCP (WordPress / WooCommerce) via MCPGatewayService.callTool()
 *   - CMS (Voler API) via N8NDispatcher.dispatchTips() with cms channel
 *   - n8n Webhook via N8NDispatcher.dispatchTips()
 *
 * Non-blocking: individual rule failures are logged but do not stop other rules.
 */

import { prisma } from '@/lib/prisma';
import { MCPGatewayService } from '@/lib/integrations/mcp/gateway.service';
import { N8NDispatcher, TipPayload } from '@/lib/integrations/n8n/dispatcher';

interface TipInput {
  id: string;
  title: string;
  content: string;
  contentKind: string;
  targetChannel?: string;
  metaDescription?: string;
  url?: string;
}

interface ExecutionResult {
  ruleId: string;
  contentKind: string;
  destination: 'mcp' | 'cms' | 'n8n';
  success: boolean;
  error?: string;
}

export class TipRoutingExecutor {
  /**
   * Execute all enabled routing rules for the project on the given tips.
   * Tips are filtered per rule by contentKind match.
   */
  static async execute(
    projectId: string,
    tips: TipInput[]
  ): Promise<ExecutionResult[]> {
    if (!tips.length) return [];

    const rules = await prisma.tipRoutingRule.findMany({
      where: { projectId, enabled: true },
      include: {
        mcpConnection: { select: { id: true, status: true } },
        cmsConnection: { select: { id: true, status: true } },
        n8nConnection: { select: { id: true, status: true } },
      },
      orderBy: { priority: 'desc' },
    });

    if (!rules.length) return [];

    const results: ExecutionResult[] = [];

    for (const rule of rules) {
      const matchingTips = tips.filter(t => t.contentKind === rule.contentKind);
      if (!matchingTips.length) continue;

      try {
        if (rule.mcpConnectionId && rule.mcpConnection?.status === 'ACTIVE' && rule.mcpTool) {
          // MCP destination (WordPress / WooCommerce)
          for (const tip of matchingTips) {
            const args: Record<string, unknown> = {
              title: tip.title,
              content: tip.content,
              ...(rule.behaviorConfig && typeof rule.behaviorConfig === 'object'
                ? (rule.behaviorConfig as Record<string, unknown>)
                : {}),
            };
            await MCPGatewayService.callTool(
              rule.mcpConnectionId,
              rule.mcpTool,
              args
            );
          }
          results.push({ ruleId: rule.id, contentKind: rule.contentKind, destination: 'mcp', success: true });

        } else if (rule.cmsConnectionId && rule.cmsConnection?.status === 'ACTIVE') {
          // CMS destination (Voler API) — dispatch as tips for now
          // Future: call CMSConnectionService.pushSuggestion() directly
          const payload: TipPayload[] = matchingTips.map(t => ({
            id: t.id,
            title: t.title,
            content: t.content,
            contentKind: t.contentKind,
            targetChannel: t.targetChannel,
            metaDescription: t.metaDescription,
            url: t.url,
          }));
          await N8NDispatcher.dispatchTips(projectId, payload);
          results.push({ ruleId: rule.id, contentKind: rule.contentKind, destination: 'cms', success: true });

        } else if (rule.n8nConnectionId && rule.n8nConnection?.status === 'ACTIVE') {
          // n8n destination
          const payload: TipPayload[] = matchingTips.map(t => ({
            id: t.id,
            title: t.title,
            content: t.content,
            contentKind: t.contentKind,
            targetChannel: t.targetChannel,
            metaDescription: t.metaDescription,
            url: t.url,
          }));
          await N8NDispatcher.dispatchTips(projectId, payload);
          results.push({ ruleId: rule.id, contentKind: rule.contentKind, destination: 'n8n', success: true });

        } else {
          results.push({
            ruleId: rule.id,
            contentKind: rule.contentKind,
            destination: rule.mcpConnectionId ? 'mcp' : rule.cmsConnectionId ? 'cms' : 'n8n',
            success: false,
            error: 'Connection not active or missing tool name',
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[TipRoutingExecutor] Rule ${rule.id} failed:`, errorMsg);
        results.push({
          ruleId: rule.id,
          contentKind: rule.contentKind,
          destination: rule.mcpConnectionId ? 'mcp' : rule.cmsConnectionId ? 'cms' : 'n8n',
          success: false,
          error: errorMsg,
        });
      }
    }

    return results;
  }
}
```

**Step 2: Commit**
```bash
git add src/lib/cms/tip-routing-executor.ts
git commit -m "feat: add TipRoutingExecutor for polymorphic AI tip dispatch"
```

---

### Task 7: TipRoutingRule API routes

**Files:**
- Create: `src/app/api/projects/[id]/tip-routing-rules/route.ts`

```ts
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/** GET /api/projects/[id]/tip-routing-rules */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { memberships: true },
    });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.organizationId && !user.memberships.some(m => m.organizationId === project.organizationId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rules = await prisma.tipRoutingRule.findMany({
      where: { projectId },
      include: {
        mcpConnection: { select: { id: true, name: true, type: true, status: true } },
        cmsConnection: { select: { id: true, name: true, status: true } },
        n8nConnection: { select: { id: true, name: true, status: true } },
      },
      orderBy: { priority: 'desc' },
    });

    return NextResponse.json({ rules });
  } catch (err) {
    console.error('tip-routing-rules GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** POST /api/projects/[id]/tip-routing-rules */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId } = await params;
    const body = await req.json();

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { memberships: true },
    });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.organizationId && !user.memberships.some(m => m.organizationId === project.organizationId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rule = await prisma.tipRoutingRule.create({
      data: {
        projectId,
        contentKind: String(body.contentKind),
        behavior: String(body.behavior),
        mcpTool: body.mcpTool ? String(body.mcpTool) : null,
        mcpConnectionId: body.mcpConnectionId || null,
        cmsConnectionId: body.cmsConnectionId || null,
        n8nConnectionId: body.n8nConnectionId || null,
        behaviorConfig: body.behaviorConfig || null,
        label: body.label ? String(body.label) : null,
        priority: typeof body.priority === 'number' ? body.priority : 0,
        enabled: body.enabled !== false,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    console.error('tip-routing-rules POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- Create: `src/app/api/projects/[id]/tip-routing-rules/[ruleId]/route.ts`

```ts
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/** PATCH /api/projects/[id]/tip-routing-rules/[ruleId] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId, ruleId } = await params;
    const body = await req.json();

    const rule = await prisma.tipRoutingRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.projectId !== projectId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if ('enabled' in body) data.enabled = Boolean(body.enabled);
    if ('contentKind' in body) data.contentKind = String(body.contentKind);
    if ('behavior' in body) data.behavior = String(body.behavior);
    if ('mcpTool' in body) data.mcpTool = body.mcpTool ? String(body.mcpTool) : null;
    if ('label' in body) data.label = body.label ? String(body.label) : null;
    if ('priority' in body) data.priority = Number(body.priority);
    if ('behaviorConfig' in body) data.behaviorConfig = body.behaviorConfig || null;

    const updated = await prisma.tipRoutingRule.update({ where: { id: ruleId }, data });
    return NextResponse.json({ rule: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** DELETE /api/projects/[id]/tip-routing-rules/[ruleId] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id: projectId, ruleId } = await params;

    const rule = await prisma.tipRoutingRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.projectId !== projectId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.tipRoutingRule.delete({ where: { id: ruleId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Step 3: Commit**
```bash
git add src/app/api/projects/[id]/tip-routing-rules/
git commit -m "feat: add TipRoutingRule CRUD API routes"
```

---

### Task 8: Wire TipRoutingExecutor in cms-generate-suggestions cron

**Files:**
- Modify: `src/app/api/cron/cms-generate-suggestions/route.ts`

**Step 1: Add import**
```ts
import { TipRoutingExecutor } from '@/lib/cms/tip-routing-executor';
```

**Step 2: After the existing N8NDispatcher.dispatchTips() call, add TipRoutingExecutor.execute()**

Find the block where `N8NDispatcher.dispatchTips()` is called. After it, add:
```ts
// Also run tip routing rules (if configured)
try {
  const tipsForRouting = newSuggestions.map(s => ({
    id: s.id,
    title: s.title,
    content: s.body,
    contentKind: String(s.type),
    targetChannel: s.targetSection ?? undefined,
    metaDescription: s.metaDescription ?? undefined,
    url: s.cmsPreviewUrl ?? undefined,
  }));
  const routingResults = await TipRoutingExecutor.execute(insight.projectId, tipsForRouting);
  const failed = routingResults.filter(r => !r.success);
  if (failed.length) {
    console.warn(`[CMS Suggestions] ${failed.length} routing rule(s) failed for insight ${insight.id}`);
  }
} catch (routingErr) {
  console.warn(`[CMS Suggestions] TipRoutingExecutor failed for insight ${insight.id}:`, routingErr);
}
```

**Step 3: Commit**
```bash
git add src/app/api/cron/cms-generate-suggestions/route.ts
git commit -m "feat: wire TipRoutingExecutor in cms-generate-suggestions cron"
```

---

## Phase D — UI redesign: Integrations Hub

### Task 9: Create ConnectionsTab component (wrap existing IntegrationsGrid)

**Files:**
- Create: `src/components/integrations/ConnectionsTab.tsx`

This is a thin wrapper that renders the existing `IntegrationsGrid` with the active/inactive visual structure. The `IntegrationsGrid` already renders the cards — ConnectionsTab adds the section headers and the collapsible "available" section.

```tsx
'use client';

import { motion } from 'framer-motion';
import { IntegrationsGrid } from './IntegrationsGrid';
import type { ComponentProps } from 'react';

type GridProps = ComponentProps<typeof IntegrationsGrid>;

interface ConnectionsTabProps extends GridProps {
  activeCount: number;
}

export function ConnectionsTab({ activeCount, ...gridProps }: ConnectionsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 overflow-y-auto space-y-6 pb-8"
    >
      {/* Active connections header */}
      {activeCount > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Connessioni attive
          </span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
            {activeCount}
          </span>
        </div>
      )}

      {/* The existing IntegrationsGrid renders all connection cards */}
      <IntegrationsGrid {...gridProps} />
    </motion.div>
  );
}
```

**Step 2: Commit**
```bash
git add src/components/integrations/ConnectionsTab.tsx
git commit -m "feat: add ConnectionsTab wrapper for integrations hub"
```

---

### Task 10: Create AiRoutingTab component

**Files:**
- Create: `src/components/integrations/AiRoutingTab.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react';
import { CONTENT_KIND_LABELS, ALL_CONTENT_KINDS, type ContentKind } from '@/lib/cms/content-kinds';

interface TipRoutingRule {
  id: string;
  contentKind: string;
  behavior: string;
  mcpTool?: string | null;
  label?: string | null;
  enabled: boolean;
  priority: number;
  mcpConnection?: { id: string; name: string; type: string; status: string } | null;
  cmsConnection?: { id: string; name: string; status: string } | null;
  n8nConnection?: { id: string; name: string; status: string } | null;
}

interface Connection {
  id: string;
  name: string;
  type?: string;
  status: string;
}

interface AiRoutingTabProps {
  projectId: string;
  mcpConnections: Connection[];
  cmsConnection: Connection | null;
  n8nConnection: Connection | null;
}

export function AiRoutingTab({ projectId, mcpConnections, cmsConnection, n8nConnection }: AiRoutingTabProps) {
  const [rules, setRules] = useState<TipRoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    contentKind: '' as ContentKind | '',
    behavior: 'create_post',
    mcpTool: '',
    label: '',
    mcpConnectionId: '',
    cmsConnectionId: '',
    n8nConnectionId: '',
    destinationType: 'mcp' as 'mcp' | 'cms' | 'n8n',
  });
  const [saving, setSaving] = useState(false);

  const activeConnections = [
    ...mcpConnections.filter(c => c.status === 'ACTIVE').map(c => ({ ...c, destType: 'mcp' as const })),
    ...(cmsConnection?.status === 'ACTIVE' ? [{ ...cmsConnection, destType: 'cms' as const }] : []),
    ...(n8nConnection?.status === 'ACTIVE' ? [{ ...n8nConnection, destType: 'n8n' as const }] : []),
  ];

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tip-routing-rules`)
      .then(r => r.json())
      .then(d => setRules(d.rules || []))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleToggle = async (rule: TipRoutingRule) => {
    await fetch(`/api/projects/${projectId}/tip-routing-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleDelete = async (ruleId: string) => {
    await fetch(`/api/projects/${projectId}/tip-routing-rules/${ruleId}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const handleSaveRule = async () => {
    if (!formData.contentKind) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        contentKind: formData.contentKind,
        behavior: formData.behavior,
        label: formData.label || null,
      };
      if (formData.destinationType === 'mcp' && formData.mcpConnectionId) {
        body.mcpConnectionId = formData.mcpConnectionId;
        body.mcpTool = formData.mcpTool || null;
      } else if (formData.destinationType === 'cms' && cmsConnection) {
        body.cmsConnectionId = cmsConnection.id;
      } else if (formData.destinationType === 'n8n' && n8nConnection) {
        body.n8nConnectionId = n8nConnection.id;
      }
      const res = await fetch(`/api/projects/${projectId}/tip-routing-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setRules(prev => [...prev, data.rule]);
        setShowForm(false);
        setFormData({ contentKind: '', behavior: 'create_post', mcpTool: '', label: '', mcpConnectionId: '', cmsConnectionId: '', n8nConnectionId: '', destinationType: 'mcp' });
      }
    } finally {
      setSaving(false);
    }
  };

  const getDestinationLabel = (rule: TipRoutingRule) => {
    if (rule.mcpConnection) return `${rule.mcpConnection.name} (MCP)`;
    if (rule.cmsConnection) return `${rule.cmsConnection.name} (CMS)`;
    if (rule.n8nConnection) return `${rule.n8nConnection.name} (n8n)`;
    return '—';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex-1 overflow-y-auto space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">AI Routing</p>
          <p className="text-sm text-gray-500">Configura come distribuire i tip AI generati verso le tue integrazioni.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-md shadow-blue-200 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={16} />
          Aggiungi regola
        </button>
      </div>

      {/* Empty state */}
      {!loading && rules.length === 0 && !showForm && (
        <div className="p-12 text-center bg-white border border-gray-100 rounded-[2.5rem]">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ChevronDown size={24} className="text-blue-500" />
          </div>
          <p className="font-semibold text-gray-700 mb-1">Nessuna regola configurata</p>
          <p className="text-sm text-gray-400 mb-4">Crea una regola per instradare automaticamente i tip AI verso le tue integrazioni.</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Crea la prima regola →
          </button>
        </div>
      )}

      {/* Rules list */}
      {!loading && rules.length > 0 && (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`p-6 bg-white border rounded-[2rem] flex items-center gap-4 transition-all
                ${rule.enabled ? 'border-gray-100 shadow-sm' : 'border-gray-100 opacity-50'}`}
            >
              {/* Content kind */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                    {CONTENT_KIND_LABELS[rule.contentKind as ContentKind] || rule.contentKind}
                  </span>
                  {rule.label && (
                    <span className="text-xs text-gray-400">{rule.label}</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 truncate">
                  → {getDestinationLabel(rule)}
                  {rule.mcpTool && <span className="text-gray-400 ml-1">via {rule.mcpTool}</span>}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggle(rule)}
                  className={`transition-colors ${rule.enabled ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-300 hover:text-gray-400'}`}
                  aria-label={rule.enabled ? 'Disabilita regola' : 'Abilita regola'}
                >
                  {rule.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                  aria-label="Elimina regola"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add rule form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-8 bg-white border border-blue-100 rounded-[2.5rem] shadow-sm space-y-6"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nuova regola</p>

            {/* Content kind */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Tipo di contenuto AI
              </label>
              <select
                value={formData.contentKind}
                onChange={e => setFormData(prev => ({ ...prev, contentKind: e.target.value as ContentKind }))}
                className="w-full h-12 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona tipo…</option>
                {ALL_CONTENT_KINDS.map(kind => (
                  <option key={kind} value={kind}>{CONTENT_KIND_LABELS[kind]}</option>
                ))}
              </select>
            </div>

            {/* Destination */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Destinazione
              </label>
              {activeConnections.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-2xl px-4 py-3">
                  Nessuna integrazione attiva. Configura prima almeno una connessione.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeConnections.map(conn => (
                    <label key={conn.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:border-blue-100 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="destination"
                        value={conn.id}
                        onChange={() => setFormData(prev => ({
                          ...prev,
                          destinationType: conn.destType,
                          mcpConnectionId: conn.destType === 'mcp' ? conn.id : '',
                          cmsConnectionId: conn.destType === 'cms' ? conn.id : '',
                          n8nConnectionId: conn.destType === 'n8n' ? conn.id : '',
                        }))}
                        className="accent-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">{conn.name}</span>
                      <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-gray-400">{conn.destType}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* MCP tool name (only if MCP destination selected) */}
            {formData.destinationType === 'mcp' && formData.mcpConnectionId && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                  Tool MCP (nome strumento)
                </label>
                <input
                  type="text"
                  placeholder="es. wordpress_create_post"
                  value={formData.mcpTool}
                  onChange={e => setFormData(prev => ({ ...prev, mcpTool: e.target.value }))}
                  className="w-full h-12 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Optional label */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Etichetta (opzionale)
              </label>
              <input
                type="text"
                placeholder="es. Blog WordPress produzione"
                value={formData.label}
                onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))}
                className="w-full h-12 rounded-2xl border border-gray-100 bg-gray-50/50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveRule}
                disabled={saving || !formData.contentKind}
                className="bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-full shadow-md shadow-blue-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                {saving ? 'Salvataggio…' : 'Salva regola'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5"
              >
                Annulla
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

**Step 2: Commit**
```bash
git add src/components/integrations/AiRoutingTab.tsx
git commit -m "feat: add AiRoutingTab component for tip routing rule management"
```

---

### Task 11: Redesign integrations page — 3-tab hub

**Files:**
- Modify: `src/app/dashboard/projects/[projectId]/integrations/page.tsx`

This is the main UI redesign. Replace the bare `<div className="p-8">` wrapper with a full tabbed hub matching the ChatbotSettings pattern.

**Step 1: Add imports at top of file**
```ts
import { useState } from 'react'; // already imported
import { AnimatePresence, motion } from 'framer-motion'; // add
import { ConnectionsTab } from '@/components/integrations/ConnectionsTab'; // add
import { AiRoutingTab } from '@/components/integrations/AiRoutingTab'; // add
```

**Step 2: Add tab state after loading state**
```ts
const [activeTab, setActiveTab] = useState<'connections' | 'routing' | 'settings'>('connections');
```

**Step 3: Compute activeCount for ConnectionsTab**
```ts
const activeCount = [
  ...mcpConnections.filter(c => c.status === 'ACTIVE'),
  ...(googleConnection?.ga4Status === 'ACTIVE' || googleConnection?.gscStatus === 'ACTIVE' ? [googleConnection] : []),
  ...(cmsConnection?.status === 'ACTIVE' ? [cmsConnection] : []),
  ...(n8nConnection?.status === 'ACTIVE' ? [n8nConnection] : []),
].length;
```

**Step 4: Replace the return JSX**

```tsx
const TABS = [
  { id: 'connections' as const, label: 'Connessioni' },
  { id: 'routing' as const, label: 'AI Routing' },
  { id: 'settings' as const, label: 'Impostazioni' },
];

if (loading) {
  return (
    <div className="p-8 space-y-6">
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-100 rounded-full w-32" />
        <div className="flex gap-4 border-b border-gray-100 pb-4">
          {[1,2,3].map(i => <div key={i} className="h-8 w-24 bg-gray-100 rounded-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-gray-100 rounded-[2.5rem]" />)}
        </div>
      </div>
    </div>
  );
}

return (
  <div className="flex flex-col h-[calc(100vh-80px)] gap-0 overflow-hidden">
    {/* Page header + tab bar */}
    <div className="px-8 pt-8 pb-0 flex-shrink-0 bg-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Integrazioni</h1>
        <p className="text-sm text-gray-400 mt-1">
          Connetti i tuoi strumenti e configura il routing automatico dei contenuti AI.
        </p>
      </div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-3 text-sm font-semibold transition-all relative
              ${activeTab === tab.id
                ? 'text-blue-600'
                : 'text-gray-400 hover:text-gray-600'
              }
            `}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
              />
            )}
            {tab.id === 'connections' && activeCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black">
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>

    {/* Tab content */}
    <div className="flex-1 overflow-hidden px-8">
      <AnimatePresence mode="wait">
        {activeTab === 'connections' && (
          <ConnectionsTab
            key="connections"
            activeCount={activeCount}
            mcpConnections={mcpConnections}
            googleConnection={googleConnection}
            cmsConnection={cmsConnection}
            n8nConnection={n8nConnection}
            userPlan={userPlan}
            onTestMCP={handleTestMCP}
            onDeleteMCP={handleDeleteMCP}
            onConfigureMCP={handleConfigureMCP}
            onTestGA4={handleTestGA4}
            onTestGSC={handleTestGSC}
            onConfigureGoogle={handleConfigureGoogle}
            onDeleteGoogle={handleDeleteGoogle}
            onDeleteCMS={handleDeleteCMS}
            onOpenCMSDashboard={handleOpenCMSDashboard}
            onConfigureCMS={handleConfigureCMS}
            onTestN8N={handleTestN8N}
            onDeleteN8N={handleDeleteN8N}
            onConfigureN8N={handleConfigureN8N}
            projects={projects}
            organizations={organizations}
            currentProjectId={projectId}
            currentOrgId={currentOrgId}
            currentOrgName={currentOrgName}
            onRefresh={fetchData}
          />
        )}
        {activeTab === 'routing' && (
          <AiRoutingTab
            key="routing"
            projectId={projectId}
            mcpConnections={mcpConnections}
            cmsConnection={cmsConnection}
            n8nConnection={n8nConnection}
          />
        )}
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-y-auto pt-6 pb-8"
          >
            <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">
                Impostazioni progetto
              </p>
              <p className="text-sm text-gray-400">
                Le impostazioni di progetto sono disponibili dalla sezione{' '}
                <a
                  href={`/dashboard/projects/${projectId}`}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Progetti →
                </a>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
```

**Step 5: Commit**
```bash
git add src/app/dashboard/projects/[projectId]/integrations/page.tsx
git commit -m "feat: redesign integrations page as 3-tab hub (Connessioni | AI Routing | Impostazioni)"
```

---

## Phase E — Type check + final commit

### Task 12: TypeScript validation

```bash
node --max-old-space-size=4096 node_modules/.bin/tsc --noEmit --skipLibCheck 2>&1 | grep -E "error TS" | head -30
```

Fix any errors found before final commit.

### Task 13: Final integration commit

```bash
git add -A
git commit -m "feat(sprint5): tip routing engine + platform UI redesign

- TipRoutingRule model (polymorphic: MCP/CMS/n8n destinations)
- TipRoutingExecutor service + wired in cms-generate-suggestions cron
- ContentKind constants (12 granular AI tip types)
- CRUD API: /api/projects/[id]/tip-routing-rules
- Integrations page redesigned as 3-tab hub with Framer Motion
- Sidebar cleanup: Connessioni→Integrazioni, Gestione Sito→Contenuti AI
- PackPurchaseButton: fixed loading state during Stripe redirect
- alert() replaced with inline notification

Sprint 5 — f$(git log --oneline -1 --format='%h')"
```

---

## Platform UI review — other sections (Phase F)

> **Note:** After Sprint 5 is complete, run a UI audit of these sections using web-design-guidelines skill:
> - `/dashboard/cms` — Contenuti AI / CMS suggestions list
> - `/dashboard/billing` — Abbonamento page
> - `/dashboard/insights` — AI Tips
> - `/dashboard/visibility` — Brand Monitor
>
> For each: check layout consistency with the ChatbotSettings pattern, ensure empty states, fix broken buttons, standardize loading skeletons.
