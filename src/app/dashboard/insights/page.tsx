'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Globe,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Plus,
  Save,
  Sparkles,
  Star,
  Target,
  RefreshCw,
} from 'lucide-react';
import { showToast } from '@/components/toast';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { ProjectTipSnapshot } from '@/lib/projects/project-intelligence-types';
import { ProjectWorkspaceShell } from '@/components/projects/ProjectWorkspaceShell';
import {
  getVisibleStatus,
  getTipOriginCategory,
  ORIGIN_CATEGORY_LABELS,
  type VisibleTipStatus,
  type TipOriginCategory,
} from '@/components/projects/project-tip-ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_PILLS: { value: VisibleTipStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'nuovo', label: 'Nuovi' },
  { value: 'in_lavorazione', label: 'In lavorazione' },
  { value: 'completato', label: 'Completati' },
  { value: 'archiviato', label: 'Archiviati' },
];

const CATEGORY_OPTIONS: { value: TipOriginCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Tutte le categorie' },
  { value: 'sito', label: ORIGIN_CATEGORY_LABELS.sito },
  { value: 'ascolto', label: ORIGIN_CATEGORY_LABELS.ascolto },
  { value: 'copilot', label: ORIGIN_CATEGORY_LABELS.copilot },
  { value: 'manuale', label: ORIGIN_CATEGORY_LABELS.manuale },
];

const CATEGORY_ICON: Record<TipOriginCategory, typeof Globe> = {
  sito: Globe,
  ascolto: MessageCircle,
  copilot: Sparkles,
  manuale: PenLine,
};

const CATEGORY_ORDER: TipOriginCategory[] = ['sito', 'ascolto', 'copilot', 'manuale'];

