'use client';

import { motion } from 'framer-motion';
import {
  Database,
  Lightbulb,
  Rocket,
  LineChart,
  CornerUpRight,
} from 'lucide-react';

const steps = [
  {
    icon: Database,
    arrowSide: 'right',
    arrowRotate: 'rotate-0',
    number: '01',
    title: 'Ascolta',
    description:
      "L'ascolto diventa un processo integrato: raccogli segnali continui da clienti, stakeholder, mercato e competitor.",
  },
  {
    icon: Lightbulb,
    arrowSide: 'left',
    arrowRotate: 'rotate-90',
    number: '02',
    title: 'Decidi',
    description:
      "Il Copilot incrocia i dati con la strategia di business e costruisce una visione di insieme orientata all'azione.",
  },
  {
    icon: Rocket,
    arrowSide: 'left',
    arrowRotate: 'rotate-180',
    placementClass: 'lg:col-start-2 lg:row-start-2',
    number: '03',
    title: 'Esegui',
    description:
      'Attiva automazioni e handoff verso i tuoi tool, per passare dagli insight alle azioni.',
  },
  {
    icon: LineChart,
    arrowSide: 'right',
    arrowRotate: '-rotate-90',
    placementClass: 'lg:col-start-1 lg:row-start-2',
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

        <div className="hidden lg:grid lg:grid-cols-2 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative h-full ${step.placementClass ?? ''}`}
            >
              <CornerUpRight
                className={`absolute top-1/2 -translate-y-1/2 w-20 h-20 xl:w-24 xl:h-24 text-[hsl(var(--coral))] z-20 pointer-events-none ${
                  step.arrowSide === 'left' ? 'left-8 xl:left-10' : 'right-8 xl:right-10'
                } ${step.arrowRotate}`}
                strokeWidth={2.3}
              />

              <div className="relative bg-[hsl(var(--card)/0.92)] rounded-[28px] p-7 xl:p-8 border border-[hsl(var(--border)/0.55)] shadow-soft hover:shadow-medium transition-all z-10 h-full min-h-[290px]">
                <div
                  className={`h-full flex ${
                    step.arrowSide === 'left'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`w-full max-w-[68%] ${
                      step.arrowSide === 'left' ? 'pl-6' : 'pr-6'
                    }`}
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] mb-5">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] font-semibold">
                        Fase
                      </span>
                      <span className="text-sm font-bold text-[hsl(var(--coral))]">{step.number}</span>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--secondary))] flex items-center justify-center">
                        <step.icon className="w-6 h-6 text-[hsl(var(--coral))]" />
                      </div>
                      <h3 className="font-display text-[2rem] leading-[1.05] font-bold">
                        {step.title}
                      </h3>
                    </div>

                    <p className="text-lg xl:text-xl text-[hsl(var(--muted-foreground))] leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="lg:hidden space-y-3">
          {steps.map((step, index) => (
            <motion.div
              key={`mobile-${step.title}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
            >
              <div className="bg-[hsl(var(--card)/0.94)] rounded-2xl p-5 border border-[hsl(var(--border)/0.55)] shadow-soft">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] mb-4">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] font-semibold">
                    Fase
                  </span>
                  <span className="text-sm font-bold text-[hsl(var(--coral))]">{step.number}</span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(var(--secondary))] flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-[hsl(var(--coral))]" />
                  </div>
                  <h3 className="font-display text-3xl font-bold leading-tight">{step.title}</h3>
                </div>

                <p className="text-base text-[hsl(var(--muted-foreground))] leading-relaxed">
                  {step.description}
                </p>
              </div>

              {index < steps.length - 1 ? (
                <div className="flex justify-center py-1.5">
                  <CornerUpRight className="w-8 h-8 text-[hsl(var(--coral))] rotate-90" strokeWidth={2.3} />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2">
                  <CornerUpRight className="w-5 h-5 text-[hsl(var(--coral))] -rotate-90" strokeWidth={2.3} />
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    Il ciclo riparte da Ascolta
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
