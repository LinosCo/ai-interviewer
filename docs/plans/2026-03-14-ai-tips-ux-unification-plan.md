# AI Tips UX Unification — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify 3 parallel tip systems into one ProjectTip-based model with simplified states, minimal UI, and reorganized sidebar navigation.

**Architecture:** Eliminate VirtualInsight layer, materialize all tips as ProjectTip immediately, add `getVisibleStatus()` derived function for 3-state UI, rebuild insights page as single-view row-based list grouped by origin category, promote Site Analysis to independent sidebar item, add strategy interview wizard.

**Tech Stack:** Next.js 14, React, Tailwind CSS, Prisma, TypeScript

---

### Task 1: Add `siteAnalysis` feature flag to plans config

**Files:**
- Modify: `src/config/plans.ts:29` (PlanFeatures interface)
- Modify: `src/config/plans.ts:109-524` (each plan definition)

**Step 1: Add field to PlanFeatures interface**

In `src/config/plans.ts`, add `siteAnalysis: boolean;` after `visibilityTracker`:

```typescript
// line 33, after visibilityTracker
siteAnalysis: boolean;
```

**Step 2: Add field to PlanLimits interface**

After `visibilityEnabled` (~line 61):

```typescript
siteAnalysisEnabled: boolean;
```

**Step 3: Set values in each plan**

For each plan in PLANS, add `siteAnalysis` and `siteAnalysisEnabled`:
- FREE: `false`, `false`
- TRIAL: `true`, `true`
- STARTER: `false`, `false`
- PROFESSIONAL: `true`, `true`
- BUSINESS: `true`, `true`
- PARTNER: `true`, `true`
- ENTERPRISE: `true`, `true`
- ADMIN: `true`, `true`

Pattern: same as `visibilityTracker` for each plan.

**Step 4: Commit**

```bash
git add src/config/plans.ts
git commit -m "feat: add siteAnalysis independent feature flag to plans"
```

---

### Task 2: Wire `hasSiteAnalysis` through sidebar

**Files:**
- Modify: `src/app/dashboard/layout.tsx:129-158`
- Modify: `src/components/dashboard/DashboardSidebar.tsx:12-48`

**Step 1: Add hasSiteAnalysis to layout.tsx**

In `src/app/dashboard/layout.tsx`, after line 141 (`hasAiTips = plan.features.aiTips;`):

```typescript
hasSiteAnalysis = plan.features.siteAnalysis;
```

Also declare it at the top where other flags are declared (before the if block), and add to admin block (line 133):

```typescript
hasSiteAnalysis = true;
```

Pass it to DashboardSidebar props (line 158):

```typescript
hasSiteAnalysis={hasSiteAnalysis}
```

**Step 2: Update DashboardSidebar props and primaryItems**

In `DashboardSidebar.tsx`, add `hasSiteAnalysis` to props interface (line 19):

```typescript
hasSiteAnalysis?: boolean;
```

Add to destructured props (line 29):

```typescript
hasSiteAnalysis = false,
```

Reorder `primaryItems` (lines 42-48) to:

```typescript
const primaryItems = [
    { href: '/dashboard/interviews', icon: Icons.MessageSquare, label: 'Interviste AI', visible: true },
    { href: '/dashboard/bots', icon: Icons.Bot, label: 'Chatbot AI', visible: hasChatbot },
    { href: '/dashboard/visibility', icon: Icons.Search, label: 'Brand Monitor', visible: hasVisibilityTracker },
    { href: '/dashboard/site-analysis', icon: Icons.Globe, label: 'Analisi Sito', visible: hasSiteAnalysis },
    { href: '/dashboard/insights', icon: Icons.Layers, label: 'AI Tips', visible: hasAiTips },
    { href: '/dashboard/training', icon: Icons.GraduationCap, label: 'Formazione', visible: true },
].filter(item => item.visible);
```

**Step 3: Commit**

```bash
git add src/app/dashboard/layout.tsx src/components/dashboard/DashboardSidebar.tsx
git commit -m "feat: wire hasSiteAnalysis flag and reorder sidebar"
```

---

