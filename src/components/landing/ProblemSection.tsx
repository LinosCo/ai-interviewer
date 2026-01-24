'use client';

import { motion } from 'framer-motion';
import { TrendingDown, Clock, DollarSign, ArrowRight, Check, Sparkles } from 'lucide-react';

const problems = [
  {
    icon: DollarSign,
    title: 'Costi elevati',
    description: 'Ricerche di mercato tradizionali costano migliaia di euro',
  },
  {
    icon: Clock,
    title: 'Tempi lunghi',
    description: 'Settimane o mesi per raccogliere e analizzare i feedback',
  },
  {
    icon: TrendingDown,
    title: 'Dati frammentati',
    description: 'Informazioni sparse tra email, survey e CRM diversi',
  },
];

const solutions = [
  'Interviste AI automatiche da €49/mese',
  'Insight in tempo reale, non in settimane',
  'Tutto connesso in un\'unica dashboard',
  'Consigli pratici generati dall\'AI',
];

export function ProblemSection() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden bg-white/90">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
            Perché ascoltare gli stakeholder{' '}
            <span className="gradient-text">costa così tanto?</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Le piccole e medie imprese meritano strumenti potenti senza budget
            enterprise
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-stretch relative">
          {/* Arrow in the middle - desktop only */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="w-16 h-16 rounded-full gradient-bg shadow-glow flex items-center justify-center"
            >
              <ArrowRight className="w-8 h-8 text-white" />
            </motion.div>
          </div>

          {/* Problems */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-5"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--coral)/0.2)] text-[hsl(var(--coral))] text-sm font-medium mb-2">
              <TrendingDown className="w-4 h-4" />
              Il problema
            </div>

            {problems.map((problem, index) => (
              <motion.div
                key={problem.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex items-start gap-3 p-4 rounded-2xl glass-card transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--coral)/0.2)] flex items-center justify-center flex-shrink-0">
                  <problem.icon className="w-5 h-5 text-[hsl(var(--coral))]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1 text-[hsl(var(--foreground))]">{problem.title}</h3>
                  <p className="text-[hsl(var(--muted-foreground))]">{problem.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Solutions */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--amber)/0.2)] text-[hsl(var(--amber))] text-sm font-medium mb-2">
              <Sparkles className="w-4 h-4" />
              La soluzione
            </div>

            <div className="p-5 sm:p-6 rounded-3xl glass-card">
              <h3 className="font-display text-2xl font-bold mb-6 text-[hsl(var(--foreground))]">
                Business Tuner semplifica tutto
              </h3>

              <ul className="space-y-4">
                {solutions.map((solution, index) => (
                  <motion.li
                    key={solution}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-medium text-[hsl(var(--foreground))]">{solution}</span>
                  </motion.li>
                ))}
              </ul>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 }}
                className="mt-8 p-4 rounded-xl bg-[hsl(var(--amber)/0.1)] border border-[hsl(var(--amber)/0.2)]"
              >
                <p className="text-sm text-[hsl(var(--foreground))]">
                  <span className="font-semibold">A partire da €0/mese</span>{' '}
                  — inizia gratis, scala quando cresci
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
