'use client';

import { ArrowRight, Sparkles } from 'lucide-react';

import type { RelatedActionSuggestion } from '@/lib/projects/project-tip-related-suggestions';

interface RelatedActionSuggestionsProps {
  suggestions: RelatedActionSuggestion[];
  promptSuggestions: string[];
  onUsePrompt: (prompt: string) => void;
}

export function RelatedActionSuggestions({
  suggestions,
  promptSuggestions,
  onUsePrompt,
}: RelatedActionSuggestionsProps) {
  if (!suggestions.length && !promptSuggestions.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Prossime mosse collegate</p>
        <p className="mt-1 text-xs text-slate-600">
          Questo tip non si ferma all&apos;azione principale: puoi amplificarlo con mosse coerenti sullo stesso intento.
        </p>
      </div>

      {suggestions.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {suggestions.map((suggestion, index) => (
            <div key={`${suggestion.key}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{suggestion.channel}</p>
                  <h4 className="mt-1 text-sm font-bold text-slate-900">{suggestion.title}</h4>
                </div>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{suggestion.description}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Perché:</span> {suggestion.rationale}
              </p>
              {promptSuggestions[index] ? (
                <button
                  type="button"
                  onClick={() => onUsePrompt(promptSuggestions[index])}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-700 transition-colors hover:text-amber-800"
                >
                  Usa nel Copilot
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {promptSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {promptSuggestions.map((prompt, index) => (
            <button
              key={`${prompt}-${index}`}
              type="button"
              onClick={() => onUsePrompt(prompt)}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