### Task 3: Create `/dashboard/site-analysis` route

**Files:**
- Create: `src/app/dashboard/site-analysis/page.tsx`

**Step 1: Create page**

This is a thin wrapper that reuses the existing SiteAnalysisClient but at a new path. Copy the pattern from `src/app/dashboard/visibility/site-analysis/page.tsx` but adapted to the new path.

The server component should:
1. Get session and organization
2. Find the VisibilityConfig
3. Render SiteAnalysisClient with appropriate props
4. NOT render AITipsSection (tips are managed in AI Tips page)

Import SiteAnalysisClient from the existing location: `@/app/dashboard/visibility/site-analysis/SiteAnalysisClient`

**Step 2: Commit**

```bash
git add src/app/dashboard/site-analysis/page.tsx
git commit -m "feat: create independent /dashboard/site-analysis route"
```

---

### Task 4: Add `getVisibleStatus()` to project-tip-ui.ts

**Files:**
- Modify: `src/components/projects/project-tip-ui.ts`

**Step 1: Add the function after `getTipOperationalState` (after line 108)**

```typescript
export type VisibleTipStatus = 'nuovo' | 'in_lavorazione' | 'completato' | 'archiviato';

export function getVisibleStatus(
  tip: ProjectTipSnapshot,
  detail?: ProjectTipDetailSnapshot | null,
): { status: VisibleTipStatus; label: string; dotClass: string; hasError: boolean } {
  // Archived
  if (tip.status === 'ARCHIVED') {
    return { status: 'archiviato', label: 'Archiviato', dotClass: 'bg-slate-400', hasError: false };
  }

  // Completed
  const hasCompletedExecution = Boolean(detail?.executions.some((e) => e.status === 'SUCCEEDED'));
  if (hasCompletedExecution || tip.status === 'COMPLETED') {
    return { status: 'completato', label: 'Completato', dotClass: 'bg-emerald-500', hasError: false };
  }

  // In lavorazione — has routing, draft, or dispatched execution
  const hasFailed = Boolean(
    detail?.executions.some((e) => e.status === 'FAILED')
    || detail?.routes.some((r) => r.status === 'FAILED'),
  );
  const hasRouting = (tip.routeCount ?? 0) > 0
    || tip.routingStatus === 'PLANNED'
    || tip.routingStatus === 'READY'
    || tip.routingStatus === 'DISPATCHED';
  const hasDraft = tip.draftStatus === 'READY' || tip.draftStatus === 'GENERATED';
  const isInProgress = tip.status === 'REVIEWED'
    || tip.status === 'APPROVED'
    || tip.status === 'DRAFTED'
    || tip.status === 'ROUTED'
    || tip.status === 'AUTOMATED';

  if (hasRouting || hasDraft || isInProgress) {
    return { status: 'in_lavorazione', label: 'In lavorazione', dotClass: 'bg-amber-500', hasError: hasFailed };
  }

  // Default: Nuovo
  return { status: 'nuovo', label: 'Nuovo', dotClass: 'bg-blue-500', hasError: false };
}
```

**Step 2: Commit**

```bash
git add src/components/projects/project-tip-ui.ts
git commit -m "feat: add getVisibleStatus() derived status for simplified tip UI"
```

---

### Task 5: Add origin category helpers

**Files:**
- Modify: `src/components/projects/project-tip-ui.ts`

**Step 1: Add category mapping function**

After `getVisibleStatus`, add:

```typescript
export type TipOriginCategory = 'sito' | 'ascolto' | 'copilot' | 'manuale';

export function getTipOriginCategory(tip: ProjectTipSnapshot): TipOriginCategory {
  switch (tip.originType) {
    case 'BRAND_REPORT':
    case 'WEBSITE_ANALYSIS':
      return 'sito';
    case 'CROSS_CHANNEL_INSIGHT':
      return 'ascolto';
    case 'COPILOT':
      return 'copilot';
    case 'MANUAL':
    default:
      return 'manuale';
  }
}

export const ORIGIN_CATEGORY_LABELS: Record<TipOriginCategory, string> = {
  sito: 'SEO & LLM',
  ascolto: 'Ascolto',
  copilot: 'Copilot',
  manuale: 'Manuale',
};

export const ORIGIN_CATEGORY_ICONS: Record<TipOriginCategory, string> = {
  sito: 'Globe',
  ascolto: 'MessageCircle',
  copilot: 'Sparkles',
  manuale: 'PenLine',
};
```

