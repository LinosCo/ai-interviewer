'use client';

import { motion } from 'framer-motion';
import { Brain, CheckSquare, Clock, Inbox } from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

interface ProblemCard {
  icon: LucideIcon;
  title: string;
  description: string;
}

const problems: ProblemCard[] = [
  {
    icon: Inbox,
    title: 'Raccogli feedback ma restano in un file Excel',
    description:
      'I clienti ti dicono cose importanti. I dipendenti pure. Ma senza un sistema, quei segnali non diventano mai decisioni.',
  },
  {
    icon: Brain,
    title: 'Hai intuizioni ma non dati per decidere',
    description:
      "Sai che qualcosa non funziona, ma non hai una visione d'insieme. Le decisioni restano lente e isolate.",
  },
  {
    icon: Clock,
    title: 'Sai cosa andrebbe fatto ma non hai tempo per farlo',
    description:
      'Le competenze ci sono, manca la costanza operativa. Senza automazione, le buone intenzioni restano nel cassetto.',
  },
  {
    icon: CheckSquare,
    title: 'Agisci ma non misuri l\u2019impatto',
    description:
      'Lanci iniziative, ma non sai se hanno funzionato. Il ciclo di miglioramento non si chiude mai.',
  },
];

export function ProblemSection(): React.JSX.Element {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--coral)/0.05)] via-transparent to-[hsl(var(--amber)/0.06)]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-[hsl(var(--foreground))]">
            Il tuo business intercetta dati interessanti ogni giorno.
            <br />
            <span className="gradient-text">La maggior parte si perde.</span>
          </h2>
        </motion.div>

        {/* 2x2 card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {problems.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="glass-card rounded-2xl p-6"
              >
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--coral)/0.15)] flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[hsl(var(--coral))]" />
                </div>

                <h3 className="font-semibold text-base md:text-lg mb-2 text-[hsl(var(--foreground))]">
                  {card.title}
                </h3>

                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                  {card.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Closing box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-12 max-w-2xl mx-auto"
        >
          <div className="p-6 rounded-xl bg-[hsl(var(--amber)/0.1)] border border-[hsl(var(--amber)/0.2)] text-center">
            <p className="text-sm md:text-base text-[hsl(var(--foreground))] leading-relaxed">
              <span className="font-semibold">
                Non è un problema di strumenti. È un problema di processo.
              </span>{' '}
              Business Tuner lo risolve con un ciclo operativo che ascolta, decide, esegue e
              monitora — senza interruzioni.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
