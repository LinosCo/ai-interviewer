'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Sparkles } from 'lucide-react';

export function CTASection() {
  return (
    <section id="demo" className="pt-8 pb-20 md:pt-12 md:pb-28 relative overflow-hidden">
      {/* Light overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--coral)/0.1)] via-[hsl(var(--amber)/0.05)] to-[hsl(var(--coral)/0.1)]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--coral)/0.2)] backdrop-blur-md border border-[hsl(var(--coral)/0.3)] mb-8"
          >
            <Sparkles className="w-4 h-4 text-[hsl(var(--coral))]" />
            <span className="text-sm font-medium text-[hsl(var(--coral))]">
              Inizia oggi, risultati domani
            </span>
          </motion.div>

          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-[hsl(var(--foreground))] mb-6">
            Pronto ad ascoltare{' '}
            <span className="gradient-text">i tuoi stakeholder</span>?
          </h2>

          <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] mb-10 max-w-2xl mx-auto">
            Unisciti a centinaia di imprenditori italiani che hanno già
            trasformato il modo in cui prendono decisioni.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/preview"
              className="bg-[hsl(var(--card))] text-[hsl(var(--coral))] hover:bg-[hsl(var(--card)/0.9)] text-lg px-8 py-4 font-semibold shadow-lg hover:scale-105 transition-transform border border-[hsl(var(--border)/0.5)] rounded-xl inline-flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Testa un&apos;intervista
            </Link>
            <Link
              href="/register"
              className="gradient-bg text-white hover:opacity-90 text-lg px-8 py-4 font-semibold shadow-glow hover:scale-105 transition-transform rounded-xl inline-flex items-center justify-center gap-2"
            >
              Prova Gratis
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="mt-8 text-sm text-[hsl(var(--muted-foreground))]"
          >
            Setup in 5 minuti &nbsp;&bull;&nbsp; Nessuna carta richiesta &nbsp;&bull;&nbsp;
            Cancella quando vuoi
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