**Step 2: Commit**

```bash
git add src/components/projects/project-tip-ui.ts
git commit -m "feat: add origin category mapping for tip grouping"
```

---

### Task 6: Ensure materialization sets correct originType

**Files:**
- Review: `src/lib/projects/project-tip-grounding.service.ts` (verify originType is set to 'BRAND_REPORT' and 'WEBSITE_ANALYSIS')
- Review: `src/lib/insights/sync-engine.ts` (verify CrossChannelInsight materialization sets 'CROSS_CHANNEL_INSIGHT')

**Step 1: Verify existing materialization**

Read `project-tip-grounding.service.ts` and confirm:
- `buildFromBrandReport()` sets `originType: 'BRAND_REPORT'`
- `buildFromWebsiteAnalysis()` sets `originType: 'WEBSITE_ANALYSIS'`
- `buildFromCrossChannelInsight()` sets `originType: 'CROSS_CHANNEL_INSIGHT'`

If any are missing or incorrect, fix them.

**Step 2: Verify materialization is called on generation**

Check `brand-report-engine.ts` line ~376 and `website-analysis-engine.ts` line ~870 to confirm `materializeFromBrandReport` and `materializeFromWebsiteAnalysis` are already called after report/analysis completes.

**Step 3: Commit if changes needed**

```bash
git add src/lib/projects/project-tip-grounding.service.ts
git commit -m "fix: ensure correct originType on all materialization paths"
```

---

### Task 7: Build unified AI Tips page — data layer

**Files:**
- Modify: `src/app/dashboard/insights/page.tsx` (major rewrite of the page)

**Step 1: Simplify imports and types**

Remove imports for:
- `loadSiteAnalysisInsights`
- `InsightCard` (if imported)
- Tab-related state for Listen/Strategy views

Keep imports for:
- ProjectTip types, API fetching
- UI components (Button, Badge, etc.)

**Step 2: Replace Insight type with ProjectTip-based type**

The page should fetch from `/api/projects/{projectId}/tips` (canonical tips) instead of the dual insight/virtual system.

Remove:
- `InsightWorkspaceView` type and all tab switching logic
- `isVirtual` handling
- `loadSiteAnalysisInsights` calls
- Virtual tip special-casing in render

**Step 3: Add state for filters**

```typescript
const [statusFilter, setStatusFilter] = useState<VisibleTipStatus | 'all'>('all');
const [categoryFilter, setCategoryFilter] = useState<TipOriginCategory | 'all'>('all');
const [starredOnly, setStarredOnly] = useState(false);
```

**Step 4: Commit**

```bash
git add src/app/dashboard/insights/page.tsx
git commit -m "refactor: simplify insights page data layer to use ProjectTip only"
```

---

### Task 8: Build unified AI Tips page — strategy banner

**Files:**
- Modify: `src/app/dashboard/insights/page.tsx`

**Step 1: Create StrategyBanner component**

Inline component at top of page. Two states:

**Not configured:**
```tsx
<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="p-2 rounded-lg bg-amber-50">
      <Target className="w-5 h-5 text-amber-600" />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-700">Configura la strategia del progetto</p>
      <p className="text-xs text-slate-500">Riceverai suggerimenti AI più mirati e pertinenti.</p>
    </div>
  </div>
  <Button variant="outline" size="sm" onClick={openStrategyWizard}>
    Configura strategia
  </Button>
</div>
```

**Configured:**
```tsx
<div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="p-2 rounded-lg bg-emerald-50">
      <Target className="w-5 h-5 text-emerald-600" />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-700">{strategicVision?.slice(0, 80)}...</p>
      <p className="text-xs text-slate-500">{objectivesCount} obiettivi definiti</p>
    </div>
  </div>
  <Button variant="ghost" size="sm" onClick={openStrategyWizard}>
    Modifica
  </Button>
</div>
```

