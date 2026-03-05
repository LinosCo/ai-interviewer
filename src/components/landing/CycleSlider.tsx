'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Database,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  LineChart,
  Rocket,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Phase {
  label: string;
  icon: LucideIcon;
  text: string;
}

interface Scenario {
  title: string;
  icon: LucideIcon;
  accentClass: string;
  phases: [Phase, Phase, Phase, Phase];
}

const PHASE_ICONS: [LucideIcon, LucideIcon, LucideIcon, LucideIcon] = [
  Database,
  Lightbulb,
  Rocket,
  LineChart,
];

const PHASE_LABELS = ['ASCOLTA', 'DECIDI', 'ESEGUI', 'MONITORA'] as const;

const scenarios: Scenario[] = [
  {
    title: 'Un cliente segnala tempi di risposta lenti',
    icon: HeartHandshake,
    accentClass: 'text-[hsl(var(--foreground))]',
    phases: [
      {
        label: PHASE_LABELS[0],
        icon: PHASE_ICONS[0],
        text: "Il chatbot intercetta il segnale. L'intervista AI lo approfondisce con altri 12 clienti.",
      },
      {
        label: PHASE_LABELS[1],
        icon: PHASE_ICONS[1],
        text: 'Il Copilot collega 18 segnali simili e propone: rivedere il processo di risposta.',
      },
      {
        label: PHASE_LABELS[2],
        icon: PHASE_ICONS[2],
        text: "L'automazione genera una FAQ aggiornata, arricchisce il knowledge base del chatbot e notifica il team.",
      },
      {
        label: PHASE_LABELS[3],
        icon: PHASE_ICONS[3],
        text: 'Dopo 30 giorni il sentiment migliora. Il team completa una formazione sul nuovo processo.',
      },
    ],
  },
  {
    title: 'Il tuo prodotto non compare nelle risposte degli LLM quando dovrebbe',
    icon: TrendingUp,
    accentClass: 'text-[hsl(var(--foreground))]',
    phases: [
      {
        label: PHASE_LABELS[0],
        icon: PHASE_ICONS[0],
        text: 'Il Brand Monitor rileva che nelle risposte AI e nelle SERP i competitor sono citati, tu no.',
      },
      {
        label: PHASE_LABELS[1],
        icon: PHASE_ICONS[1],
        text: 'Gli AI Tips suggeriscono interventi SEO mirati, nuovi contenuti per il sito e post sui social.',
      },
      {
        label: PHASE_LABELS[2],
        icon: PHASE_ICONS[2],
        text: 'Le integrazioni automatizzano la pubblicazione dei contenuti con supervisione del team.',
      },
      {
        label: PHASE_LABELS[3],
        icon: PHASE_ICONS[3],
        text: "Il monitoring traccia l'evoluzione della visibility su SERP e risposte AI settimana dopo settimana.",
      },
    ],
  },
  {
    title: 'Il team ha gap di competenze e i candidati non sono allineati con la visione aziendale',
    icon: GraduationCap,
    accentClass: 'text-[hsl(var(--foreground))]',
    phases: [
      {
        label: PHASE_LABELS[0],
        icon: PHASE_ICONS[0],
        text: "Invii a chi manda il CV un'intervista strutturata per verificare l'allineamento con la visione aziendale.",
      },
      {
        label: PHASE_LABELS[1],
        icon: PHASE_ICONS[1],
        text: "Il Copilot profila i candidati prima dell'incontro e identifica i gap di competenze del team attuale.",
      },
      {
        label: PHASE_LABELS[2],
        icon: PHASE_ICONS[2],
        text: "Vengono attivati percorsi di formazione mirati per colmare le lacune evidenziate dall'analisi.",
      },
      {
        label: PHASE_LABELS[3],
        icon: PHASE_ICONS[3],
        text: "Il Training Bot verifica l'apprendimento con quiz adattivi e certifica le competenze acquisite.",
      },
    ],
  },
  {
    title: 'Un consulente vuole portare dati reali al cliente invece di opinioni',
    icon: Briefcase,
    accentClass: 'text-[hsl(var(--foreground))]',
    phases: [
      {
        label: PHASE_LABELS[0],
        icon: PHASE_ICONS[0],
        text: 'Configura interviste AI per 3 segmenti del cliente: clienti B2B, partner, team commerciale.',
      },
      {
        label: PHASE_LABELS[1],
        icon: PHASE_ICONS[1],
        text: 'Il Copilot produce una sintesi strategica con priorita, pattern e raccomandazioni basate su 90 interviste.',
      },
      {
        label: PHASE_LABELS[2],
        icon: PHASE_ICONS[2],
        text: 'Il report viene generato e le azioni chiave instradate nel CRM del cliente via webhook.',
      },
      {
        label: PHASE_LABELS[3],
        icon: PHASE_ICONS[3],
        text: "Il consulente traccia i KPI e presenta al cliente l'impatto misurabile delle azioni implementate.",
      },
    ],
  },
];

