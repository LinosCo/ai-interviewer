'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Lightbulb, X } from 'lucide-react';

import type { GuidanceStepDefinition } from '@/lib/guidance/guidance-rules';

interface GuidancePopupProps {
  step: GuidanceStepDefinition;
  actionHref: string | null;
  onDismiss: () => void;
  onComplete: () => void;
  onAction?: () => void;
}

export function GuidancePopup({
  step,
  actionHref,
  onDismiss,
  onComplete,
  onAction,
}: GuidancePopupProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-x-3 bottom-4 z-50 rounded-2xl border border-amber-100 bg-white/95 p-4 shadow-2xl shadow-slate-300/40 backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:w-[340px]"
      aria-live="polite"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
            <Lightbulb className="h-4 w-4" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">
            Guida attiva
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Nascondi guida"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <h3 className="text-sm font-black text-slate-900">{step.title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{step.description}</p>
      <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
        <span className="font-semibold text-slate-800">Perche conta:</span> {step.whyItMatters}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {actionHref ? (
          <Link
            href={actionHref}
            onClick={onAction}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-700"
          >
            {step.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}

        <button
          type="button"
          onClick={onComplete}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Segna completato
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
        >
          Nascondi step
        </button>
      </div>
    </motion.aside>
  );
}