**Step 2: Strategy wizard dialog**

For now, implement as a Dialog with the existing textarea approach (strategic vision + value proposition). The AI interview wizard is a follow-up enhancement.

```tsx
<Dialog open={strategyOpen} onOpenChange={setStrategyOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Strategia del progetto</DialogTitle>
      <DialogDescription>
        Definisci obiettivi e posizionamento per guidare i suggerimenti AI.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Visione strategica</label>
        <Textarea value={strategicVision} onChange={...} rows={3}
          placeholder="Es: Diventare il punto di riferimento B2B per..." />
      </div>
      <div>
        <label className="text-sm font-medium">Value proposition</label>
        <Textarea value={valueProposition} onChange={...} rows={3}
          placeholder="Es: Offriamo una soluzione unica che..." />
      </div>
    </div>
    <DialogFooter>
      <Button onClick={handleSaveStrategy}>Salva</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Save/load uses same API as today: PATCH/GET to `/api/projects/{projectId}/settings` or `/api/organization/settings`.

**Step 3: Commit**

```bash
git add src/app/dashboard/insights/page.tsx
git commit -m "feat: add strategy banner with configuration dialog"
```

---

### Task 9: Build unified AI Tips page — tip rows UI

**Files:**
- Modify: `src/app/dashboard/insights/page.tsx`

**Step 1: Build TipRow component**

Minimal, Linear-inspired row component. Inline in page or extracted to `src/app/dashboard/insights/TipRow.tsx`:

```tsx
function TipRow({ tip, onAction }: { tip: ProjectTipSnapshot; onAction: (action: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { status, label, dotClass, hasError } = getVisibleStatus(tip);
  const category = getTipOriginCategory(tip);

  return (
    <div className="group">
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Priority dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          tip.priority === 'critical' || tip.priority === 'high' ? 'bg-red-500' :
          tip.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-400'
        }`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{tip.title}</p>
          <p className="text-xs text-slate-500 truncate">{tip.summary}</p>
        </div>

        {/* Status badge */}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          status === 'nuovo' ? 'bg-blue-50 text-blue-700' :
          status === 'in_lavorazione' ? 'bg-amber-50 text-amber-700' :
          status === 'completato' ? 'bg-emerald-50 text-emerald-700' :
          'bg-slate-100 text-slate-500'
        }`}>
          {hasError && <span className="text-red-500 mr-1">!</span>}
          {label}
        </span>

        {/* Primary CTA */}
        <Button variant="ghost" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onAction('primary'); }}>
          {(tip.routeCount ?? 0) > 0 ? 'Applica' : 'Copilot'}
        </Button>

        {/* Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction('star')}>
              {tip.starred ? 'Rimuovi stella' : 'Stella'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('edit')}>Modifica</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('complete')}>Segna completato</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('archive')}>Archivia</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Expand chevron */}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 pl-9 space-y-2 border-b border-slate-50">
          {tip.reasoning && (
            <p className="text-xs text-slate-600">{tip.reasoning}</p>
          )}
          {tip.strategicAlignment && (
            <p className="text-xs text-slate-500">
              <span className="font-medium">Allineamento:</span> {tip.strategicAlignment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Build grouped list render**

```tsx
// Group tips by origin category
const grouped = useMemo(() => {
  const filtered = tips
    .filter(tip => statusFilter === 'all' || getVisibleStatus(tip).status === statusFilter)
    .filter(tip => categoryFilter === 'all' || getTipOriginCategory(tip) === categoryFilter)
    .filter(tip => !starredOnly || tip.starred);

  const groups: Record<TipOriginCategory, ProjectTipSnapshot[]> = {
    sito: [], ascolto: [], copilot: [], manuale: []
  };

  filtered.forEach(tip => {
    const cat = getTipOriginCategory(tip);
    groups[cat].push(tip);
  });

  return groups;
}, [tips, statusFilter, categoryFilter, starredOnly]);
```

Render:

```tsx
{(['sito', 'ascolto', 'copilot', 'manuale'] as TipOriginCategory[]).map(cat => {
  const catTips = grouped[cat];
  if (!catTips.length) return null;
  return (
    <div key={cat}>
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {ORIGIN_CATEGORY_LABELS[cat]}
        </span>
        <span className="text-[10px] text-slate-400">{catTips.length}</span>
      </div>
      <div className="divide-y divide-slate-50">
        {catTips.map(tip => <TipRow key={tip.id} tip={tip} onAction={...} />)}
      </div>
    </div>
  );
})}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/insights/page.tsx
git commit -m "feat: build minimal row-based tip list grouped by origin"
```

---

### Task 10: Build filter bar

**Files:**
- Modify: `src/app/dashboard/insights/page.tsx`

**Step 1: Add filter bar above tips list**

```tsx
<div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
  {/* Status pills */}
  <div className="flex gap-1">
    {[
      { value: 'all', label: 'Tutti' },
      { value: 'nuovo', label: 'Nuovi' },
      { value: 'in_lavorazione', label: 'In lavorazione' },
      { value: 'completato', label: 'Completati' },
    ].map(f => (
      <button key={f.value}
        onClick={() => setStatusFilter(f.value as any)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          statusFilter === f.value
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100'
        }`}>
        {f.label}
      </button>
    ))}
  </div>

  <div className="flex-1" />

  {/* Category dropdown */}
  <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
    <SelectTrigger className="w-[140px] h-8 text-xs">
      <SelectValue placeholder="Categoria" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Tutte</SelectItem>
      <SelectItem value="sito">SEO & LLM</SelectItem>
      <SelectItem value="ascolto">Ascolto</SelectItem>
      <SelectItem value="copilot">Copilot</SelectItem>
      <SelectItem value="manuale">Manuale</SelectItem>
    </SelectContent>
  </Select>

  {/* Starred toggle */}
  <button
    onClick={() => setStarredOnly(!starredOnly)}
    className={`p-1.5 rounded-lg transition-colors ${
      starredOnly ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:text-slate-600'
    }`}>
    <Star className="w-4 h-4" fill={starredOnly ? 'currentColor' : 'none'} />
  </button>

  {/* New tip button */}
  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
    <Plus className="w-3.5 h-3.5" /> Nuovo
  </Button>
