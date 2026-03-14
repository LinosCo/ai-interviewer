'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Send, Save, Target, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { showToast } from '@/components/toast';
import ReactMarkdown from 'react-markdown';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface StrategyInterviewWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  organizationId: string | null;
  /** Pre-loaded strategy text (strategicVision) */
  existingVision: string;
  /** Pre-loaded value proposition */
  existingValue: string;
  /** Called after successful save */
  onSaved: (vision: string, value: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Initial system prompt                                              */
/* ------------------------------------------------------------------ */

const INTERVIEW_STARTER_PROMPT = `Sei un consulente strategico AI. Conduci un'intervista strutturata per definire la strategia di questo progetto.

Regole:
- Fai UNA domanda alla volta, breve e chiara
- Segui questo ordine: 1) Obiettivi principali del progetto 2) Target / cliente ideale 3) Value proposition unica 4) Posizionamento desiderato nei motori AI e di ricerca
- Dopo ogni risposta dell'utente, dai un breve feedback positivo e passa alla domanda successiva
- Quando hai raccolto tutte le risposte (dopo la 4a), genera un RIEPILOGO STRATEGICO strutturato così:

---STRATEGIA---
Obiettivi: [obiettivi]

Target: [target]

Posizionamento AI: [posizionamento]
---VALUE---
[value proposition]
---FINE---

Inizia ora con la prima domanda.`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StrategyInterviewWizard({
  open,
  onOpenChange,
  projectId,
  organizationId,
  existingVision,
  existingValue,
  onSaved,
}: StrategyInterviewWizardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [extractedStrategy, setExtractedStrategy] = useState<{ vision: string; value: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasStarted = useRef(false);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when not loading
  useEffect(() => {
    if (!isLoading && open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLoading, open]);

  /* ---- Streaming send ---- */
  const sendMessage = useCallback(async (content: string, isSystem = false) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!isSystem) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
    }
    setInput('');
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: 'assistant', content: '' },
    ]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          conversationId,
          projectId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as Record<string, string>).message || 'Errore');
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let metaBuffer = '';
      let readingMeta = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let chunk = decoder.decode(value, { stream: true });

        if (readingMeta) {
          metaBuffer += chunk;
        } else {
          while (chunk.length > 0) {
            const replaceIdx = chunk.indexOf('\x00');
            const metaIdx = chunk.indexOf('\x01');
            const controlIndexes = [replaceIdx, metaIdx].filter((i) => i >= 0);
            const nextControl = controlIndexes.length > 0 ? Math.min(...controlIndexes) : -1;

            if (nextControl === -1) {
              accumulated += chunk;
              chunk = '';
              continue;
            }

            accumulated += chunk.slice(0, nextControl);
            const controlChar = chunk[nextControl];
            chunk = chunk.slice(nextControl + 1);

            if (controlChar === '\x00') {
              accumulated = '';
              continue;
            }

            metaBuffer += chunk;
            readingMeta = true;
            chunk = '';
          }
        }

        const visibleContent = accumulated.replace(/\nFOLLOW_UP:[\s\S]*$/m, '');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: visibleContent || ' ' } : m,
          ),
        );
      }

      // Finalize
      const finalContent =
        accumulated.replace(/\nFOLLOW_UP:[\s\S]*$/m, '').trim() ||
        'Risposta non disponibile.';

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: finalContent } : m,
        ),
      );

      // Parse metadata for conversationId
      if (metaBuffer) {
        try {
          const meta = JSON.parse(metaBuffer);
          if (meta.conversationId) setConversationId(meta.conversationId);
        } catch {
          // ignore
        }
      }

      // Check for strategy extraction markers
      tryExtractStrategy(finalContent);
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const errorMsg = isAbort
        ? 'Timeout — riprova con una risposta più breve.'
        : err instanceof Error
          ? err.message
          : 'Errore.';

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: `Errore: ${errorMsg}` } : m,
        ),
      );
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }, [conversationId, projectId]);

  /* ---- Extract strategy from AI response ---- */
  const tryExtractStrategy = (text: string) => {
    const stratMatch = text.match(/---STRATEGIA---([\s\S]*?)---VALUE---/);
    const valueMatch = text.match(/---VALUE---([\s\S]*?)---FINE---/);
    if (stratMatch && valueMatch) {
      setExtractedStrategy({
        vision: stratMatch[1].trim(),
        value: valueMatch[1].trim(),
      });
    }
  };

  /* ---- Start interview on open ---- */
  useEffect(() => {
    if (!open) {
      hasStarted.current = false;
      return;
    }
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Reset state
    setMessages([]);
    setConversationId(null);
    setExtractedStrategy(null);
    setInput('');

    // Build the initial prompt with existing strategy context
    let starterPrompt = INTERVIEW_STARTER_PROMPT;
    if (existingVision || existingValue) {
      starterPrompt += `\n\nL'utente ha già una strategia definita. Usala come punto di partenza e chiedi se vuole confermare o modificare ciascun punto:\nStrategia attuale: ${existingVision}\nValue proposition attuale: ${existingValue}`;
    }

    void sendMessage(starterPrompt, true);
  }, [open, existingVision, existingValue, sendMessage]);

  /* ---- Save strategy ---- */
  const handleSave = async () => {
    if (!extractedStrategy) return;
    setIsSaving(true);
    try {
      const url = projectId
        ? `/api/projects/${projectId}/settings`
        : '/api/organization/settings';
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategicVision: extractedStrategy.vision,
          valueProposition: extractedStrategy.value,
        }),
      });
      if (res.ok) {
        showToast('Strategia salvata! Verrà usata per la prossima analisi.');
        onSaved(extractedStrategy.vision, extractedStrategy.value);
        onOpenChange(false);
      } else {
        showToast('Errore durante il salvataggio', 'error');
      }
    } catch {
      showToast('Errore di rete', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /* ---- Request summary manually ---- */
  const requestSummary = () => {
    void sendMessage(
      'Genera ora il riepilogo strategico strutturato con i marker ---STRATEGIA---, ---VALUE--- e ---FINE--- basandoti su tutto quello che abbiamo discusso.',
    );
  };

  /* ---- Key handler ---- */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        void sendMessage(input);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-base">Intervista Strategica</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            L&apos;AI ti guiderà con domande mirate per definire la strategia del progetto.
          </DialogDescription>
        </DialogHeader>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[300px] max-h-[50vh]">
          {messages
            .filter((m) => m.role !== 'user' || !m.content.startsWith('Sei un consulente'))
            .map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-800 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-800 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-slate max-w-none [&_p]:mb-1 [&_p]:mt-0">
                      <ReactMarkdown>
                        {(msg.content || '...').replace(/---(?:STRATEGIA|VALUE|FINE)---/g, '').trim()}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500 rounded-bl-md">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sto pensando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Strategy extracted banner */}
        {extractedStrategy && (
          <div className="mx-5 mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1">
              Strategia pronta!
            </p>
            <p className="text-xs text-emerald-600 line-clamp-2">
              {extractedStrategy.vision.slice(0, 120)}...
            </p>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-slate-100 px-5 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua risposta..."
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-300 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="shrink-0 rounded-xl bg-slate-800 p-2.5 text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {extractedStrategy ? (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salva strategia
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={requestSummary}
                disabled={isLoading || messages.length < 4}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
                Genera riepilogo
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
