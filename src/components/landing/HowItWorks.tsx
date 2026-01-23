'use client';

import { motion } from 'framer-motion';
import { Settings, Database, Lightbulb, Rocket } from 'lucide-react';

const steps = [
  {
    icon: Settings,
    number: '01',
    title: 'Configura',
    description:
      'Collega i tuoi canali e definisci i tuoi stakeholder: clienti, team, partner.',
  },
  {
    icon: Database,
    number: '02',
    title: 'Raccogli',
    description:
      "L'AI conduce interviste, risponde via chat e monitora le menzioni automaticamente.",
  },
  {
    icon: Lightbulb,
    number: '03',
    title: 'Analizza',
    description:
      'Ricevi insight unificati e consigli pratici basati su tutti i dati raccolti.',
  },
  {
    icon: Rocket,
    number: '04',
    title: 'Agisci',
    description:
      "Prendi decisioni informate e misura l'impatto delle tue azioni nel tempo.",
  },
];

export function HowItWorks() {
  return (
    <section id="come-funziona" className="pt-8 pb-20 md:pt-12 md:pb-28 relative">
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
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Come <span className="gradient-text">funziona</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Da zero a insight in 4 semplici passaggi. Nessuna competenza tecnica
            richiesta.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-[hsl(var(--coral))] via-[hsl(var(--amber))] to-green-500 -translate-y-1/2 z-0" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative"
              >
                {/* Step Card */}
                <div className="relative bg-[hsl(var(--card))] rounded-2xl p-6 border border-[hsl(var(--border)/0.5)] shadow-soft hover:shadow-medium transition-all z-10">
                  {/* Number Badge */}
                  <div className="absolute -top-4 left-6 px-3 py-1 rounded-full gradient-bg shadow-glow">
                    <span className="text-sm font-bold text-white">
                      {step.number}
                    </span>
                  </div>

                  <div className="pt-4">
                    <div className="w-14 h-14 rounded-xl bg-[hsl(var(--secondary))] flex items-center justify-center mb-4">
                      <step.icon className="w-7 h-7 text-[hsl(var(--coral))]" />
                    </div>
                    <h3 className="font-display text-xl font-bold mb-2">
                      {step.title}
                    </h3>
                    <p className="text-[hsl(var(--muted-foreground))]">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
