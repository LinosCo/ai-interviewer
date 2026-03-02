'use client';

import { useEffect, useState } from 'react';
import { Sparkles, ArrowLeft, BookOpen, Target, Users, Zap, Check, Brain, ClipboardCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TrainingBotConfigForm from '@/components/training/admin/training-bot-config-form';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface TrainingGeneratedConfig {
  name: string;
  learningGoal: string;
  targetAudience: string;
  tone: string;
  introMessage: string;
  traineeEducationLevel: 'PRIMARY' | 'SECONDARY' | 'UNIVERSITY' | 'PROFESSIONAL';
  traineeCompetenceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  passScoreThreshold: number;
  topics: Array<{
    label: string;
    description: string;
    learningObjectives: string[];
    minCheckingTurns: number;
    maxCheckingTurns: number;
  }>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Quick example prompts
// ──────────────────────────────────────────────────────────────────────────────

const QUICK_EXAMPLES = [
  {
    icon: <BookOpen className="w-5 h-5" />,
    label: 'Sicurezza sul Lavoro',
    prompt:
      'Formare il personale sulle norme di sicurezza sul lavoro: rischi, procedure di emergenza e uso dei dispositivi di protezione individuali.',
  },
  {
    icon: <Target className="w-5 h-5" />,
    label: 'Tecniche di Vendita',
    prompt:
      'Migliorare le competenze di vendita del team commerciale: gestione delle obiezioni, tecniche di negoziazione e chiusura del contratto.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    label: 'Onboarding Aziendale',
    prompt:
      'Percorso di onboarding per i nuovi dipendenti: valori aziendali, processi interni, strumenti e aspettative del ruolo.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    label: 'GDPR & Privacy',
    prompt:
      'Formare il personale sul GDPR: principi fondamentali, obblighi aziendali, gestione dei dati personali e cosa fare in caso di data breach.',
  },
];

const TRAINING_LOADING_STEPS = [
  { text: 'Analizzo il tuo obiettivo formativo...', Icon: Target },
  { text: 'Definisco i moduli del percorso...', Icon: BookOpen },
  { text: 'Creo verifiche e criteri di valutazione...', Icon: ClipboardCheck },
  { text: 'Adatto il tono al pubblico target...', Icon: Users },
  { text: 'Finalizzo la struttura del corso...', Icon: Brain },
];

// ──────────────────────────────────────────────────────────────────────────────
// Step 1: AI generation from prompt
// ──────────────────────────────────────────────────────────────────────────────

function WizardStepPrompt({
  onGenerated,
}: {
  onGenerated: (config: TrainingGeneratedConfig) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading) {
      setCurrentLoadingStep(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentLoadingStep((prev) => (
        prev < TRAINING_LOADING_STEPS.length - 1 ? prev + 1 : prev
      ));
    }, 1300);

    return () => clearInterval(interval);
  }, [loading]);

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("Descrivi l'obiettivo del percorso formativo");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/training-bots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message || 'Generazione fallita');
      }
      const config: TrainingGeneratedConfig = await res.json();
      onGenerated(config);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante la generazione');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Cosa vuoi insegnare?
        </h2>
        <p className="text-gray-500 text-sm">
          Descrivi l&apos;obiettivo formativo e l&apos;AI strutturerà moduli, obiettivi e
          valutazioni su misura.
        </p>
      </div>

      {/* AI generation card */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm ring-4 ring-indigo-50/50">
        <div className="flex gap-4 mb-5">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-900">Genera con AI</h3>
            <p className="text-sm text-gray-500">
              L&apos;AI creerà moduli, obiettivi di apprendimento e parametri di valutazione
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setError('');
            }}
            className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 min-h-[130px] text-sm resize-none"
            placeholder="Es: Formare il team di vendita sulle tecniche di negoziazione avanzata, gestione delle obiezioni e closing delle trattative commerciali B2B..."
          />

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transform transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed"
          >
            {!loading ? (
              <>
                <Sparkles className="w-5 h-5" />
                Genera percorso formativo
              </>
            ) : (
              'Preparazione corso in corso...'
            )}
          </button>

          {error && (
            <p className="text-red-500 text-sm font-medium text-center">{error}</p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-gray-100" />
        <span className="flex-shrink-0 mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
          Esempi di percorsi
        </span>
        <div className="flex-grow border-t border-gray-100" />
      </div>

      {/* Quick examples grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUICK_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => setPrompt(ex.prompt)}
            className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all text-left bg-white group"
          >
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors flex-shrink-0">
              {ex.icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm mb-0.5 group-hover:text-indigo-700 transition-colors">
                {ex.label}
              </p>
              <p className="text-xs text-gray-400 line-clamp-2">{ex.prompt}</p>
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm px-4 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl border border-indigo-100 shadow-2xl p-6"
            >
              <div className="mb-5 text-center">
                <div className="relative mx-auto w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                    <Sparkles className="w-7 h-7" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Creazione corso in corso</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sto preparando la struttura del percorso formativo.
                </p>
              </div>

              <div className="space-y-3">
                {TRAINING_LOADING_STEPS.map((step, index) => {
                  const isCompleted = index < currentLoadingStep;
                  const isCurrent = index === currentLoadingStep;

                  return (
                    <div
                      key={step.text}
                      className={`flex items-center gap-3 transition-all duration-300 ${
                        index <= currentLoadingStep ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : isCurrent
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200 animate-pulse'
                              : 'bg-gray-50 text-gray-300 border-gray-200'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : <step.Icon className="w-4 h-4" />}
                      </div>
                      <p className={`text-sm ${index <= currentLoadingStep ? 'text-gray-800' : 'text-gray-400'}`}>
                        {step.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main wizard component
// ──────────────────────────────────────────────────────────────────────────────

export default function NewTrainingBotWizard({
  organizationId,
}: {
  organizationId: string;
}) {
  const [step, setStep] = useState<'prompt' | 'form'>('prompt');
  const [generatedConfig, setGeneratedConfig] = useState<TrainingGeneratedConfig | null>(null);

  function handleGenerated(config: TrainingGeneratedConfig) {
    setGeneratedConfig(config);
    setStep('form');
  }

  return (
    <div className="min-h-screen bg-indigo-50/20 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Nuovo Percorso Formativo AI
          </h1>
          <p className="mt-2 text-gray-500">
            Genera la struttura con AI, poi personalizza ogni dettaglio
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
              style={{ width: step === 'prompt' ? '33%' : '100%' }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs font-semibold uppercase tracking-widest">
            <span className={step === 'prompt' ? 'text-indigo-600' : 'text-gray-400'}>
              1. Obiettivo
            </span>
            <span className={step === 'form' ? 'text-indigo-600' : 'text-gray-400'}>
              2. Configura
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl p-6 sm:p-10 border border-indigo-100/50">
          <AnimatePresence mode="wait">
            {step === 'prompt' && (
              <WizardStepPrompt key="step-prompt" onGenerated={handleGenerated} />
            )}

            {step === 'form' && generatedConfig && (
              <motion.div
                key="step-form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6"
              >
                {/* Back + badge */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('prompt')}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Torna alla generazione
                  </button>
                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full">
                    <Sparkles className="w-3.5 h-3.5" />
                    Generato con AI — modifica liberamente
                  </span>
                </div>

                <TrainingBotConfigForm
                  mode="create"
                  organizationId={organizationId}
                  initialValues={generatedConfig}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
