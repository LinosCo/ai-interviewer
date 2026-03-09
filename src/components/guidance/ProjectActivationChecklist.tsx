'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectActivationSnapshot } from '@/lib/guidance/guidance-rules';

interface ProjectActivationChecklistProps {
  projectId: string;
}

interface ChecklistStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

export function ProjectActivationChecklist({ projectId }: ProjectActivationChecklistProps) {
  const [snapshot, setSnapshot] = useState<ProjectActivationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/activation-status`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) {
          setError('Stato attivazione non disponibile');
          setSnapshot(null);
          return;
        }

        const payload = (await res.json()) as ProjectActivationSnapshot;
        setSnapshot(payload);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to fetch activation checklist:', err);
        setError('Stato attivazione non disponibile');
        setSnapshot(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [projectId]);

  const steps = useMemo<ChecklistStep[]>(() => {
    const hasTools = Boolean(snapshot?.checklist.hasTools);
    const hasIntegration = Boolean(snapshot?.checklist.hasIntegration);
    const hasTips = Boolean(snapshot?.checklist.hasTips);
    const hasRouting = Boolean(snapshot?.checklist.hasRoutingRule);

    return [
      {
        id: 'tools',
        label: 'Attiva il primo tool',
        done: hasTools,
        href: `/dashboard/interviews/create?projectId=${projectId}`,
        cta: 'Crea intervista',
      },
      {
        id: 'integration',
        label: 'Collega una integrazione',
        done: hasIntegration,
        href: `/dashboard/projects/${projectId}/integrations`,
        cta: 'Apri integrazioni',
      },
      {
        id: 'tips',
        label: 'Valida il primo tip canonico',
        done: hasTips,
        href: `/dashboard/insights?projectId=${projectId}`,
        cta: 'Vai ai tips',
      },
      {
        id: 'routing',
        label: 'Configura una regola di routing',
        done: hasRouting,
        href: `/dashboard/projects/${projectId}/integrations?tab=routing`,
        cta: 'Apri routing',
      },
    ];
  }, [projectId, snapshot]);

  const completed = steps.filter((step) => step.done).length;
  const percentage = Math.round((completed / Math.max(steps.length, 1)) * 100);

  return (
    <Card className="border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-amber-700">
          Attivazione progetto
        </CardTitle>
        <p className="text-xs text-slate-600">
          Avanza nel loop operativo completando i passaggi essenziali.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>{completed} / {steps.length} completati</span>
            <span>{percentage}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            Caricamento checklist...
          </div>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : (
          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`rounded-xl border px-3 py-2 ${step.done ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {step.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 text-slate-400" />
                    )}
                    <p className={`text-xs font-semibold ${step.done ? 'text-emerald-800' : 'text-slate-700'}`}>
                      {step.label}
                    </p>
                  </div>

                  {!step.done ? (
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 transition-colors hover:text-amber-800"
                    >
                      {step.cta}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {snapshot?.checklist.isActivated ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            Progetto attivo: puoi passare alla prioritizzazione strategica in Insights.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
