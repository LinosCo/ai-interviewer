'use client';

import { motion } from 'framer-motion';
import {
  Database,
  Lightbulb,
  Rocket,
  LineChart,
  CornerRightDown,
  CornerDownLeft,
  CornerLeftUp,
  CornerUpRight,
} from 'lucide-react';

const steps = [
  {
    icon: Database,
    cycleIcon: CornerRightDown,
    arrowSide: 'right',
    number: '01',
    title: 'Ascolta',
    description:
      "L'ascolto diventa un processo integrato: raccogli segnali continui da clienti, stakeholder, mercato e competitor.",
  },
  {
    icon: Lightbulb,
    cycleIcon: CornerDownLeft,
    arrowSide: 'left',
    number: '02',
    title: 'Decidi',
    description:
      "Il Copilot incrocia i dati con la strategia di business e costruisce una visione di insieme orientata all'azione.",
  },
  {
    icon: Rocket,
    cycleIcon: CornerUpRight,
    arrowSide: 'right',
    number: '03',
    title: 'Esegui',
    description:
      'Attiva automazioni e handoff verso i tuoi tool, per passare dagli insight alle azioni.',
  },
  {
    icon: LineChart,
    cycleIcon: CornerLeftUp,
    arrowSide: 'left',
    number: '04',
    title: 'Monitora',
    description:
      'Misura impatto, consolida apprendimento e attiva formazione con certificazione per team e stakeholder.',
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
            Il ciclo strategico di <span className="gradient-text">miglioramento continuo</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Ascolta, decidi, esegui e monitora: ogni fase alimenta la successiva in
            un processo operativo che non si interrompe.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative h-full"
            >
              {step.arrowSide === 'right' ? (
                <step.cycleIcon className="hidden lg:block absolute top-1/2 right-6 -translate-y-1/2 w-16 h-16 xl:w-20 xl:h-20 text-[hsl(var(--coral))] z-20 pointer-events-none" strokeWidth={2.2} />
              ) : (
                <step.cycleIcon className="hidden lg:block absolute top-1/2 left-6 -translate-y-1/2 w-16 h-16 xl:w-20 xl:h-20 text-[hsl(var(--coral))] z-20 pointer-events-none" strokeWidth={2.2} />
              )}

              <div className="relative bg-[hsl(var(--card))] rounded-2xl p-6 border border-[hsl(var(--border)/0.5)] shadow-soft hover:shadow-medium transition-all z-10 h-full min-h-[260px] flex flex-col">
                <div
                  className={`absolute -top-4 ${step.arrowSide === 'left' ? 'right-6' : 'left-6'} px-3 py-1 rounded-full gradient-bg shadow-glow`}
                >
                  <span className="text-sm font-bold text-white">{step.number}</span>
                </div>

                <div
                  className={`pt-4 flex h-full flex-col ${
                    step.arrowSide === 'left'
                      ? 'items-start text-left lg:items-end lg:text-right lg:pl-24'
                      : 'items-start text-left lg:pr-24'
                  }`}
                >
                  <div className="w-14 h-14 rounded-xl bg-[hsl(var(--secondary))] flex items-center justify-center mb-4">
                    <step.icon className="w-7 h-7 text-[hsl(var(--coral))]" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">{step.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
