'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InterviewPlan, InterviewPlanOverrides } from '@/lib/interview/plan-types';

type PlanResponse = {
  plan: InterviewPlan;
  basePlan: InterviewPlan;
  overrides: InterviewPlanOverrides | null;
  version: number;
};

export default function InterviewPlanEditor({ botId }: { botId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<PlanResponse | null>(null);
  const [overrides, setOverrides] = useState<InterviewPlanOverrides>({});

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${botId}/plan`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Impossibile caricare il piano');
      const data = await res.json();
      setPlanData(data);
      setOverrides(data.overrides || {});
    } catch (err: any) {
      setError(err?.message || 'Errore imprevisto');
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const baseScanTopics = useMemo(() => {
    const topics = planData?.basePlan?.scan?.topics || [];
    return [...topics].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [planData]);

  const mergedScanTopics = useMemo(() => {
    const topics = planData?.plan?.scan?.topics || [];
    return [...topics].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [planData]);

  const baseDeepTopics = useMemo(() => {
    const topics = planData?.basePlan?.deep?.topics || [];
    return [...topics].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [planData]);

  const mergedDeepTopics = useMemo(() => {
    const topics = planData?.plan?.deep?.topics || [];
    return [...topics].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [planData]);

  const handleScanOverride = (topicId: string, value: string) => {
    const parsed = value === '' ? undefined : Number(value);
    setOverrides(prev => {
      const nextScanTopics = { ...(prev.scan?.topics || {}) };
      if (!parsed || Number.isNaN(parsed)) {
        delete nextScanTopics[topicId];
      } else {
        nextScanTopics[topicId] = { ...(nextScanTopics[topicId] || {}), maxTurns: parsed };
      }
      return {
        ...prev,
        scan: { ...(prev.scan || {}), topics: nextScanTopics }
      };
    });
  };

  const handleDeepOverride = (topicId: string, value: string) => {
    const parsed = value === '' ? undefined : Number(value);
    setOverrides(prev => {
      const nextDeepTopics = { ...(prev.deep?.topics || {}) };
      if (!parsed || Number.isNaN(parsed)) {
        delete nextDeepTopics[topicId];
      } else {
        nextDeepTopics[topicId] = { ...(nextDeepTopics[topicId] || {}), maxTurns: parsed };
      }
      return {
        ...prev,
        deep: { ...(prev.deep || {}), topics: nextDeepTopics }
      };
    });
  };

  const handleDeepGlobal = (field: 'maxTurnsPerTopic' | 'fallbackTurns', value: string) => {
    const parsed = value === '' ? undefined : Number(value);
    setOverrides(prev => ({
      ...prev,
      deep: {
        ...(prev.deep || {}),
        [field]: parsed && !Number.isNaN(parsed) ? parsed : undefined,
        topics: { ...(prev.deep?.topics || {}) }
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${botId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides || {})
      });
      if (!res.ok) throw new Error('Impossibile salvare il piano');
      const data = await res.json();
      setPlanData(data);
      setOverrides(data.overrides || {});
    } catch (err: any) {
      setError(err?.message || 'Errore imprevisto');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setOverrides({});
  };

  if (loading) {
    return <div className="bg-white p-6 rounded shadow">Caricamento piano...</div>;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded shadow space-y-3">
        <div className="text-red-600 font-semibold">Errore</div>
        <div className="text-sm text-gray-600">{error}</div>
        <button onClick={loadPlan} className="px-4 py-2 bg-blue-600 text-white rounded">
          Riprova
        </button>
      </div>
    );
  }

  if (!planData) {
    return <div className="bg-white p-6 rounded shadow">Nessun piano disponibile.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded shadow">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Piano Intervista</h2>
            <p className="text-xs text-gray-500">
              Versione {planData.version} • Generato il {new Date(planData.plan.meta.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
              disabled={saving}
            >
              Reset Override
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              disabled={saving}
            >
              {saving ? 'Salvataggio...' : 'Salva Piano'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div className="bg-gray-50 border rounded p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Durata</div>
            <div className="font-semibold text-gray-900">{planData.plan.meta.maxDurationMins} min</div>
          </div>
          <div className="bg-gray-50 border rounded p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Tempo per topic</div>
            <div className="font-semibold text-gray-900">{Math.round(planData.plan.meta.perTopicTimeSec)} sec</div>
          </div>
          <div className="bg-gray-50 border rounded p-3">
            <div className="text-xs uppercase text-gray-500 mb-1">Secondi per turn</div>
            <div className="font-semibold text-gray-900">{planData.plan.meta.secondsPerTurn} sec</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-md font-semibold mb-4">Scan (Panoramica)</h3>
        <div className="space-y-3">
          {baseScanTopics.map((topic, idx) => {
            const merged = mergedScanTopics.find(t => t.topicId === topic.topicId);
            const overrideVal = overrides.scan?.topics?.[topic.topicId]?.maxTurns;
            return (
              <div key={topic.topicId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">
                    {idx + 1}. {topic.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    Base: {topic.maxTurns} turn • Effettivo: {merged?.maxTurns ?? topic.maxTurns}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs uppercase text-gray-500">Override Max</label>
                  <input
                    type="number"
                    min={1}
                    value={overrideVal ?? ''}
                    onChange={e => handleScanOverride(topic.topicId, e.target.value)}
                    className="w-24 p-2 border rounded text-sm"
                    placeholder="Auto"
                  />
                  <span className="text-xs text-gray-400">Lascia vuoto per usare il calcolo automatico.</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h3 className="text-md font-semibold mb-4">Deep (Approfondimento)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs uppercase text-gray-500">Max turn per topic</label>
            <input
              type="number"
              min={1}
              value={overrides.deep?.maxTurnsPerTopic ?? ''}
              onChange={e => handleDeepGlobal('maxTurnsPerTopic', e.target.value)}
              className="w-full p-2 border rounded text-sm mt-2"
              placeholder={`${planData.plan.deep.maxTurnsPerTopic}`}
            />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-500">Fallback topics (se sub-goal esauriti)</label>
            <input
              type="number"
              min={1}
              value={overrides.deep?.fallbackTurns ?? ''}
              onChange={e => handleDeepGlobal('fallbackTurns', e.target.value)}
              className="w-full p-2 border rounded text-sm mt-2"
              placeholder={`${planData.plan.deep.fallbackTurns}`}
            />
          </div>
        </div>

        <div className="space-y-3">
          {baseDeepTopics.map((topic, idx) => {
            const merged = mergedDeepTopics.find(t => t.topicId === topic.topicId);
            const overrideVal = overrides.deep?.topics?.[topic.topicId]?.maxTurns;
            return (
              <div key={topic.topicId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">
                    {idx + 1}. {topic.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    Base: {topic.maxTurns} turn • Effettivo: {merged?.maxTurns ?? topic.maxTurns}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs uppercase text-gray-500">Override Max</label>
                  <input
                    type="number"
                    min={1}
                    value={overrideVal ?? ''}
                    onChange={e => handleDeepOverride(topic.topicId, e.target.value)}
                    className="w-24 p-2 border rounded text-sm"
                    placeholder="Auto"
                  />
                  <span className="text-xs text-gray-400">Lascia vuoto per usare il calcolo automatico.</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
