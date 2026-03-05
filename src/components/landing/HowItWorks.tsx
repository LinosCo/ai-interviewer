'use client';

import { motion } from 'framer-motion';
import { CycleSlider } from './CycleSlider';

export function HowItWorks(): React.JSX.Element {
  return (
    <section id="come-funziona" className="pt-8 pb-20 md:pt-12 md:pb-28 relative">
      <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Un ciclo, mille applicazioni.{' '}
            <span className="gradient-text">Ecco come funziona.</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Ascolta, decidi, esegui e monitora: ogni fase alimenta la successiva in un
            processo operativo che non si interrompe.
          </p>
        </motion.div>

        <CycleSlider />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-center text-base md:text-lg text-[hsl(var(--muted-foreground))] mt-10 max-w-xl mx-auto"
        >
          Ogni scenario, stesso ciclo.{' '}
          <span className="font-semibold text-[hsl(var(--foreground))]">
            Business Tuner si adatta al tuo contesto.
          </span>
        </motion.p>
      </div>
    </section>
  );
}
