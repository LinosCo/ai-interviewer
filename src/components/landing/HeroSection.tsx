'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ArrowRight, Building2, ShoppingCart, Users } from 'lucide-react';

const HERO_PHRASES = [
  'cosa pensano i clienti?',
  'se il team è motivato?',
  'come parlano di te online?',
  'dove ottimizzare il budget?',
  "se l'assistenza funziona?",
  'come ti vede la filiera?',
  'perché i clienti comprano?',
  'cosa cercano i talenti?',
  'come migliorare il prodotto?',
  'se i prezzi sono giusti?',
  'cosa fanno i competitor?',
  'come comunicare meglio?',
  'come migliorare il servizio?',
];

export function HeroSection() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhraseIndex((prev) => (prev + 1) % HERO_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const TrustBadges = () => (
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
        Nessuna carta richiesta
      </span>
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4 text-[hsl(var(--coral))]" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Cancella quando vuoi
      </span>
    </div>
  );

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
            {/* Animated Headline */}
            <h1 className="font-display text-[2rem] md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.2] md:leading-[1.1] mb-4 md:mb-8">
              <span className="text-[hsl(var(--foreground))]">Ti piacerebbe sapere</span>
              <br />
              <span className="relative h-[2.5em] md:h-[1.2em] block mt-2 md:mt-4">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentPhraseIndex}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -30, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="absolute inset-x-0 gradient-text font-display"
                  >
                    {HERO_PHRASES[currentPhraseIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-xl text-[hsl(var(--muted-foreground))] mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed px-2 md:px-0">
              La piattaforma di marketing e business intelligence che ascolta mercato,
              dipendenti e filiera. Raccoglie feedback, identifica problemi e ti guida
              verso decisioni migliori.
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
                Guarda Demo
              </Link>
            </div>

            {/* Use case badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap justify-center gap-3 mt-8"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.5)] text-[hsl(var(--muted-foreground))] text-sm font-medium">
                <Building2 className="w-4 h-4" />
                B2B
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.5)] text-[hsl(var(--muted-foreground))] text-sm font-medium">
                <ShoppingCart className="w-4 h-4" />
                B2C
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--card))] border border-[hsl(var(--border)/0.5)] text-[hsl(var(--muted-foreground))] text-sm font-medium">
                <Users className="w-4 h-4" />
                HR
              </div>
            </motion.div>

            {/* Trust badges - hidden on mobile, shown on desktop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="hidden md:block mt-16"
            >
              <TrustBadges />
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
        <TrustBadges />
      </motion.div>
    </>
  );
}
