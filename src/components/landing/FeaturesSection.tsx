'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Bot, LineChart, Zap, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: MessageSquare,
    title: 'Raccogli Feedback con Interviste AI',
    description:
      "L'intelligenza artificiale conduce interviste qualitative personalizzate con clienti, dipendenti e stakeholder. Raccogli insight profondi senza il costo di un ricercatore.",
    benefits: [
      'Interviste automatiche 24/7',
      'Domande adattive basate sulle risposte',
      'Analisi del sentiment in tempo reale',
      'Report dettagliati per ogni stakeholder',
    ],
    color: 'coral',
    mockup: (
      <div className="bg-[hsl(var(--card))] rounded-xl p-4 shadow-soft border border-[hsl(var(--border)/0.5)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--coral)/0.2)] flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-[hsl(var(--coral))]" />
          </div>
          <span className="font-medium text-sm">Intervista in corso...</span>
        </div>
        <div className="space-y-3">
          <div className="bg-[hsl(var(--secondary))] rounded-lg p-3 ml-8">
            <p className="text-sm">Come valuti la tua esperienza complessiva?</p>
          </div>
          <div className="bg-[hsl(var(--coral)/0.1)] rounded-lg p-3 mr-8 border border-[hsl(var(--coral)/0.2)]">
            <p className="text-sm">
              Molto positiva! Il servizio clienti è eccellente...
            </p>
          </div>
          <div className="flex items-center gap-2 ml-8 text-xs text-[hsl(var(--muted-foreground))]">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--coral))] animate-pulse" />
            L&apos;AI sta analizzando...
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Bot,
    title: 'Assistente Chat AI per il tuo Sito',
    description:
      'Un chatbot intelligente che impara dal tuo brand, risponde ai clienti 24/7 e raccoglie insight preziosi da ogni conversazione.',
    benefits: [
      'Personalizzato con il tuo tono di voce',
      'Risponde in italiano naturale',
      'Impara dai tuoi documenti e FAQ',
      'Scala automaticamente i casi complessi',
    ],
    color: 'amber',
    mockup: (
      <div className="bg-[hsl(var(--card))] rounded-xl p-4 shadow-soft border border-[hsl(var(--border)/0.5)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-medium text-sm block">Assistente AI</span>
              <span className="text-xs text-green-500">● Online</span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-[hsl(var(--secondary))] rounded-lg p-3 mr-8">
            <p className="text-sm">Quali sono i tempi di consegna?</p>
          </div>
          <div className="bg-gradient-to-r from-[hsl(var(--coral)/0.1)] to-[hsl(var(--amber)/0.1)] rounded-lg p-3 ml-8 border border-[hsl(var(--amber)/0.2)]">
            <p className="text-sm">
              Consegniamo in 24-48h in tutta Italia! Per ordini urgenti, offriamo
              anche la consegna express in giornata nelle principali città.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: LineChart,
    title: 'Monitora la Visibilità AI',
    description:
      "Scopri come il tuo brand appare nelle risposte di ChatGPT, Perplexity e altri LLM. Monitora il posizionamento rispetto ai competitor.",
    benefits: [
      'Monitoraggio LLM e Google News',
      'Posizionamento vs competitor',
      'Analisi del sentiment automatica',
      'Report dettagliati per prompt',
    ],
    color: 'green',
    mockup: (
      <div className="bg-[hsl(var(--card))] rounded-xl p-4 shadow-soft border border-[hsl(var(--border)/0.5)]">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium text-sm">Reputation Score</span>
          <span className="text-green-500 font-bold">+12%</span>
        </div>
        <div className="h-24 flex items-end gap-1">
          {[40, 55, 45, 60, 70, 65, 80, 75, 85, 78, 90, 88].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-green-500/60 to-green-400/40"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>Gen</span>
          <span>Dic</span>
        </div>
      </div>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section id="strumenti" className="pt-8 pb-20 md:pt-12 md:pb-28 relative">
      {/* White overlay */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] mb-6">
            <Zap className="w-4 h-4 text-[hsl(var(--coral))]" />
            <span className="text-sm font-medium">3 strumenti, 1 piattaforma</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Ascolta{' '}
            <span className="gradient-text">clienti, team e partner</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Tre strumenti potenti che parlano tra loro, connessi dall&apos;AI per
            raccogliere feedback da tutti gli stakeholder e darti una visione completa
          </p>
        </motion.div>

        {/* Features */}
        <div className="space-y-20">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className={`grid lg:grid-cols-2 gap-12 items-center ${
                index % 2 === 1 ? 'lg:grid-flow-col-dense' : ''
              }`}
            >
              {/* Content */}
              <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                <div
                  className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6 ${
                    feature.color === 'coral'
                      ? 'bg-[hsl(var(--coral)/0.1)]'
                      : feature.color === 'amber'
                      ? 'bg-[hsl(var(--amber)/0.1)]'
                      : 'bg-green-500/10'
                  }`}
                >
                  <feature.icon
                    className={`w-7 h-7 ${
                      feature.color === 'coral'
                        ? 'text-[hsl(var(--coral))]'
                        : feature.color === 'amber'
                        ? 'text-[hsl(var(--amber))]'
                        : 'text-green-500'
                    }`}
                  />
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold mb-4">
                  {feature.title}
                </h3>
                <p className="text-lg text-[hsl(var(--muted-foreground))] mb-6">
                  {feature.description}
                </p>
                <ul className="space-y-3 mb-8">
                  {feature.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-[hsl(var(--foreground))]">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="#pricing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--secondary))] transition-colors font-medium group"
                >
                  Scopri di più
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Mockup */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`relative ${index % 2 === 1 ? 'lg:col-start-1' : ''}`}
              >
                <div
                  className={`absolute inset-0 rounded-3xl blur-2xl opacity-50 ${
                    feature.color === 'coral'
                      ? 'bg-[hsl(var(--coral)/0.1)]'
                      : feature.color === 'amber'
                      ? 'bg-[hsl(var(--amber)/0.1)]'
                      : 'bg-green-500/10'
                  }`}
                />
                <div className="relative bg-[hsl(var(--card))] rounded-3xl p-6 md:p-8 border border-[hsl(var(--border)/0.5)] shadow-strong">
                  {feature.mockup}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Integration Highlight */}
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
              L&apos;ecosistema connesso
            </h3>
            <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-8">
              I tre strumenti non lavorano in silos. L&apos;AI analizza tutti i dati
              insieme — interviste, chat, menzioni — per darti insight che nessuno
              strumento singolo potrebbe offrire.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--coral)/0.1)] border border-[hsl(var(--coral)/0.2)]">
                <MessageSquare className="w-4 h-4 text-[hsl(var(--coral))]" />
                <span className="text-sm font-medium">Interviste AI</span>
              </div>
              <div className="text-[hsl(var(--muted-foreground))]">+</div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--amber)/0.1)] border border-[hsl(var(--amber)/0.2)]">
                <Bot className="w-4 h-4 text-[hsl(var(--amber))]" />
                <span className="text-sm font-medium">Chatbot</span>
              </div>
              <div className="text-[hsl(var(--muted-foreground))]">+</div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                <LineChart className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Reputation</span>
              </div>
              <div className="text-[hsl(var(--muted-foreground))]">=</div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full gradient-bg shadow-glow">
                <Zap className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">
                  Visione completa
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