function priorityDotClass(priority: number | null): string {
  if (priority != null && priority >= 8) return 'bg-red-500';
  if (priority != null && priority >= 5) return 'bg-amber-500';
  return 'bg-blue-400';
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InsightHubPage() {
  const searchParams = useSearchParams();
  const { selectedProject, setSelectedProject, projects, isAllProjectsSelected } = useProject();
  const { currentOrganization } = useOrganization();

  /* ---- State ---- */
  const [tips, setTips] = useState<ProjectTipSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<VisibleTipStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TipOriginCategory | 'all'>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [strategicVision, setStrategicVision] = useState('');
  const [valueProposition, setValueProposition] = useState('');
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [isSavingStrategy, setIsSavingStrategy] = useState(false);
  const [expandedTipId, setExpandedTipId] = useState<string | null>(null);
  const [patchingTipId, setPatchingTipId] = useState<string | null>(null);

  /* ---- Derived IDs ---- */
  const projectId = selectedProject && !isAllProjectsSelected ? selectedProject.id : null;
  const organizationId = currentOrganization?.id || null;

  /* ---- Project selector sync ---- */
  const cockpitProjectId = searchParams.get('projectId');
  useEffect(() => {
    if (!cockpitProjectId || !projects.length) return;
    const match = projects.find((p) => p.id === cockpitProjectId);
    if (match && selectedProject?.id !== match.id) {
      setSelectedProject(match);
    }
  }, [cockpitProjectId, projects, selectedProject, setSelectedProject]);

  /* ---- Fetch tips ---- */
  const fetchTips = useCallback(async () => {
    if (!projectId) {
      setTips([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/tips`);
      if (!res.ok) {
        setTips([]);
        return;
      }
      const data = await res.json();
      setTips(Array.isArray(data.tips) ? data.tips : []);
    } catch (err) {
      console.error('Error fetching tips:', err);
      setTips([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  /* ---- Fetch strategy ---- */
  const fetchStrategy = useCallback(async () => {
    try {
      const url = projectId
        ? `/api/projects/${projectId}/settings`
        : '/api/organization/settings';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStrategicVision(data.strategicVision || '');
        setValueProposition(data.valueProposition || '');
      }
    } catch (err) {
      console.error('Fetch strategy error:', err);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    void fetchTips();
    void fetchStrategy();
  }, [fetchTips, fetchStrategy]);

  /* ---- Save strategy ---- */
  const handleSaveStrategy = async () => {
    setIsSavingStrategy(true);
    try {
      const url = projectId
        ? `/api/projects/${projectId}/settings`
        : '/api/organization/settings';
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategicVision, valueProposition }),
      });
      if (res.ok) {
        showToast('Strategia salvata! Verr\u00e0 usata per la prossima analisi.');
        setStrategyOpen(false);
      } else {
        showToast('Errore durante il salvataggio', 'error');
      }
    } catch {
      showToast('Errore di rete', 'error');
    } finally {
      setIsSavingStrategy(false);
    }
  };

  /* ---- Tip PATCH helpers ---- */
  const patchTip = async (tipId: string, body: Record<string, unknown>) => {
    if (!projectId) return;
    setPatchingTipId(tipId);
    try {
      const res = await fetch(`/api/projects/${projectId}/tips/${tipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showToast('Errore durante l\'aggiornamento', 'error');
        return;
      }
      showToast('Tip aggiornato');
      await fetchTips();
    } catch {
      showToast('Errore di rete', 'error');
    } finally {
      setPatchingTipId(null);
    }
  };

  const toggleStar = (tip: ProjectTipSnapshot) => patchTip(tip.id, { starred: !tip.starred });
  const markCompleted = (tip: ProjectTipSnapshot) => patchTip(tip.id, { status: 'COMPLETED' });
  const archiveTip = (tip: ProjectTipSnapshot) => patchTip(tip.id, { status: 'ARCHIVED' });

  /* ---- Open Copilot ---- */
  const openCopilot = (tip: ProjectTipSnapshot) => {
    window.dispatchEvent(
      new CustomEvent('open-copilot', {
        detail: { prefilledMessage: `Aiutami ad applicare questo tip: "${tip.title}"` },
      }),
    );
  };

  /* ---- CSV export ---- */
  const handleExportCsv = () => {
    if (!tips.length) {
      showToast('Nessun dato disponibile da esportare', 'error');
      return;
    }
    const headers = ['id', 'titolo', 'sommario', 'stato', 'priorita', 'categoria', 'origine', 'stellato', 'creato'];
    const escapeCsv = (v: unknown) => {
      const raw = v == null ? '' : String(v);
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const rows = [
      headers.join(','),
      ...tips.map((t) => {
        const vs = getVisibleStatus(t);
        return [
          escapeCsv(t.id),
          escapeCsv(t.title),
          escapeCsv(t.summary),
          escapeCsv(vs.label),
          escapeCsv(t.priority),
          escapeCsv(ORIGIN_CATEGORY_LABELS[getTipOriginCategory(t)]),
          escapeCsv(t.originType),
          escapeCsv(t.starred ? 'Si' : 'No'),
          escapeCsv(t.createdAt),
        ].join(',');
      }),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `tips_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Export CSV completato');
  };

  /* ---- Filtering ---- */
  const filteredTips = useMemo(() => {
    return tips.filter((tip) => {
      if (starredOnly && !tip.starred) return false;
      if (statusFilter !== 'all') {
        const vs = getVisibleStatus(tip);
        if (vs.status !== statusFilter) return false;
      }
      if (categoryFilter !== 'all') {
        if (getTipOriginCategory(tip) !== categoryFilter) return false;
      }
      return true;
    });
  }, [tips, statusFilter, categoryFilter, starredOnly]);

  /* ---- Grouping ---- */
  const grouped = useMemo(() => {
    const map = new Map<TipOriginCategory, ProjectTipSnapshot[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const tip of filteredTips) {
      const cat = getTipOriginCategory(tip);
      map.get(cat)!.push(tip);
    }
    return map;
  }, [filteredTips]);

  /* ---- Strategy state ---- */
  const strategyConfigured = Boolean(strategicVision.trim() || valueProposition.trim());

  /* ---- Render ---- */
  return (
    <div className="min-h-screen bg-slate-50/60">
      <ProjectWorkspaceShell
        projectId={projectId}
        projectName={selectedProject && !isAllProjectsSelected ? selectedProject.name : null}
        activeSection="tips"
        eyebrow="Tips"
        title="AI Tips"
        description="Suggerimenti operativi raggruppati per origine."
        metrics={[
          {
            label: 'Tip totali',
            value: String(tips.length),
            tone: tips.length > 0 ? 'success' : 'default',
          },
          {
            label: 'Nuovi',
            value: String(tips.filter((t) => getVisibleStatus(t).status === 'nuovo').length),
            tone: 'accent',
          },
        ]}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
        }
      >
        {/* ---- Strategy Banner ---- */}
        <div className="px-4 pt-4 pb-2">
          {!strategyConfigured ? (
            <button
              type="button"
              onClick={() => setStrategyOpen(true)}
              className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 text-left transition hover:border-amber-400 hover:bg-amber-50"
            >
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">
                    Configura la strategia del progetto
                  </p>
                  <p className="text-xs text-amber-600/80 mt-0.5">
                    Aiuta l&apos;AI a generare tips pi&ugrave; mirati definendo visione e value proposition.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                  Configura
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStrategyOpen(true)}
              className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-left transition hover:border-emerald-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 shrink-0 text-emerald-500" />
                <p className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                  {strategicVision || valueProposition}
                </p>
                <span className="shrink-0 text-xs font-medium text-slate-400 hover:text-slate-600">
                  Modifica
                </span>
              </div>
            </button>
          )}
        </div>

        {/* ---- Filter Bar ---- */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 flex-wrap">
          {/* Status pills */}
          <div className="flex items-center gap-1">
            {STATUS_PILLS.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setStatusFilter(pill.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  statusFilter === pill.value
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Category select */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as TipOriginCategory | 'all')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-300"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Starred toggle */}
          <button
            type="button"
            onClick={() => setStarredOnly(!starredOnly)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              starredOnly
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${starredOnly ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>

          {/* New tip button */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('open-copilot', {
                  detail: { prefilledMessage: 'Crea un nuovo tip per questo progetto' },
                }),
              );
            }}
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuovo
          </button>
        </div>

        {/* ---- Content ---- */}
        <div className="px-4 py-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !projectId ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">
                Seleziona un progetto per visualizzare i tips.
              </p>
            </div>
          ) : filteredTips.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">
                {tips.length === 0
                  ? 'Nessun tip disponibile. I tips verranno generati automaticamente dall\'analisi.'
                  : 'Nessun tip corrisponde ai filtri selezionati.'}
              </p>
            </div>
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const catTips = grouped.get(cat) ?? [];
              if (catTips.length === 0) return null;
              const CatIcon = CATEGORY_ICON[cat];
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-2">
                    <CatIcon className="h-4 w-4 text-slate-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      {ORIGIN_CATEGORY_LABELS[cat]}
                    </h3>
                    <span className="text-[10px] text-slate-300 font-medium">{catTips.length}</span>
                  </div>

                  {/* Tip rows */}
                  <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                    {catTips.map((tip) => (
                      <TipRow
                        key={tip.id}
                        tip={tip}
                        expanded={expandedTipId === tip.id}
                        onToggle={() => setExpandedTipId(expandedTipId === tip.id ? null : tip.id)}
                        onStar={() => toggleStar(tip)}
                        onComplete={() => markCompleted(tip)}
                        onArchive={() => archiveTip(tip)}
                        onCopilot={() => openCopilot(tip)}
                        patching={patchingTipId === tip.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ProjectWorkspaceShell>

      {/* ---- Strategy Dialog ---- */}
      <Dialog open={strategyOpen} onOpenChange={setStrategyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Strategia del progetto</DialogTitle>
            <DialogDescription>
              Definisci visione strategica e value proposition per migliorare la qualit&agrave; dei tips.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Visione strategica
              </label>
              <textarea
                value={strategicVision}
                onChange={(e) => setStrategicVision(e.target.value)}
                placeholder="Descrivi la direzione strategica del progetto..."
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Value proposition
              </label>
              <textarea
                value={valueProposition}
                onChange={(e) => setValueProposition(e.target.value)}
                placeholder="Qual \u00e8 il valore unico offerto?"
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSaveStrategy}
              disabled={isSavingStrategy}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSavingStrategy ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salva strategia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TipRow                                                             */
/* ------------------------------------------------------------------ */

function TipRow({
  tip,
  expanded,
  onToggle,
  onStar,
  onComplete,
  onArchive,
  onCopilot,
  patching,
}: {
  tip: ProjectTipSnapshot;
  expanded: boolean;
  onToggle: () => void;
  onStar: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onCopilot: () => void;
  patching: boolean;
}) {
  const vs = getVisibleStatus(tip);
  const hasRouting = (tip.routeCount ?? 0) > 0;
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className={`group ${patching ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition hover:bg-slate-50/80"
        onClick={onToggle}
      >
        {/* Priority dot */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${priorityDotClass(tip.priority)}`} />

        {/* Title + summary */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{tip.title}</p>
          {tip.summary ? (
            <p className="text-xs text-slate-500 truncate mt-0.5">{tip.summary}</p>
          ) : null}
        </div>

        {/* Status badge */}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            vs.status === 'nuovo'
              ? 'bg-blue-50 text-blue-700'
              : vs.status === 'in_lavorazione'
                ? 'bg-amber-50 text-amber-700'
                : vs.status === 'completato'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${vs.dotClass}`} />
          {vs.label}
        </span>

        {/* Star indicator */}
        {tip.starred ? (
          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
        ) : null}

        {/* Hover CTA */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasRouting) {
              // Navigate to routing/execution — for now open copilot
              onCopilot();
            } else {
              onCopilot();
            }
          }}
          className="shrink-0 rounded-md bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100 hover:bg-slate-700"
        >
          {hasRouting ? 'Applica' : 'Copilot'}
        </button>

        {/* Dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onStar}>
              <Star className="mr-2 h-3.5 w-3.5" />
              {tip.starred ? 'Rimuovi stella' : 'Aggiungi stella'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onComplete}>
              Segna completato
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive} className="text-red-600">
              Archivia
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Chevron */}
        <ChevronIcon className="h-4 w-4 shrink-0 text-slate-400" />
      </div>

      {/* Expanded detail */}
      {expanded ? (
        <div className="px-4 pb-4 pt-1 border-t border-slate-50 bg-slate-50/50">
          <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-600 leading-relaxed">
            {tip.reasoning ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Ragionamento
                </p>
                <p>{tip.reasoning}</p>
              </div>
            ) : null}
            {tip.strategicAlignment ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Allineamento strategico
                </p>
                <p>{tip.strategicAlignment}</p>
              </div>
            ) : null}
          </div>
          {!tip.reasoning && !tip.strategicAlignment ? (
            <p className="text-xs text-slate-400 italic">Nessun dettaglio aggiuntivo disponibile.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
