import Link from 'next/link';
import { AlertTriangle, CheckCircle2, PlugZap } from 'lucide-react';

import { ROUTING_POLICY_LABELS, type TipRoutingDraft } from './project-tip-ui';

interface ProjectTipRoutingEditorProps {
  projectId: string;
  value: TipRoutingDraft;
  onChange: (next: TipRoutingDraft) => void;
  hasRoutingConnection: boolean;
  hasRoutingPremium: boolean;
}

export function ProjectTipRoutingEditor({
  projectId,
  value,
  onChange,
  hasRoutingConnection,
  hasRoutingPremium,
}: ProjectTipRoutingEditorProps) {
  const isBlocked = !hasRoutingPremium || !hasRoutingConnection;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Routing del tip</p>
          <p className="mt-1 text-xs text-slate-600">
            Definisci destinazione, policy e contesto di invio direttamente dal tip canonico.
          </p>
        </div>
        {!isBlocked ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Destinazione pronta
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Blocco operativo
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">Destinazione principale</span>
          <select
            value={value.destinationType}
            onChange={(event) => onChange({ ...value, destinationType: event.target.value })}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">Seleziona destinazione</option>
            <option value="CMS">CMS / sito</option>
            <option value="WORDPRESS">WordPress</option>
            <option value="WOOCOMMERCE">WooCommerce</option>
            <option value="N8N">n8n / workflow</option>
            <option value="LINKEDIN">Canale LinkedIn</option>
            <option value="EMAIL">Email / DEM</option>
            <option value="MANUAL">Solo lavorazione manuale</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">Etichetta destinazione</span>
          <input
            value={value.destinationLabel}
            onChange={(event) => onChange({ ...value, destinationLabel: event.target.value })}
            placeholder="Es. Blog principale, workflow nurturing, CMS pubblico"
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">Policy operativa</span>
          <select
            value={value.policyMode}
            onChange={(event) =>
              onChange({ ...value, policyMode: event.target.value as TipRoutingDraft['policyMode'] })
            }
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
          >
            {Object.entries(ROUTING_POLICY_LABELS).map(([policyMode, label]) => (
              <option key={policyMode} value={policyMode}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold text-slate-700">Intento del canale</span>
          <input
            value={value.channelIntent}
            onChange={(event) => onChange({ ...value, channelIntent: event.target.value })}
            placeholder="Es. rilancio editoriale, nurturing, pubblicazione FAQ"
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
          />
        </label>
      </div>

      <label className="space-y-1">
        <span className="text-xs font-semibold text-slate-700">Note di handoff</span>
        <textarea
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          placeholder="Aggiungi vincoli, priorità o controlli prima della pubblicazione."
          className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
        />
      </label>

      <div className={`rounded-2xl border px-3 py-3 text-xs ${isBlocked ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
        <div className="flex items-start gap-2">
          <PlugZap className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            {!hasRoutingPremium ? (
              <p>
                Il routing avanzato richiede un piano Business o superiore.{' '}
                <Link href="/dashboard/billing/plans" className="font-semibold underline underline-offset-2">
                  Apri piani
                </Link>
              </p>
            ) : !hasRoutingConnection ? (
              <p>
                Nessuna destinazione attiva disponibile per questo progetto.{' '}
                <Link
                  href={`/dashboard/projects/${projectId}/integrations?tab=connections`}
                  className="font-semibold underline underline-offset-2"
                >
                  Apri connections
                </Link>
              </p>
            ) : (
              <p>
                Sintesi routing: {value.destinationLabel || 'destinazione da definire'} · {ROUTING_POLICY_LABELS[value.policyMode]}
                {value.channelIntent ? ` · intento: ${value.channelIntent}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