</div>
```

**Step 2: Commit**

```bash
git add src/app/dashboard/insights/page.tsx
git commit -m "feat: add minimal filter bar for tips (status, category, starred)"
```

---

### Task 11: Wire tip actions (CTA, archive, complete, star, edit)

**Files:**
- Modify: `src/app/dashboard/insights/page.tsx`

**Step 1: Implement action handler**

```typescript
const handleTipAction = async (tipId: string, action: string) => {
  if (!projectId) return;

  switch (action) {
    case 'primary': {
      const tip = tips.find(t => t.id === tipId);
      if (!tip) return;
      if ((tip.routeCount ?? 0) > 0) {
        // Has routing — apply (existing flow)
        await handleApplyAction(tipId, tip.title);
      } else {
        // No routing — open copilot with tip context
        openCopilotWithTip(tip);
      }
      break;
    }
    case 'star':
      await patchTip(tipId, { starred: !tips.find(t => t.id === tipId)?.starred });
      break;
    case 'complete':
      await patchTip(tipId, { status: 'COMPLETED' });
      break;
    case 'archive':
      await patchTip(tipId, { status: 'ARCHIVED' });
      break;
    case 'edit':
      setEditingTipId(tipId);
      break;
  }
};

const patchTip = async (tipId: string, data: Record<string, unknown>) => {
  const res = await fetch(`/api/projects/${projectId}/tips/${tipId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.ok) {
    setTips(prev => prev.map(t => t.id === tipId ? { ...t, ...data } : t));
  }
};
```

**Step 2: Implement `openCopilotWithTip`**

This should dispatch an event or call a function that opens the StrategyCopilot component (already in layout.tsx) with preloaded tip context:

```typescript
const openCopilotWithTip = (tip: ProjectTipSnapshot) => {
  // Dispatch custom event that StrategyCopilot listens to
  window.dispatchEvent(new CustomEvent('open-copilot', {
    detail: {
      prefilledMessage: `Approfondisci questo tip e suggerisci come implementarlo:\n\nTitolo: ${tip.title}\n${tip.summary || ''}\n${tip.reasoning || ''}`,
    }
  }));
};
```

**Step 3: Commit**

```bash
git add src/app/dashboard/insights/page.tsx
git commit -m "feat: wire tip actions including copilot fallback CTA"
```

---

### Task 12: Remove VirtualInsight layer

**Files:**
- Delete: `src/lib/insights/site-analysis-insights.ts`
- Modify: API route that calls `loadSiteAnalysisInsights` (find and remove usage)
- Modify: `src/app/dashboard/insights/page.tsx` (remove isVirtual logic — should be done by Task 7)

**Step 1: Find usages of loadSiteAnalysisInsights**

Search for imports and calls, remove them from the API route that serves insights.

**Step 2: Delete the file**

```bash
rm src/lib/insights/site-analysis-insights.ts
```

**Step 3: Remove `isVirtual` references from insights page**

This should already be handled by Task 7's rewrite. Verify no remaining references.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove VirtualInsight layer (site-analysis-insights.ts)"
```

---

### Task 13: Remove AITipsSection from visibility context

**Files:**
- Modify: `src/app/dashboard/visibility/site-analysis/SiteAnalysisClient.tsx` (remove AITipsSection usage if present)
- Review: `src/components/visibility/AITipsSection.tsx` — keep file but it's no longer used from site-analysis

**Step 1: Check if SiteAnalysisClient imports/uses AITipsSection**

If it does, remove the import and rendering. The tips from site analysis are now in the AI Tips page.

Note: `AITipsSection.tsx` may still be used elsewhere. If it's only used in SiteAnalysisClient, delete it. Otherwise, leave it.

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor: remove AITipsSection from site analysis page"
```

---

### Task 14: Update FeatureMatrix and billing for siteAnalysis flag

**Files:**
- Modify: `src/components/pricing/FeatureMatrix.tsx` (add Analisi Sito row)
- Modify: `src/app/dashboard/billing/page.tsx` (if it references visibility features)

**Step 1: Add Analisi Sito to feature matrix**

Find where visibility tracker is listed and add a similar row for site analysis.

**Step 2: Commit**

```bash
git add src/components/pricing/FeatureMatrix.tsx src/app/dashboard/billing/page.tsx
git commit -m "feat: add Analisi Sito to feature matrix and billing display"
```

---

### Task 15: End-to-end verification

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Fix any type errors introduced by the changes.

**Step 2: Run tests**

```bash
npm test 2>&1 | tail -30
```

**Step 3: Verify build**

```bash
npm run build 2>&1 | tail -30
```

**Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve type errors and build issues from AI Tips unification"
```

---

## Execution Order & Dependencies

```
Task 1 (plans config) ──┐
                         ├── Task 2 (sidebar wiring) ── Task 3 (site-analysis route)
                         │
Task 4 (getVisibleStatus) ── Task 5 (origin categories) ──┐
                                                           │
Task 6 (verify materialization) ───────────────────────────┤
                                                           │
                                    Task 7 (page data layer) ──┐
                                                               ├── Task 8 (strategy banner)
                                                               ├── Task 9 (tip rows)
                                                               ├── Task 10 (filter bar)
                                                               └── Task 11 (actions)
                                                                      │
Task 12 (remove VirtualInsight) ───────────────────────────────────────┤
Task 13 (remove AITipsSection) ────────────────────────────────────────┤
Task 14 (feature matrix) ─────────────────────────────────────────────┤
                                                                      │
                                                              Task 15 (verify)
```

**Parallelizable groups:**
- Wave 1: Tasks 1, 4, 5, 6 (independent foundations)
- Wave 2: Tasks 2, 3 (depend on Task 1)
- Wave 3: Tasks 7-11 (depend on 4, 5; sequential within)
- Wave 4: Tasks 12, 13, 14 (cleanup, independent)
- Wave 5: Task 15 (final verification)
