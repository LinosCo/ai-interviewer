'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  LineChart,
  Lightbulb,
  MessageSquare,
  Play,
  Rocket,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function TrustBadgesView() {
  const badges = [
    'Setup guidato',
    'GDPR compliant, server EU',
    'Supporto italiano',
  ];

  return (
    <div className="grid gap-2.5 text-[hsl(var(--muted-foreground))] text-sm sm:grid-cols-2 md:flex md:flex-wrap md:justify-center md:gap-6">
      {badges.map((label) => (
        <span
          key={label}
          className="flex items-center justify-center gap-2 rounded-full border border-[hsl(var(--border)/0.8)] bg-white/55 px-4 py-2 text-center md:border-none md:bg-transparent md:px-0 md:py-0"
        >
          <svg
            className="w-4 h-4 text-[hsl(var(--coral))]"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {label}
        </span>
      ))}
    </div>
  );
}

interface CyclePhase {
  label: string;
  description: string;
  icon: LucideIcon;
}

const CYCLE_PHASES: CyclePhase[] = [
  {
    label: 'Ascolta',
    description: 'Interviste e chatbot raccolgono segnali da clienti, team e stakeholder.',
    icon: MessageSquare,
  },
  {
    label: 'Decidi',
    description: 'Il Copilot collega i segnali e suggerisce priorità operative concrete.',
    icon: Lightbulb,
  },
  {
    label: 'Esegui',
    description: 'Le automazioni instradano le azioni nei tuoi workflow quotidiani.',
    icon: Rocket,
  },
  {
    label: 'Monitora',
    description: "Dashboard e KPI misurano l'impatto e riattivano il ciclo continuo.",
    icon: LineChart,
  },
];

const CYCLE_PHASE_POSITIONS = [
  'left-1/2 top-0 -translate-x-1/2',
  'right-0 top-1/2 -translate-y-1/2',
  'left-1/2 bottom-0 -translate-x-1/2',
  'left-0 top-1/2 -translate-y-1/2',
] as const;

