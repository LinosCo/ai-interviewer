'use client';

import { useState } from 'react';
import { HelpCircle, RotateCcw, X } from 'lucide-react';

import { Switch } from '@/components/ui/switch';

interface GuideToggleProps {
  enabled: boolean;
  hasContextualStep: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onReopen: () => void;
}

export function GuideToggle({
  enabled,
  hasContextualStep,
  onEnabledChange,
  onReopen,
}: GuideToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-end gap-3 sm:left-5 sm:right-auto">
      {open ? (
        <div className="w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-300/40">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Guida fase 6
          </p>
          <h3 className="mt-1 text-sm font-black text-slate-900">Assistenza contestuale</h3>
          <p className="mt-1 text-xs text-slate-600">
            Mostra suggerimenti rapidi durante setup progetto, tool, integrazioni e tips.
          </p>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold text-slate-700">Guida attiva</span>
            <Switch checked={enabled} onCheckedChange={onEnabledChange} />
          </div>

          <button
            type="button"
            onClick={onReopen}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasContextualStep}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Riapri guida per questa pagina
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg shadow-slate-300/50 transition-colors hover:bg-slate-50 hover:text-slate-800"
        aria-label={open ? 'Chiudi impostazioni guida' : 'Apri impostazioni guida'}
      >
        {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
