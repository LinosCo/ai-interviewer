'use client';

import { ArrowRight, CheckCircle2, Clock3, Route, Sparkles } from 'lucide-react';

import type { ProjectTipDetailSnapshot } from '@/lib/projects/project-intelligence-types';
import { RelatedActionSuggestions } from '@/components/projects/RelatedActionSuggestions';

import { formatExecutionStatus, formatRouteStatus } from './project-tip-ui';

interface ProjectTipDetailPanelProps {
  detail: ProjectTipDetailSnapshot;
  reviewerNotesDraft: string;
  onReviewerNotesChange: (value: string) => void;
  onSaveReviewerNotes: () => void;
  savingReviewerNotes: boolean;
  onUsePrompt: (prompt: string) => void;
}

export function ProjectTipDetailPanel({
  detail,
  reviewerNotesDraft,
  onReviewerNotesChange,
  onSaveReviewerNotes,
  savingReviewerNotes,
  onUsePrompt,
}: ProjectTipDetailPanelProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Perché questo tip esiste</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{detail.explainability?.whyThisTip || detail.reasoning || detail.summary || 'Nessun reasoning registrato.'}</p>
            {detail.explainability?.projectInputsUsed?.length ? (
              <p className="mt-2 text-xs text-slate-500">
                Input usati: {detail.explainability.projectInputsUsed.join(', ')}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">Allineamento strategico</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{detail.strategicAlignment || detail.explainability?.strategyContext || 'Nessun allineamento esplicito.'}</p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-600">Metodo e automazione</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {detail.explainability?.automationRecommendation || detail.methodologySummary || 'Definisci il routing per rendere questo tip operativo.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Evidenze</p>
          <div className="mt-3 space-y-2">
            {detail.evidence.length > 0 ? (
              detail.evidence.map((evidence) => (
                <div key={evidence.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">{evidence.sourceLabel || evidence.sourceType}</p>
                  <p className="mt-1">{evidence.detail}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Nessuna evidenza registrata.</p>
            )}
          </div>
        </div>
      </div>

      <RelatedActionSuggestions
        suggestions={detail.relatedActionSuggestions}
        promptSuggestions={detail.relatedPromptSuggestions}
        onUsePrompt={onUsePrompt}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Routing e destinazioni</p>
          </div>
          <div className="mt-3 space-y-2">
            {detail.routes.length > 0 ? (
              detail.routes.map((route) => (
                <div key={route.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{route.destinationType}</p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {formatRouteStatus(route.status)}
                    </span>
                  </div>
                  <p className="mt-1">{route.destinationRefId || 'Destinazione non referenziata'}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Nessuna route ancora registrata.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-amber-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Timeline esecuzioni</p>
          </div>
          <div className="mt-3 space-y-2">
            {detail.executions.length > 0 ? (
              detail.executions.map((execution) => (
                <div key={execution.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">{formatExecutionStatus(execution.status)}</p>
                    <span>{new Date(execution.startedAt).toLocaleString('it-IT')}</span>
                  </div>
                  {execution.errorMessage ? <p className="mt-1 text-red-600">{execution.errorMessage}</p> : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Nessuna esecuzione tracciata.</p>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Note revisore</p>
          </div>
          {reviewerNotesDraft !== (detail.reviewerNotes || '') ? (
            <button
              type="button"
              onClick={onSaveReviewerNotes}
              disabled={savingReviewerNotes}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 transition-colors hover:text-indigo-800 disabled:opacity-50"
            >
              {savingReviewerNotes ? 'Salvataggio...' : 'Salva note'}
              <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Nessuna modifica in sospeso
            </span>
          )}
        </div>
        <textarea
          className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          placeholder="Aggiungi note interne, controlli o indicazioni prima dell'esecuzione."
          value={reviewerNotesDraft}
          onChange={(event) => onReviewerNotesChange(event.target.value)}
        />
      </section>
    </div>
  );
}
