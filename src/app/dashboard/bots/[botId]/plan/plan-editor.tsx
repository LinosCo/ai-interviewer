'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  CoverageTier,
  ImportanceBand,
  InterviewPlan,
  InterviewPlanOverrides,
  PlanCoverageExclusion,
  PlanSubGoal,
  PlanTopic,
} from '@/lib/interview/plan-types';

type PlanResponse = {
  plan: InterviewPlan;
  basePlan: InterviewPlan;
  overrides: InterviewPlanOverrides | null;
  version: number;
};

const IMPORTANCE_OPTIONS: ImportanceBand[] = ['critical', 'high', 'medium', 'low'];
const COVERAGE_OPTIONS: CoverageTier[] = ['target', 'stretch', 'overflow', 'disabled'];

function percent(value?: number) {
  return Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
}

function formatMinutes(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function bandClass(band?: string | null) {
  switch (band) {
    case 'critical':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'high':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'medium':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function tierClass(tier?: string | null) {
  switch (tier) {
    case 'target':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'stretch':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'overflow':
      return 'bg-gray-50 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-50 text-gray-400 border-gray-200';
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function StrategicCoverageCards({ plan }: { plan: InterviewPlan }) {
  const targetRate = percent(plan.coverage.target.coverageRate);
  const stretchRate = percent(plan.coverage.stretch.coverageRate);
  const fullRate = percent(plan.coverage.full.coverageRate);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Durata target</div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">{formatMinutes(plan.coverage.targetDurationSec)}</div>
        <div className="mt-1 text-xs text-gray-500">{targetRate}% di coverage stimata</div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Durata stretch</div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">{formatMinutes(plan.coverage.stretchDurationSec)}</div>
        <div className="mt-1 text-xs text-gray-500">{stretchRate}% con extra tempo</div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Copertura totale</div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">{formatMinutes(plan.coverage.fullCoverageDurationSec)}</div>
        <div className="mt-1 text-xs text-gray-500">{fullRate}% con tempo pieno</div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Senza deep offer</div>
        <div className="mt-1 text-2xl font-semibold text-gray-900">
          {plan.coverage.likelyExcludedWithoutDeepOffer.length}
        </div>
        <div className="mt-1 text-xs text-gray-500">subgoal probabilmente esclusi</div>
      </div>
    </div>
  );
}

function CoverageBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-semibold text-gray-900">{percent(value)}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${percent(value)}%` }} />
      </div>
    </div>
  );
}

function ExclusionList({ items }: { items: PlanCoverageExclusion[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        Con il tempo attuale non risultano esclusioni rilevanti nel piano.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Probabili esclusioni senza deep offer</h3>
          <p className="text-xs text-gray-500">
            Il grading non cambia l&apos;ordine editoriale, ma segnala cosa difficilmente rientra nel tempo target.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={`${item.topicId}:${item.subGoalId}`}
            className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="text-sm font-medium text-gray-900">{item.topicLabel}</div>
              <div className="text-xs text-gray-500">{item.subGoalLabel}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${bandClass(item.importanceBand)}`}>
                {item.importanceBand}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tierClass(item.coverageTier)}`}>
                {item.coverageTier}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicCard({
  topic,
  topicOverrides,
  onTopicField,
  onSubGoalField,
}: {
  topic: PlanTopic;
  topicOverrides: any;
  onTopicField: (topicId: string, field: string, value: unknown) => void;
  onSubGoalField: (topicId: string, subGoalId: string, field: string, value: unknown) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {topic.editorialOrderIndex + 1}. {topic.label}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${bandClass(topic.importanceBand)}`}>
              {topic.importanceBand}
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
              {Math.round(topic.importanceScore * 100)}/100
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Rationale: <span className="font-medium text-gray-700">{topic.rationale}</span>. Ordine editoriale fisso in `EXPLORE`.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
          <input
            type="checkbox"
            checked={topicOverrides?.enabled ?? topic.enabled}
            onChange={(event) => onTopicField(topic.topicId, 'enabled', event.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Topic attivo
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-xs text-gray-600">
          <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Importance score</div>
          <input
            type="number"
            min={0}
            max={100}
            value={topicOverrides?.importanceScore != null ? Math.round(topicOverrides.importanceScore * 100) : Math.round(topic.importanceScore * 100)}
            onChange={(event) => onTopicField(topic.topicId, 'importanceScore', Number(event.target.value) / 100)}
            className="w-full rounded-lg border p-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Importance band</div>
          <select
            value={topicOverrides?.importanceBand ?? topic.importanceBand}
            onChange={(event) => onTopicField(topic.topicId, 'importanceBand', event.target.value)}
            className="w-full rounded-lg border p-2 text-sm"
          >
            {IMPORTANCE_OPTIONS.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Target turns</div>
          <input
            type="number"
            min={0}
            value={topicOverrides?.targetTurns ?? topic.targetTurns}
            onChange={(event) => onTopicField(topic.topicId, 'targetTurns', Number(event.target.value))}
            className="w-full rounded-lg border p-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Stretch turns</div>
          <input
            type="number"
            min={0}
            value={topicOverrides?.stretchTurns ?? topic.stretchTurns}
            onChange={(event) => onTopicField(topic.topicId, 'stretchTurns', Number(event.target.value))}
            className="w-full rounded-lg border p-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Target subgoal</div>
          <input
            type="number"
            min={0}
            max={topic.fullCoverageSubGoalCount}
            value={topicOverrides?.targetSubGoalCount ?? topic.targetSubGoalCount}
            onChange={(event) => onTopicField(topic.topicId, 'targetSubGoalCount', Number(event.target.value))}
            className="w-full rounded-lg border p-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Stretch subgoal</div>
          <input
            type="number"
            min={0}
            max={topic.fullCoverageSubGoalCount}
            value={topicOverrides?.stretchSubGoalCount ?? topic.stretchSubGoalCount}
            onChange={(event) => onTopicField(topic.topicId, 'stretchSubGoalCount', Number(event.target.value))}
            className="w-full rounded-lg border p-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Target coverage</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">{topic.targetSubGoalCount}</div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Stretch coverage</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">{topic.stretchSubGoalCount}</div>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">Copertura totale</div>
          <div className="mt-1 text-lg font-semibold text-gray-900">{topic.fullCoverageSubGoalCount}</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {topic.subGoalPlans.map((subGoal: PlanSubGoal) => {
          const subGoalOverrides = topicOverrides?.subGoals?.[subGoal.id];
          return (
            <div key={subGoal.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {subGoal.editorialOrderIndex + 1}. {subGoal.label}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tierClass(subGoal.coverageTier)}`}>
                      {subGoal.coverageTier}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${bandClass(subGoal.importanceBand)}`}>
                      {subGoal.importanceBand}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    score {Math.round(subGoal.importanceScore * 100)}/100 • rationale {subGoal.rationale}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={subGoalOverrides?.enabled ?? subGoal.enabled}
                    onChange={(event) => onSubGoalField(topic.topicId, subGoal.id, 'enabled', event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Attivo
                </label>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <label className="text-xs text-gray-600">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Coverage tier</div>
                  <select
                    value={subGoalOverrides?.coverageTier ?? subGoal.coverageTier}
                    onChange={(event) => onSubGoalField(topic.topicId, subGoal.id, 'coverageTier', event.target.value)}
                    className="w-full rounded-lg border p-2 text-sm"
                  >
                    {COVERAGE_OPTIONS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Importance band</div>
                  <select
                    value={subGoalOverrides?.importanceBand ?? subGoal.importanceBand}
                    onChange={(event) => onSubGoalField(topic.topicId, subGoal.id, 'importanceBand', event.target.value)}
                    className="w-full rounded-lg border p-2 text-sm"
                  >
                    {IMPORTANCE_OPTIONS.map((band) => (
                      <option key={band} value={band}>
                        {band}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Importance score</div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={subGoalOverrides?.importanceScore != null ? Math.round(subGoalOverrides.importanceScore * 100) : Math.round(subGoal.importanceScore * 100)}
                    onChange={(event) => onSubGoalField(topic.topicId, subGoal.id, 'importanceScore', Number(event.target.value) / 100)}
                    className="w-full rounded-lg border p-2 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Rationale</div>
                  <input
                    type="text"
                    value={subGoalOverrides?.rationale ?? subGoal.rationale}
                    onChange={(event) => onSubGoalField(topic.topicId, subGoal.id, 'rationale', event.target.value)}
                    className="w-full rounded-lg border p-2 text-sm"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function InterviewPlanEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<PlanResponse | null>(null);
  const [overrides, setOverrides] = useState<InterviewPlanOverrides>({});
  const [draftDurationMins, setDraftDurationMins] = useState<number>(10);
  const [previewPlan, setPreviewPlan] = useState<InterviewPlan | null>(null);

  const overridesKey = useMemo(() => JSON.stringify(overrides || {}), [overrides]);

  const loadPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${botId}/plan`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Impossibile caricare il piano');
      const data: PlanResponse = await res.json();
      setPlanData(data);
      setOverrides(data.overrides || {});
      setDraftDurationMins(data.plan.meta.maxDurationMins);
      setPreviewPlan(null);
    } catch (err: any) {
      setError(err?.message || 'Errore imprevisto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, [botId]);

  useEffect(() => {
    if (!planData) return;
    const hasDurationChange = draftDurationMins !== planData.plan.meta.maxDurationMins;
    const hasOverrideChange = overridesKey !== JSON.stringify(planData.overrides || {});

    if (!hasDurationChange && !hasOverrideChange) {
      setPreviewPlan(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await fetch(`/api/bots/${botId}/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'preview',
            overrides,
            maxDurationMins: draftDurationMins,
          }),
        });
        if (!res.ok) throw new Error('Impossibile generare l’anteprima');
        const data = await res.json();
        setPreviewPlan(data.plan);
      } catch (err: any) {
        setError(err?.message || 'Errore anteprima');
      } finally {
        setPreviewing(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [botId, draftDurationMins, overrides, overridesKey, planData]);

  const effectivePlan = previewPlan || planData?.plan || null;
  const previewActive = Boolean(previewPlan);
  const orderedTopics = useMemo(
    () => [...(effectivePlan?.explore?.topics || [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [effectivePlan]
  );

  const updateTopicField = (topicId: string, field: string, value: unknown) => {
    setOverrides((prev) => {
      const next = deepClone(prev || {});
      const explore = (next.explore ||= {});
      const topics = (explore.topics ||= {});
      const topicOverrides = (topics[topicId] ||= {});
      (topicOverrides as any)[field] = value;
      return next;
    });
  };

  const updateSubGoalField = (topicId: string, subGoalId: string, field: string, value: unknown) => {
    setOverrides((prev) => {
      const next = deepClone(prev || {});
      const explore = (next.explore ||= {});
      const topics = (explore.topics ||= {});
      const topicOverrides = (topics[topicId] ||= {});
      const subGoals = ((topicOverrides as any).subGoals ||= {});
      const subGoalOverrides = (subGoals[subGoalId] ||= {});
      subGoalOverrides[field] = value;
      return next;
    });
  };

  const updateDeepenField = (field: 'maxTurnsPerTopic' | 'fallbackTurns', value: number) => {
    setOverrides((prev) => ({
      ...deepClone(prev || {}),
      deepen: {
        ...(prev.deepen || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${botId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrides,
          maxDurationMins: draftDurationMins,
        }),
      });
      if (!res.ok) throw new Error('Impossibile salvare il piano');
      const data: PlanResponse = await res.json();
      setPlanData(data);
      setOverrides(data.overrides || {});
      setDraftDurationMins(data.plan.meta.maxDurationMins);
      setPreviewPlan(null);
    } catch (err: any) {
      setError(err?.message || 'Errore imprevisto');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!planData) return;
    setOverrides({});
    setDraftDurationMins(planData.basePlan.meta.maxDurationMins);
    setPreviewPlan(null);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${botId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'regenerate' }),
      });
      if (!res.ok) throw new Error('Impossibile rigenerare il piano');
      const data: PlanResponse = await res.json();
      setPlanData(data);
      setOverrides(data.overrides || {});
      setDraftDurationMins(data.plan.meta.maxDurationMins);
      setPreviewPlan(null);
    } catch (err: any) {
      setError(err?.message || 'Errore rigenerazione');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl bg-white p-6 shadow">Caricamento Plan Studio...</div>;
  }

  if (error && !planData) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-6 shadow">
        <div className="font-semibold text-red-600">Errore</div>
        <div className="text-sm text-gray-600">{error}</div>
        <button onClick={loadPlan} className="rounded-lg bg-blue-600 px-4 py-2 text-white">
          Riprova
        </button>
      </div>
    );
  }

  if (!planData || !effectivePlan) {
    return <div className="rounded-xl bg-white p-6 shadow">Nessun piano disponibile.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">Plan Studio</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${bandClass(effectivePlan.meta.interviewerQuality === 'avanzato' ? 'high' : 'medium')}`}>
                {effectivePlan.meta.interviewerQuality}
              </span>
              {previewActive && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                  preview live
                </span>
              )}
            </div>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Il grading non cambia l&apos;ordine dei topic in `EXPLORE`: rende evidente cosa è core, cosa rientra nello stretch e cosa rischia di essere escluso se l&apos;extra tempo non viene accettato.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Versione {planData.version} • generato il {new Date(planData.plan.meta.generatedAt).toLocaleString()} • source {planData.plan.meta.gradingSource}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              disabled={saving || regenerating}
            >
              Reset override
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
              disabled={saving || regenerating}
            >
              {regenerating ? 'Rigenerazione...' : 'Rigenera grading'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              disabled={saving || regenerating}
            >
              {saving ? 'Salvataggio...' : 'Salva piano'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Copertura prevista</div>
                <p className="text-xs text-gray-500">
                  Il piano mostra copertura target, stretch e full senza introdurre nuove chiamate sul path di chat.
                </p>
              </div>
              {previewing && <span className="text-xs font-medium text-blue-600">Aggiornamento preview...</span>}
            </div>
            <div className="space-y-3">
              <CoverageBar label="Target" value={effectivePlan.coverage.target.coverageRate} colorClass="bg-green-500" />
              <CoverageBar label="Stretch" value={effectivePlan.coverage.stretch.coverageRate} colorClass="bg-blue-500" />
              <CoverageBar label="Copertura totale" value={effectivePlan.coverage.full.coverageRate} colorClass="bg-amber-500" />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">Durata target</label>
            <input
              type="number"
              min={1}
              max={240}
              value={draftDurationMins}
              onChange={(event) => setDraftDurationMins(Math.max(1, Number(event.target.value || 1)))}
              className="mt-2 w-full rounded-lg border p-2 text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              Modifica la durata per vedere come cambiano coverage, stretch e probabili esclusioni.
            </p>
          </div>
        </div>
      </div>

      <StrategicCoverageCards plan={effectivePlan} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Strategia runtime per tier</h3>
                <p className="text-xs text-gray-500">
                  Il piano guida coverage e deepen, ma non riordina i topic in `EXPLORE`.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">
                  standard = comparabile
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                  avanzato = narrativo
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                <div className="mb-1 font-semibold text-gray-900">Standard</div>
                Resta sul topic finché il target previsto non è plausibilmente coperto. Lo stretch si attiva solo su high value, con comportamento più disciplinato e confrontabile.
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                <div className="mb-1 font-semibold text-gray-900">Avanzato</div>
                Può seguire un thread forte emerso dall&apos;ultimo messaggio, ma usa il grading per tornare sui gap più strategici rimasti scoperti.
              </div>
            </div>
          </div>

          {orderedTopics.map((topic) => (
            <TopicCard
              key={topic.topicId}
              topic={topic}
              topicOverrides={overrides.explore?.topics?.[topic.topicId]}
              onTopicField={updateTopicField}
              onSubGoalField={updateSubGoalField}
            />
          ))}

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">Regole di deepen</h3>
            <p className="mt-1 text-xs text-gray-500">
              `DEEPEN` rientra sui topic più importanti e scoperti. Qui controlli il budget globale residuo oltre al target.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs text-gray-600">
                <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Max turns per topic</div>
                <input
                  type="number"
                  min={1}
                  value={overrides.deepen?.maxTurnsPerTopic ?? effectivePlan.deepen.maxTurnsPerTopic}
                  onChange={(event) => updateDeepenField('maxTurnsPerTopic', Number(event.target.value))}
                  className="w-full rounded-lg border p-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600">
                <div className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Fallback turns</div>
                <input
                  type="number"
                  min={1}
                  value={overrides.deepen?.fallbackTurns ?? effectivePlan.deepen.fallbackTurns}
                  onChange={(event) => updateDeepenField('fallbackTurns', Number(event.target.value))}
                  className="w-full rounded-lg border p-2 text-sm"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <ExclusionList items={effectivePlan.coverage.likelyExcludedWithoutDeepOffer} />

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Coverage dettaglio</h3>
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="font-medium text-gray-900">Target</div>
                <div className="mt-1 text-xs text-gray-500">
                  {effectivePlan.coverage.target.coveredTopics}/{effectivePlan.coverage.target.totalTopics} topic •{' '}
                  {effectivePlan.coverage.target.coveredSubGoals}/{effectivePlan.coverage.target.totalSubGoals} subgoal
                </div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="font-medium text-gray-900">Stretch</div>
                <div className="mt-1 text-xs text-gray-500">
                  {effectivePlan.coverage.stretch.coveredTopics}/{effectivePlan.coverage.stretch.totalTopics} topic •{' '}
                  {effectivePlan.coverage.stretch.coveredSubGoals}/{effectivePlan.coverage.stretch.totalSubGoals} subgoal
                </div>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="font-medium text-gray-900">Full</div>
                <div className="mt-1 text-xs text-gray-500">
                  {effectivePlan.coverage.full.coveredTopics}/{effectivePlan.coverage.full.totalTopics} topic •{' '}
                  {effectivePlan.coverage.full.coveredSubGoals}/{effectivePlan.coverage.full.totalSubGoals} subgoal
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
