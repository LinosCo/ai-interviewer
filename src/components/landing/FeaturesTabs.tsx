'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  GraduationCap,
  Lightbulb,
  LineChart,
  MessageSquare,
  Plug,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FeatureCard {
  icon: LucideIcon;
  title: string;
  description: string;
  benefits: string[];
}

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  phaseDescription: string;
  columns: 2 | 3;
  cards: FeatureCard[];
}

const TABS: Tab[] = [
  {
    id: 'ascolta',
    label: 'ASCOLTA',
    icon: MessageSquare,
    phaseDescription: 'Raccogli segnali da clienti, chat e mercato.',
    columns: 3,
    cards: [
      {
        icon: MessageSquare,
        title: 'Interviste AI',
        description: 'Interviste qualitative automatiche 24/7 con domande adattive.',
        benefits: [
          'Interviste automatiche 24/7',
          'Domande adattive',
          'Analisi sentiment',
          'Report dettagliati',
        ],
      },
      {
        icon: Bot,
        title: 'Chatbot AI',
        description: 'Assisti i visitatori e raccogli segnali strategici da ogni conversazione.',
        benefits: [
          'Tono di voce personalizzato',
          'Analisi bisogni continua',
          'AI Tips strategici',
          'Escalation automatica',
        ],
      },
      {
        icon: LineChart,
        title: 'Brand & Market Monitor',
        description: 'Monitora menzioni, SERP e risposte AI su brand e competitor.',
        benefits: [
          'Monitoraggio SERP e AI',
          'Confronto competitor',
          'Trend menzioni',
          'Segnali deboli',
        ],
      },
    ],
  },
  {
    id: 'decidi',
    label: 'DECIDI',
    icon: Lightbulb,
    phaseDescription: 'Trasforma i segnali in priorità e raccomandazioni operative.',
    columns: 2,
    cards: [
      {
        icon: Lightbulb,
        title: 'Copilot Strategico',
        description:
          'Incrocia tutti i segnali con la tua strategia e propone azioni concrete e motivate.',
        benefits: [
          "Visione d'insieme",
          'Raccomandazioni motivate',
          'Playbook operativi',
          'Priorita basate su dati',
        ],
      },
      {
        icon: Sparkles,
        title: 'AI Tips',
        description:
          "Suggerimenti operativi generati dall'analisi incrociata di interviste, chat e monitoring.",
        benefits: [
          'Tips categorizzati',
          'Azioni immediate',
          'Collegamento ai segnali',
          'Aggiornamento continuo',
        ],
      },
    ],
  },
  {
    id: 'esegui',
    label: 'ESEGUI',
    icon: Plug,
    phaseDescription: 'Attiva integrazioni e automazioni sui flussi quotidiani.',
    columns: 2,
    cards: [
      {
        icon: Plug,
        title: 'Integrazioni native',
        description: 'Google Analytics, Search Console, WordPress, WooCommerce e altro.',
        benefits: [
          'Connessione diretta',
          'Setup guidato',
          'Dati sincronizzati',
          'Zero codice',
        ],
      },
      {
        icon: Workflow,
        title: 'Automazioni no-code',
        description: 'Webhook e n8n per instradare insight verso Slack, CRM, Notion e 400+ app.',
        benefits: ['Webhook pronti', 'n8n integrato', '400+ app', 'Flow personalizzabili'],
      },
    ],
  },
  {
    id: 'monitora',
    label: 'MONITORA',
    icon: BarChart3,
    phaseDescription: 'Misura impatto e risultati per riattivare il ciclo.',
    columns: 2,
    cards: [
      {
        icon: BarChart3,
        title: 'KPI & Analytics',
        description: 'Misura impatto delle azioni nel tempo con dashboard dedicate.',
        benefits: [
          'Dashboard dedicate',
          'Trend nel tempo',
          'Report esportabili',
          'KPI personalizzabili',
        ],
      },
      {
        icon: GraduationCap,
        title: 'Formazione AI',
        description:
          'Forma team e stakeholder con sessioni AI strutturate, quiz adattivi e certificazioni.',
        benefits: [
          'Sessioni strutturate',
          'Quiz adattivi',
          'Certificazioni',
          'Percorsi personalizzati',
        ],
      },
    ],
  },
];

const ECOSYSTEM_PILLS = [
  { label: 'Interviste AI', icon: MessageSquare },
  { label: 'Chatbot', icon: Bot },
  { label: 'Monitoring', icon: LineChart },
  { label: 'Copilot', icon: Lightbulb },
  { label: 'Automazioni', icon: Workflow },
  { label: 'Formazione', icon: GraduationCap },
];

const INTEGRATION_TAGS = [
  'Google Analytics',
  'Search Console',
  'WordPress',
  'WooCommerce',
  'Webhook',
  'n8n',
  'CRM',
];

