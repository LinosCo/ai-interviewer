'use client';

import { motion } from 'framer-motion';
import {
  Zap,
  Shield,
  Globe,
  TrendingUp,
  HeartHandshake,
  RefreshCcw,
} from 'lucide-react';

const reasons = [
  {
    icon: Zap,
    title: 'AI nel cuore',
    description:
      "Non un'integrazione posticcia, ma AI costruita nel nucleo della piattaforma.",
  },
  {
    icon: Globe,
    title: 'Pensato in italiano',
    description:
      'Comprende il contesto, la lingua e il modo di fare business delle imprese italiane.',
  },
  {
    icon: TrendingUp,
    title: 'Prezzo scalabile',
    description:
      'Funzionalità avanzate a prezzi sostenibili. Cresce con te, senza salti di costo imprevisti.',
  },
  {
    icon: Shield,
    title: 'Privacy concreta',
    description: 'Dati cifrati, server EU, gestione GDPR. I tuoi dati restano tuoi.',
  },
  {
    icon: HeartHandshake,
    title: 'Supporto di persone',
    description:
      'Team italiano sempre disponibile. Niente chatbot per il supporto, solo persone.',
  },
  {
    icon: RefreshCcw,
    title: 'Evoluzione continua',
    description:
      'Nuove funzionalità ogni mese, guidate dal feedback della community.',
  },
];

export function WhySection() {
  return (
    <section className="pt-8 pb-24 md:pt-12 md:pb-32 relative overflow-hidden">
      {/* Colored phase overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--amber)/0.04)] via-transparent to-[hsl(var(--coral)/0.05)]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
            Perché{' '}
            <span className="gradient-text">Business Tuner</span>?
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Non siamo l&apos;ennesimo tool americano tradotto. Siamo nati per le
            imprese italiane.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((reason, index) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="h-full glass-card rounded-2xl p-6 transition-all hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--coral)/0.15)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <reason.icon className="w-6 h-6 text-[hsl(var(--coral))]" />
                </div>
                <h3 className="font-semibold text-lg mb-2 text-[hsl(var(--foreground))]">{reason.title}</h3>
                <p className="text-[hsl(var(--muted-foreground))]">{reason.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
