'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  Users,
} from 'lucide-react';

interface TargetCard {
  icon: typeof Briefcase;
  tagline: string;
  description: string;
  benefits: string[];
  cta: { label: string; href: string };
}

const targets: TargetCard[] = [
  {
    icon: Briefcase,
    tagline: 'Consulenti e professionisti',
    description:
      'BT libera il consulente dai dettagli operativi e gli offre dati strutturati e affidabili su cui costruire la strategia.',
    benefits: [
      'Conduci 50 interviste dove prima ne facevi 10',
      'Offri ai clienti insight basati su dati reali, non opinioni',
      'Il Copilot ti aiuta a vedere pattern e proporre azioni',
      'Concentrati sulle scelte strategiche, BT gestisce il resto',
    ],
    cta: { label: 'Scopri come', href: '#strumenti' },
  },
  {
    icon: Building2,
    tagline: 'PMI e team interni',
    description:
      'Anche senza un team dedicato, BT ti d\u00e0 un processo strutturato per ascoltare, decidere e agire con costanza.',
    benefits: [
      'Raccogli feedback da clienti, dipendenti e stakeholder',
      'Prendi decisioni basate su dati qualitativi reali',
      'Automatizza le azioni ricorrenti senza perdere segnali',
      'Forma il team con percorsi certificati',
    ],
    cta: { label: 'Scopri come', href: '#strumenti' },
  },
  {
    icon: Users,
    tagline: 'Agenzie',
    description:
      'Standardizza la qualit\u00e0 della ricerca e dell\u2019esecuzione su tutti i clienti, senza moltiplicare gli strumenti.',
    benefits: [
      'Dashboard multi-cliente con il programma Partner',
      'Report personalizzati per ogni cliente',
      'White label con 10+ clienti attivi',
    ],
    cta: { label: 'Programma Partner', href: '/partner' },
  },
];

const subtitles: Record<string, string> = {
  'Consulenti e professionisti': 'Pi\u00f9 strategia, meno operativit\u00e0',
  'PMI e team interni': 'Il tuo ciclo strategico, sempre attivo',
  'Agenzie': "Un'unica piattaforma per tutti i tuoi clienti",
};

export function TargetSection() {
  return (
    <section
      id="per-chi"
      className="py-20 md:py-28 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--amber)/0.04)] via-transparent to-[hsl(var(--coral)/0.05)]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))] max-w-4xl mx-auto">
            Pensato per chi vuole un processo che lo assista{' '}
            <span className="gradient-text">davvero</span>, non un altro
            tool da gestire
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {targets.map(function (target, index) {
            const Icon = target.icon;

            return (
              <motion.div
                key={target.tagline}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="group"
              >
                <div className="h-full flex flex-col bg-[hsl(var(--card))] rounded-2xl p-8 border border-[hsl(var(--border)/0.5)] shadow-soft hover:shadow-medium transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--coral)/0.1)] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7 text-[hsl(var(--coral))]" />
                  </div>

                  <h3 className="font-display text-xl font-bold text-[hsl(var(--foreground))] mb-1">
                    {target.tagline}
                  </h3>

                  <p className="text-sm font-semibold text-[hsl(var(--coral))] mb-3">
                    {subtitles[target.tagline]}
                  </p>

                  <p className="text-[hsl(var(--muted-foreground))] leading-relaxed mb-6">
                    {target.description}
                  </p>

                  <ul className="space-y-3 mb-8 flex-1">
                    {target.benefits.map(function (benefit) {
                      return (
                        <li key={benefit} className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full gradient-bg flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </span>
                          <span className="text-sm text-[hsl(var(--foreground))]">
                            {benefit}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    href={target.cta.href}
                    className="inline-flex items-center gap-1.5 text-[hsl(var(--coral))] font-semibold hover:underline transition-colors mt-auto"
                  >
                    {target.cta.label}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
