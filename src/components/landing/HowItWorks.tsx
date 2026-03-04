'use client';

import { motion } from 'framer-motion';
import { Database, Lightbulb, Rocket, LineChart, CornerUpRight } from 'lucide-react';

const steps = [
  {
    icon: Database,
    number: '01',
    title: 'Ascolta',
    column: 'left',
    placement: 'lg:col-start-1 lg:row-start-1',
    description:
      "L'ascolto diventa un processo integrato: raccogli segnali continui da clienti, stakeholder, mercato e competitor.",
  },
  {
    icon: Lightbulb,
    number: '02',
    title: 'Decidi',
    column: 'right',
    placement: 'lg:col-start-2 lg:row-start-1',
    description:
      "Il Copilot incrocia i dati con la strategia di business e costruisce una visione di insieme orientata all'azione.",
  },
  {
    icon: Rocket,
    number: '03',
    title: 'Esegui',
    column: 'right',
    placement: 'lg:col-start-2 lg:row-start-2',
    description:
      'Attiva automazioni e handoff verso i tuoi tool, per passare dagli insight alle azioni.',
  },
  {
    icon: LineChart,
    number: '04',
    title: 'Monitora',
    column: 'left',
    placement: 'lg:col-start-1 lg:row-start-2',
    description:
      'Misura impatto, consolida apprendimento e attiva formazione con certificazione per team e stakeholder.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="come-funziona" className="pt-8 pb-20 md:pt-12 md:pb-28 relative">
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

        <div className="relative hidden lg:block">
          <svg
            viewBox="0 0 1000 640"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none z-30"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="cycle-arrowhead"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M0,0 L7,3.5 L0,7 z" fill="hsl(var(--coral))" />
              </marker>
            </defs>

            <path
              d="M430 160 C 470 118, 530 118, 570 160"
              fill="none"
              stroke="hsl(var(--coral) / 0.82)"
              strokeWidth="2.3"
              strokeLinecap="round"
              markerEnd="url(#cycle-arrowhead)"
            />
            <path
              d="M570 224 C 620 282, 620 348, 570 406"
              fill="none"
              stroke="hsl(var(--coral) / 0.82)"
              strokeWidth="2.3"
              strokeLinecap="round"
              markerEnd="url(#cycle-arrowhead)"
            />
            <path
              d="M570 470 C 530 512, 470 512, 430 470"
              fill="none"
              stroke="hsl(var(--coral) / 0.82)"
              strokeWidth="2.3"
              strokeLinecap="round"
              markerEnd="url(#cycle-arrowhead)"
            />
            <path
              d="M430 406 C 380 348, 380 282, 430 224"
              fill="none"
              stroke="hsl(var(--coral) / 0.82)"
              strokeWidth="2.3"
              strokeLinecap="round"
              markerEnd="url(#cycle-arrowhead)"
            />
          </svg>

          <div className="grid lg:grid-cols-2 gap-8 relative z-10">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className={`relative ${step.placement}`}
              >
                <div className="relative h-full min-h-[300px] rounded-[26px] border border-[hsl(var(--border)/0.62)] bg-[hsl(var(--card)/0.94)] p-7 xl:p-8 shadow-soft hover:shadow-medium transition-shadow">
                  <div className={`absolute -top-4 ${step.column === 'left' ? 'left-7' : 'right-7'} px-3 py-1 rounded-full gradient-bg shadow-glow`}>
                    <span className="text-sm font-bold text-white">{step.number}</span>
                  </div>

                  <div className={`h-full ${step.column === 'left' ? 'pr-20' : 'pl-20'}`}>
                    <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border)/0.55)] flex items-center justify-center mb-5">
                      <step.icon className="w-6 h-6 text-[hsl(var(--coral))]" />
                    </div>
                    <h3 className="font-display text-[2rem] xl:text-[2.2rem] leading-[1.04] font-bold mb-4">
                      {step.title}
                    </h3>
                    <p className="text-lg xl:text-[1.35rem] leading-relaxed text-[hsl(var(--muted-foreground))] max-w-[36ch]">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="lg:hidden relative">
          <div className="absolute left-4 top-8 bottom-20 w-px bg-gradient-to-b from-[hsl(var(--coral)/0.45)] via-[hsl(var(--coral)/0.25)] to-[hsl(var(--coral)/0.45)]" />

          <div className="space-y-3">
            {steps.map((step, index) => (
              <motion.div
                key={`mobile-${step.title}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="relative pl-11"
              >
                <div className="absolute left-2.5 top-8 w-3 h-3 rounded-full bg-[hsl(var(--coral))] shadow-[0_0_0_4px_hsl(var(--coral)/0.12)]" />

                <div className="bg-[hsl(var(--card)/0.96)] rounded-2xl p-5 border border-[hsl(var(--border)/0.6)] shadow-soft">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] mb-4">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] font-semibold">
                      Fase
                    </span>
                    <span className="text-sm font-bold text-[hsl(var(--coral))]">{step.number}</span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border)/0.55)] flex items-center justify-center">
                      <step.icon className="w-5 h-5 text-[hsl(var(--coral))]" />
                    </div>
                    <h3 className="font-display text-3xl leading-tight font-bold">{step.title}</h3>
                  </div>

                  <p className="text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {step.description}
                  </p>
                </div>

                {index < steps.length - 1 ? (
                  <div className="flex justify-center py-1.5">
                    <CornerUpRight className="w-7 h-7 rotate-90 text-[hsl(var(--coral))]" strokeWidth={2} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <CornerUpRight className="w-5 h-5 -rotate-90 text-[hsl(var(--coral))]" strokeWidth={2} />
                    <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                      Il ciclo riparte da Ascolta
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
