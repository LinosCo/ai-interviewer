'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Play, ArrowRight } from 'lucide-react';

function TrustBadgesView() {
  return (
    <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-[hsl(var(--muted-foreground))] text-sm">
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4 text-[hsl(var(--coral))]" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Setup in 5 minuti
      </span>
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4 text-[hsl(var(--coral))]" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Progettato per PMI, consulenti e agenzie
      </span>
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4 text-[hsl(var(--coral))]" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Supporto strategico continuo
      </span>
    </div>
  );
}

export function HeroSection() {
  return (
    <>
      <section className="relative min-h-[100svh] md:min-h-[92vh] flex items-center pt-24 md:pt-32 pb-8 md:pb-12 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-5xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] mb-6">
              <span className="text-sm font-medium">AI Marketing Intelligence</span>
            </div>

            <h1 className="font-display text-[2rem] md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.2] md:leading-[1.1] mb-4 md:mb-8 text-[hsl(var(--foreground))]">
              L&apos;AI per ascoltare, definire e automatizzare
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-xl text-[hsl(var(--muted-foreground))] mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed px-2 md:px-0">
              Business Tuner unisce ascolto continuo, dati e strategia per guidare e
              automatizzare azioni concrete, tracciabili e misurabili.
            </p>

            <p className="text-sm md:text-base text-[hsl(var(--muted-foreground))] mb-8 md:mb-10 font-medium">
              Progettato per PMI, consulenti e agenzie.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="gradient-bg text-white hover:opacity-90 shadow-lg text-lg px-10 py-4 font-semibold hover:scale-105 transition-transform rounded-xl inline-flex items-center justify-center gap-2"
              >
                Prova Gratis
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/preview"
                className="bg-[hsl(var(--foreground))] text-[hsl(var(--background))] hover:opacity-90 text-lg px-10 py-4 font-semibold shadow-lg hover:scale-105 transition-transform rounded-xl inline-flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Testa un&apos;intervista
              </Link>
            </div>

            {/* Trust badges - hidden on mobile, shown on desktop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="hidden md:block mt-16"
            >
              <TrustBadgesView />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Trust badges - mobile only, below the fold */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="md:hidden py-8 px-6"
      >
        <TrustBadgesView />
      </motion.div>
    </>
  );
}
