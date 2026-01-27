'use client';

import { motion } from 'framer-motion';
import { TrendingDown, Clock, DollarSign, Check, Sparkles, X } from 'lucide-react';

const comparisons = [
  {
    problem: {
      icon: DollarSign,
      title: 'Costi elevati',
      description: 'Migliaia di euro per ricerche di mercato',
    },
    solution: {
      title: 'Scalabilità intelligente',
      description: 'Cresce con te, paghi solo quello che usi',
    },
  },
  {
    problem: {
      icon: Clock,
      title: 'Tempi lunghi',
      description: 'Settimane per raccogliere feedback',
    },
    solution: {
      title: 'Efficienza automatizzata',
      description: 'Analisi istantanea e proposte operative immediate',
    },
  },
  {
    problem: {
      icon: TrendingDown,
      title: 'Dati frammentati',
      description: 'Email, survey e CRM separati',
    },
    solution: {
      title: 'Sistema generativo',
      description: 'Analizza e propone soluzioni strategiche concrete',
    },
  },
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

        {/* Headers row */}
        <div className="grid grid-cols-2 gap-4 md:gap-8 mb-6 max-w-4xl mx-auto">
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
              className="grid grid-cols-2 gap-4 md:gap-8"
            >
              {/* Problem card */}
              <div className="p-4 rounded-2xl bg-[hsl(var(--coral)/0.05)] border border-[hsl(var(--coral)/0.2)]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--coral)/0.2)] flex items-center justify-center flex-shrink-0">
                    <X className="w-4 h-4 text-[hsl(var(--coral))]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm md:text-base mb-0.5 text-[hsl(var(--foreground))]">{item.problem.title}</h3>
                    <p className="text-xs md:text-sm text-[hsl(var(--muted-foreground))]">{item.problem.description}</p>
                  </div>
                </div>
              </div>

              {/* Solution card */}
              <div className="p-4 rounded-2xl bg-[hsl(var(--amber)/0.05)] border border-[hsl(var(--amber)/0.2)]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
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
              — dalla raccolta dati alle decisioni strategiche
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
