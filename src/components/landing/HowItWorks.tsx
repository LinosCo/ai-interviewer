'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Lightbulb, Rocket, LineChart } from 'lucide-react';

const steps = [
  {
    icon: Database,
    number: '01',
    title: 'Ascolta',
    description:
      'Interviste AI, chatbot e monitoraggio continuo raccolgono segnali da clienti, team e mercato.',
  },
  {
    icon: Lightbulb,
    number: '02',
    title: 'Decidi',
    description:
      'Il copilot strategico unifica i dati e propone priorita, azioni e playbook operativi.',
  },
  {
    icon: Rocket,
    number: '03',
    title: 'Esegui',
    description:
      'Attiva automazioni e handoff verso i tuoi tool, per passare dagli insight alle azioni.',
  },
  {
    icon: LineChart,
    number: '04',
    title: 'Monitora',
    description:
      "Misura impatto e iterazioni nel tempo, con KPI chiari per migliorare il funnel in modo continuo.",
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-funnel-step]'));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;

        const nextIndex = Number(visible[0].target.getAttribute('data-funnel-step'));
        if (!Number.isNaN(nextIndex)) setActiveStep(nextIndex);
      },
      {
        threshold: [0.4, 0.6, 0.8],
        rootMargin: '-20% 0px -35% 0px',
      }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

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
            Da zero a decisioni operative in 4 passaggi: ascolta, decidi, esegui, monitora.
          </p>
        </motion.div>

        <div className="relative lg:grid lg:grid-cols-[76px_minmax(0,1fr)] lg:gap-8">
          <div className="hidden lg:flex sticky top-28 h-[70vh] items-start justify-center">
            <div className="flex flex-col gap-3">
              {steps.map((step, index) => (
                <div
                  key={`rail-${step.title}`}
                  className={`rounded-full border px-2 py-4 [writing-mode:vertical-rl] text-xs font-semibold tracking-[0.16em] transition-colors ${
                    activeStep === index
                      ? 'border-[hsl(var(--coral)/0.4)] bg-[hsl(var(--coral)/0.1)] text-[hsl(var(--coral))]'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--card)/0.8)] text-[hsl(var(--muted-foreground))]'
                  }`}
                >
                  {step.number} {step.title}
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                data-funnel-step={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative h-full"
              >
                <div className="relative bg-[hsl(var(--card))] rounded-2xl p-6 border border-[hsl(var(--border)/0.5)] shadow-soft hover:shadow-medium transition-all z-10 h-full min-h-[260px] flex flex-col">
                  <div className="absolute -top-4 left-6 px-3 py-1 rounded-full gradient-bg shadow-glow">
                    <span className="text-sm font-bold text-white">{step.number}</span>
                  </div>

                  <div className="pt-4 flex h-full flex-col">
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
      </div>
    </section>
  );
}