function FeatureCardItem({ card }: { card: FeatureCard }): React.JSX.Element {
  const Icon = card.icon;

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col h-full">
      <div className="w-12 h-12 rounded-xl bg-[hsl(var(--coral)/0.1)] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[hsl(var(--coral))]" />
      </div>

      <h3 className="font-display text-xl font-bold text-[hsl(var(--foreground))] mb-2">
        {card.title}
      </h3>

      <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5 leading-relaxed">
        {card.description}
      </p>

      <ul className="space-y-2.5 mt-auto">
        {card.benefits.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-[hsl(var(--foreground))]">{benefit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MobileFeatureAccordion({
  card,
  isOpen,
  onToggle,
}: {
  card: FeatureCard;
  isOpen: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const Icon = card.icon;

  return (
    <div className="glass-card rounded-2xl border border-[hsl(var(--border)/0.55)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[hsl(var(--coral)/0.1)] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-[hsl(var(--coral))]" />
          </div>
          <span className="font-display text-lg font-bold text-[hsl(var(--foreground))] truncate">
            {card.title}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[hsl(var(--muted-foreground))] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-[hsl(var(--border)/0.45)]">
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed mt-4">
                {card.description}
              </p>

              <ul className="space-y-2.5 mt-4">
                {card.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-[hsl(var(--foreground))]">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FeaturesTabs(): React.JSX.Element {
  const [activeTabId, setActiveTabId] = useState<string>(TABS[0].id);
  const [openCardIndex, setOpenCardIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];
  const activeTabIndex = Math.max(0, TABS.findIndex((tab) => tab.id === activeTab.id));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(media.matches);
    sync();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (!isDesktop || isAutoPaused) return;

    const timer = setInterval(() => {
      setActiveTabId((current) => {
        const currentIndex = TABS.findIndex((tab) => tab.id === current);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % TABS.length;
        return TABS[nextIndex].id;
      });
      setOpenCardIndex(0);
    }, 10000);

    return () => clearInterval(timer);
  }, [isDesktop, isAutoPaused]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const pauseAutoOnTap = () => {
    setIsAutoPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setIsAutoPaused(false), 3500);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-6 md:mb-10"
        onMouseEnter={() => setIsAutoPaused(true)}
        onMouseLeave={() => setIsAutoPaused(false)}
      >
        <div className="grid grid-cols-2 gap-3 md:hidden">
          {TABS.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTabId(tab.id);
                  setOpenCardIndex(0);
                  pauseAutoOnTap();
                }}
                className={`flex min-h-[96px] flex-col items-start justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                  isActive
                    ? 'gradient-bg text-white shadow-glow border-transparent'
                    : 'bg-[hsl(var(--card)/0.85)] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--coral)/0.35)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                      isActive
                        ? 'border-white/30 bg-white/20 text-white'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <TabIcon className="h-4 w-4" />
                </div>
                <span className="font-display text-base font-bold tracking-[0.04em]">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto scrollbar-hide pb-2">
          <div className="flex gap-3 min-w-max md:mx-auto md:w-fit">
            {TABS.map((tab, index) => {
              const isActive = tab.id === activeTabId;
              const TabIcon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setOpenCardIndex(0);
                    pauseAutoOnTap();
                  }}
                  onTouchStart={pauseAutoOnTap}
                  className={`flex items-center gap-2.5 rounded-2xl border px-6 py-3.5 text-base font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'gradient-bg text-white shadow-glow border-transparent'
                      : 'bg-[hsl(var(--card)/0.85)] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--coral)/0.35)]'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                      isActive
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-[hsl(var(--secondary))] border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--background)/0.88)] px-4 py-3.5 text-center shadow-soft md:rounded-none md:border-none md:bg-transparent md:px-0 md:py-0 md:shadow-none">
          <p className="text-sm md:text-base text-[hsl(var(--muted-foreground))]">
            <span className="font-semibold text-[hsl(var(--foreground))]">
              Fase {activeTabIndex + 1} di {TABS.length}:
            </span>{' '}
            {activeTab.phaseDescription}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            I tool qui sotto appartengono alla fase selezionata.
          </p>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          <div className="md:hidden space-y-4">
            {activeTab.cards.map((card, index) => (
              <MobileFeatureAccordion
                key={card.title}
                card={card}
                isOpen={openCardIndex === index}
                onToggle={() => setOpenCardIndex((current) => (current === index ? -1 : index))}
              />
            ))}
          </div>

          <div
            className={`hidden md:grid gap-6 ${
              activeTab.columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 max-w-4xl mx-auto'
            }`}
          >
            {activeTab.cards.map((card) => (
              <FeatureCardItem key={card.title} card={card} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mt-20 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--coral)/0.1)] via-[hsl(var(--amber)/0.1)] to-green-500/10 rounded-3xl blur-xl" />

        <div className="relative bg-[hsl(var(--card))] rounded-3xl p-8 md:p-12 border border-[hsl(var(--border)/0.5)] shadow-medium text-center">
          <Zap className="w-12 h-12 text-[hsl(var(--coral))] mx-auto mb-6" />

          <h3 className="font-display text-2xl md:text-3xl font-bold mb-4">
            Un unico workspace, un ciclo completo
          </h3>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-3">
            {ECOSYSTEM_PILLS.map((pill, index) => {
              const PillIcon = pill.icon;
              const isLast = index === ECOSYSTEM_PILLS.length - 1;

              return (
                <div key={pill.label} className="flex items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--coral)/0.1)] border border-[hsl(var(--coral)/0.2)]">
                    <PillIcon className="w-4 h-4 text-[hsl(var(--coral))]" />
                    <span className="text-sm font-medium whitespace-nowrap">{pill.label}</span>
                  </div>
                  {!isLast && (
                    <span className="hidden sm:block text-[hsl(var(--muted-foreground))] font-medium">
                      +
                    </span>
                  )}
                </div>
              );
            })}

            <span className="hidden sm:block text-[hsl(var(--muted-foreground))] font-medium">
              =
            </span>

            <div className="flex items-center gap-2 px-4 py-2 rounded-full gradient-bg shadow-glow">
              <Zap className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white whitespace-nowrap">
                Ciclo completo
              </span>
            </div>
          </div>

          <p className="sm:hidden text-sm text-[hsl(var(--muted-foreground))] mt-4">
            Interviste AI + Chatbot + Monitoring + Copilot + Automazioni + Formazione = Un unico
            workspace, un ciclo completo
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {INTEGRATION_TAGS.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}
