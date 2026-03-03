'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Plus, RefreshCw } from 'lucide-react';

type Props = {
  configId: string;
  suggestions: string[];
  existingCompetitors: string[];
};

export function AutoCompetitorSuggestions({ configId, suggestions, existingCompetitors }: Props) {
  const [adding, setAdding] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const normalizedExisting = useMemo(
    () => new Set(existingCompetitors.map((c) => c.trim().toLowerCase())),
    [existingCompetitors]
  );

  const visibleSuggestions = suggestions.filter((name) => !hidden[name]);
  if (visibleSuggestions.length === 0) return null;

  const addCompetitor = async (name: string) => {
    setAdding(name);
    try {
      const res = await fetch('/api/visibility/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId,
          name,
          enabled: true
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Impossibile aggiungere competitor');
      }
      setHidden((prev) => ({ ...prev, [name]: true }));
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Errore aggiungendo competitor');
    } finally {
      setAdding(null);
    }
  };

  const dismissSuggestion = (name: string) => {
    setHidden((prev) => ({ ...prev, [name]: true }));
  };

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-900">
          <Lightbulb className="h-4 w-4 text-amber-600" />
          Competitor suggeriti automaticamente
        </CardTitle>
        <CardDescription className="text-xs text-amber-800/90">
          Proposte aggiornate dopo l&apos;ultima analisi del Brand Monitor, basate sulle risposte LLM raccolte.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {visibleSuggestions.map((name) => {
          const alreadyTracked = normalizedExisting.has(name.trim().toLowerCase());
          return (
            <div key={name} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-amber-100 bg-white">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                {alreadyTracked && (
                  <Badge variant="outline" className="mt-1 text-[10px] !border-emerald-200 !text-emerald-700 !bg-emerald-50">
                    Già monitorato
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!alreadyTracked && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => addCompetitor(name)}
                    disabled={adding === name}
                  >
                    {adding === name ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Aggiungi
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-slate-500 hover:text-slate-700"
                  onClick={() => dismissSuggestion(name)}
                >
                  Nascondi
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