function HeroCycleVisual(): React.JSX.Element {
  const [activePhase, setActivePhase] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setActivePhase((current) => (current + 1) % CYCLE_PHASES.length);
    }, 2200);

    return () => clearInterval(timer);
  }, [isPaused]);

  const selectPhaseFromPointer = (index: number) => {
    setActivePhase(index);
    setIsPaused(true);
  };

  const selectPhaseFromTap = (index: number) => {
    setActivePhase(index);
    setIsPaused(true);

    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setIsPaused(false), 4500);
  };

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className="mt-12 md:mt-16 max-w-5xl mx-auto"
    >
      <div
        className="glass-card rounded-3xl p-6 md:p-8 border border-[hsl(var(--border)/0.6)] shadow-medium"
        onMouseLeave={() => setIsPaused(false)}
      >
        <p className="font-display text-2xl md:text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] text-center mb-6 md:mb-8">
          Il ciclo di miglioramento continuo
        </p>

        <div className="flex flex-col md:grid md:grid-cols-[1.2fr_1fr] gap-6 md:gap-8 md:items-center">
          <div className="flex items-center justify-center md:min-h-[24rem]">
            <div className="relative h-[15rem] w-[15rem] md:h-[22rem] md:w-[22rem]">
              <div className="absolute inset-7 md:inset-10 rounded-full border border-[hsl(var(--coral)/0.2)]" />
              <div className="absolute inset-12 md:inset-[4.25rem] rounded-full border border-[hsl(var(--amber)/0.2)]" />

              {CYCLE_PHASES.map((phase, index) => {
                const isActive = activePhase === index;
                const Icon = phase.icon;
                const positionClass = CYCLE_PHASE_POSITIONS[index];

                return (
                  <motion.div
                    key={phase.label}
                    className={`absolute ${positionClass}`}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => selectPhaseFromPointer(index)}
                      onFocus={() => selectPhaseFromPointer(index)}
                      onClick={() => selectPhaseFromTap(index)}
                      className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl border flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? 'gradient-bg border-transparent shadow-glow scale-105'
                          : 'bg-[hsl(var(--card))] border-[hsl(var(--border))]'
                      }`}
                      aria-label={`Attiva fase ${phase.label}`}
                    >
                      <Icon
                        className={`w-5 h-5 md:w-7 md:h-7 ${
                          isActive ? 'text-white' : 'text-[hsl(var(--muted-foreground))]'
                        }`}
                      />
                    </button>
                  </motion.div>
                );
              })}

              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 md:w-28 md:h-28 rounded-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] flex items-center justify-center">
                <span className="text-base md:text-2xl font-semibold text-[hsl(var(--foreground))]">
                  {activePhase + 1}/4
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:block md:space-y-2.5">
            <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--coral))] font-semibold">
              Fase attiva
            </p>

            {CYCLE_PHASES.map((phase, index) => {
              const isActive = index === activePhase;
              const Icon = phase.icon;

              return (
                <button
                  key={phase.label}
                  type="button"
                  onMouseEnter={() => selectPhaseFromPointer(index)}
                  onFocus={() => selectPhaseFromPointer(index)}
                  onClick={() => selectPhaseFromTap(index)}
                  className={`w-full text-left rounded-xl border p-2.5 transition-all ${
                    isActive
                      ? 'border-[hsl(var(--coral)/0.45)] bg-[hsl(var(--coral)/0.08)] shadow-soft'
                      : 'border-[hsl(var(--border)/0.7)] bg-[hsl(var(--card)/0.65)] hover:border-[hsl(var(--coral)/0.3)]'
                  }`}
                  aria-label={`Seleziona fase ${phase.label}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${
                        isActive ? 'gradient-bg' : 'bg-[hsl(var(--secondary))]'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-white' : 'text-[hsl(var(--muted-foreground))]'
                        }`}
                      />
                    </div>
                    <div>
                      <p
                        className={`font-semibold ${
                          isActive ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'
                        }`}
                      >
                        {phase.label}
                      </p>
                      <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                        {phase.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-6 md:hidden">
          <p className="font-display text-xl md:text-2xl font-bold text-[hsl(var(--foreground))]">
            {CYCLE_PHASES[activePhase].label}
          </p>
          <p className="text-sm md:text-base text-[hsl(var(--muted-foreground))] mt-2 max-w-lg mx-auto">
            {CYCLE_PHASES[activePhase].description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function HeroSection() {
  return (
    <>
      <section className="relative min-h-[100svh] md:min-h-[92vh] flex items-center pt-24 md:pt-32 pb-8 md:pb-12 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-5xl mx-auto"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] mb-6">
              <span className="text-sm font-medium">
                Il ciclo strategico AI per PMI, consulenti e agenzie
              </span>
            </div>

            {/* H1 */}
            <h1 className="font-display text-[2rem] md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.2] md:leading-[1.1] mb-4 md:mb-8 text-[hsl(var(--foreground))]">
              Sintonizza il tuo business
              <br />
              sui dati che contano.
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-xl text-[hsl(var(--muted-foreground))] mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed px-2 md:px-0">
              Ascolta clienti e stakeholder, decidi con dati reali, esegui con
              automazioni e misura l&apos;impatto. In un unico ciclo.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="gradient-bg text-white shadow-glow hover:opacity-90 text-lg px-10 py-4 font-semibold hover:scale-105 transition-transform rounded-xl inline-flex items-center justify-center gap-2"
              >
                Inizia la prova gratuita
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/preview"
                className="bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 text-lg px-10 py-4 font-semibold shadow-lg hover:scale-105 transition-transform rounded-xl inline-flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Testa un&apos;intervista dal vivo
              </Link>
            </div>

            <HeroCycleVisual />

            {/* Trust badges - hidden on mobile, shown on desktop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="hidden md:block mt-16"
            >
              <TrustBadgesView />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Trust badges - mobile only, below the fold */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="md:hidden py-8 px-6"
      >
        <TrustBadgesView />
      </motion.div>
    </>
  );
}
