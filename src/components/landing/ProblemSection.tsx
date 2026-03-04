'use client';

import { motion } from 'framer-motion';
import { TrendingDown, Clock, DollarSign, BarChart3, Check, Sparkles, X } from 'lucide-react';

const comparisons = [
  {
    phase: 'Ascolta',
    problem: {
      icon: DollarSign,
      title: 'Ascolto episodico e costoso',
      description: 'Raccolta feedback una tantum, segnali incompleti e costi alti.',
    },
    solution: {
      title: 'Ascolto continuo integrato',
      description: 'Flussi ricorrenti da clienti, team, stakeholder, mercato e competitor.',
    },
  },
  {
    phase: 'Decidi',
    problem: {
      icon: Clock,
      title: 'Decisioni lente e isolate',
      description: 'Dati frammentati e poca connessione con la strategia di business.',
    },
    solution: {
      title: 'Visione di insieme',
      description: 'Il Copilot unifica segnali e strategia per indicare azioni concrete.',
    },
  },
  {
    phase: 'Esegui',
    problem: {
      icon: TrendingDown,
      title: 'Esecuzione disallineata',
      description: 'Insight discussi ma non attivati, handoff manuali e attrito operativo.',
    },
    solution: {
      title: 'Automazione operativa',
      description: 'Workflow e integrazioni trasformano insight in task e azioni tracciabili.',
    },
  },
  {
    phase: 'Monitora',
    problem: {
      icon: BarChart3,
      title: 'Miglioramento non misurato',
      description: 'Si agisce, ma senza feedback loop chiaro su impatto e competenze.',
    },
    solution: {
      title: 'Controllo e apprendimento continuo',
      description: 'KPI, retrospettive e formazione certificata per team e stakeholder.',
    },
  },
];

export function ProblemSection() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--coral)/0.05)] via-transparent to-[hsl(var(--amber)/0.06)]" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
            Perché il ciclo strategico{' '}
            <span className="gradient-text">si blocca nelle PMI?</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Le frizioni non stanno solo nell&apos;ascolto: emergono in ascolto,
            decisione, esecuzione e monitoraggio.
          </p>
        </motion.div>

        {/* Headers row */}
        <div className="hidden md:grid grid-cols-2 gap-8 mb-6 max-w-4xl mx-auto">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--coral)/0.2)] text-[hsl(var(--coral))] text-sm font-medium">
              <TrendingDown className="w-4 h-4" />
              Il problema
            </div>
          </div>
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--amber)/0.2)] text-[hsl(var(--amber))] text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              La soluzione
            </div>
          </div>
        </div>

        {/* Comparison rows */}
        <div className="space-y-4 max-w-4xl mx-auto">
          {comparisons.map((item, index) => (
            <motion.div
              key={item.problem.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8"
            >
              {/* Problem card */}
              <div className="p-4 rounded-2xl bg-[hsl(var(--coral)/0.05)] border border-[hsl(var(--coral)/0.2)]">
                <div className="md:hidden inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[hsl(var(--coral)/0.15)] text-[hsl(var(--coral))] text-[11px] font-semibold mb-3">
                  <TrendingDown className="w-3 h-3" />
                  Il problema
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--coral)/0.2)] flex items-center justify-center flex-shrink-0">
                    <X className="w-4 h-4 text-[hsl(var(--coral))]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--coral))] font-semibold mb-1">
                      {item.phase}
                    </p>
                    <h3 className="font-semibold text-sm md:text-base mb-0.5 text-[hsl(var(--foreground))]">{item.problem.title}</h3>
                    <p className="text-xs md:text-sm text-[hsl(var(--muted-foreground))]">{item.problem.description}</p>
                  </div>
                </div>
              </div>

              {/* Solution card */}
              <div className="p-4 rounded-2xl bg-[hsl(var(--amber)/0.05)] border border-[hsl(var(--amber)/0.2)]">
                <div className="md:hidden inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[hsl(var(--amber)/0.2)] text-[hsl(var(--amber))] text-[11px] font-semibold mb-3">
                  <Sparkles className="w-3 h-3" />
                  La soluzione
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--amber))] font-semibold mb-1">
                      {item.phase}
                    </p>
                    <h3 className="font-semibold text-sm md:text-base mb-0.5 text-[hsl(var(--foreground))]">{item.solution.title}</h3>
                    <p className="text-xs md:text-sm text-[hsl(var(--muted-foreground))]">{item.solution.description}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-10 max-w-md mx-auto"
        >
          <div className="p-4 rounded-xl bg-[hsl(var(--amber)/0.1)] border border-[hsl(var(--amber)/0.2)] text-center">
            <p className="text-sm text-[hsl(var(--foreground))]">
              <span className="font-semibold">Un approccio sistemico</span>{' '}
              — dall&apos;ascolto alla formazione, in un ciclo continuo
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