const AUTOPLAY_MS = 8000;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 260 : -260,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -260 : 260,
    opacity: 0,
  }),
};

function ScenarioCard({ scenario }: { scenario: Scenario }): React.JSX.Element {
  return (
    <div className="bg-[hsl(var(--card)/0.92)] rounded-[28px] p-7 border border-[hsl(var(--border)/0.55)] shadow-soft">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-[hsl(var(--secondary))] flex items-center justify-center shrink-0">
          <scenario.icon className={`w-5 h-5 ${scenario.accentClass}`} />
        </div>
        <h3 className="font-display text-lg md:text-xl font-bold text-[hsl(var(--foreground))] leading-snug">
          {scenario.title}
        </h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {scenario.phases.map((phase) => (
          <div
            key={phase.label}
            className="flex flex-col gap-2 rounded-2xl bg-[hsl(var(--background)/0.6)] border border-[hsl(var(--border)/0.35)] p-4"
          >
            <div className="flex items-center gap-2">
              <phase.icon className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[hsl(var(--foreground))]">
                {phase.label}
              </span>
            </div>
            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
              {phase.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CycleSlider(): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mobileContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileCardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const goTo = useCallback((index: number, dir: number) => {
    setDirection(dir);
    setActiveIndex(index);
  }, []);

  const goNext = useCallback(() => {
    const next = (activeIndex + 1) % scenarios.length;
    goTo(next, 1);
  }, [activeIndex, goTo]);

  const goPrev = useCallback(() => {
    const prev = (activeIndex - 1 + scenarios.length) % scenarios.length;
    goTo(prev, -1);
  }, [activeIndex, goTo]);

  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(goNext, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [goNext, isPaused]);

  const handleMobileScroll = useCallback(() => {
    const container = mobileContainerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    mobileCardRefs.current.forEach((card, index) => {
      if (!card) return;
      const distance = Math.abs(card.offsetTop - scrollTop);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setMobileActiveIndex((current) => (current === closestIndex ? current : closestIndex));
  }, []);

  const scrollMobileTo = useCallback((index: number) => {
    const container = mobileContainerRef.current;
    const card = mobileCardRefs.current[index];
    if (!container || !card) return;

    container.scrollTo({
      top: card.offsetTop,
      behavior: 'smooth',
    });
  }, []);

  const scenario = scenarios[activeIndex];

  return (
    <>
      <div className="md:hidden">
        <div
          ref={mobileContainerRef}
          className="max-h-[76svh] overflow-y-auto snap-y snap-mandatory space-y-4 pr-1"
          onScroll={handleMobileScroll}
        >
          {scenarios.map((mobileScenario, index) => (
            <div
              key={mobileScenario.title}
              ref={(node) => {
                mobileCardRefs.current[index] = node;
              }}
              className="snap-start"
            >
              <ScenarioCard scenario={mobileScenario} />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2.5 mt-6">
          {scenarios.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => scrollMobileTo(index)}
              aria-label={`Vai allo scenario ${index + 1}`}
              className={`rounded-full transition-all duration-300 ${
                index === mobileActiveIndex
                  ? 'w-8 h-2.5 bg-[hsl(var(--foreground))]'
                  : 'w-2.5 h-2.5 bg-[hsl(var(--border))]'
              }`}
            />
          ))}
        </div>
      </div>

      <div
        className="hidden md:block relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <button
          type="button"
          onClick={goPrev}
          aria-label="Scenario precedente"
          className="absolute -left-3 md:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.55)] shadow-soft flex items-center justify-center hover:shadow-medium transition-shadow"
        >
          <ChevronLeft className="w-5 h-5 text-[hsl(var(--foreground))]" />
        </button>

        <button
          type="button"
          onClick={goNext}
          aria-label="Scenario successivo"
          className="absolute -right-3 md:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.55)] shadow-soft flex items-center justify-center hover:shadow-medium transition-shadow"
        >
          <ChevronRight className="w-5 h-5 text-[hsl(var(--foreground))]" />
        </button>

        <div className="overflow-hidden px-6 md:px-10">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <ScenarioCard scenario={scenario} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-2.5 mt-8">
          {scenarios.map((dotScenario, index) => {
            const isCurrent = index === activeIndex;

            return (
              <button
                key={dotScenario.title}
                type="button"
                onClick={() => goTo(index, index > activeIndex ? 1 : -1)}
                aria-label={`Vai allo scenario ${index + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  isCurrent
                    ? 'w-8 h-2.5 bg-[hsl(var(--foreground))]'
                    : 'w-2.5 h-2.5 bg-[hsl(var(--border))] hover:bg-[hsl(var(--muted-foreground)/0.4)]'
                }`}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
