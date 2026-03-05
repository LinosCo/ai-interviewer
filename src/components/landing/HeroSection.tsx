'use client';

import { useEffect, useState } from 'react';
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
    <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-[hsl(var(--muted-foreground))] text-sm">
      {badges.map((label) => (
        <span key={label} className="flex items-center gap-2">
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
    description: 'Il Copilot collega i segnali e suggerisce priorita operative concrete.',
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

function HeroCycleVisual(): React.JSX.Element {
  const [activePhase, setActivePhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivePhase((current) => (current + 1) % CYCLE_PHASES.length);
    }, 2200);

    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className="mt-10 md:mt-12 max-w-2xl mx-auto"
    >
      <div className="glass-card rounded-3xl p-6 md:p-8 border border-[hsl(var(--border)/0.6)] shadow-medium">
        <div className="relative mx-auto h-48 w-48">
          <div className="absolute inset-5 rounded-full border border-[hsl(var(--coral)/0.2)]" />
          <div className="absolute inset-9 rounded-full border border-[hsl(var(--amber)/0.2)]" />

          {CYCLE_PHASES.map((phase, index) => {
            const angle = (index / CYCLE_PHASES.length) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * 74;
            const y = Math.sin(angle) * 74;
            const isActive = activePhase === index;
            const Icon = phase.icon;

            return (
              <motion.div
                key={phase.label}
                className="absolute left-1/2 top-1/2"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                <div
                  className={`-translate-x-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-2xl border flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'gradient-bg border-transparent shadow-glow scale-105'
                      : 'bg-[hsl(var(--card))] border-[hsl(var(--border))]'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isActive ? 'text-white' : 'text-[hsl(var(--muted-foreground))]'
                    }`}
                  />
                </div>
              </motion.div>
            );
          })}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] flex items-center justify-center">
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {activePhase + 1}/4
            </span>
          </div>
        </div>

        <div className="text-center mt-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[hsl(var(--coral))] font-semibold">
            Fase attiva
          </p>
          <p className="font-display text-xl md:text-2xl font-bold text-[hsl(var(--foreground))] mt-1">
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
