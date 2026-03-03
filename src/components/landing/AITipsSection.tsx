'use client';

import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Users, AlertTriangle, Heart } from 'lucide-react';

const tips = [
  {
    icon: TrendingUp,
    category: 'Priorita Revenue',
    title: 'Opportunita di upselling in clienti ad alta intenzione',
    description:
      "Il Copilot rileva richieste ricorrenti su servizi premium e propone il playbook: offerta, timing, segmento e messaggio.",
  },
  {
    icon: Users,
    category: 'Adozione Team',
    title: 'Gap operativo tra vendite e delivery',
    description:
      "Dalle interviste emergono attriti di handover. Viene suggerito un piano di allineamento con ownership e KPI.",
  },
  {
    icon: AlertTriangle,
    category: 'Rischio Cliente',
    title: 'Feedback negativo ricorrente in post-vendita',
    description:
      'I segnali del chatbot evidenziano un pattern: ritardi percepiti. Il Copilot priorizza azioni su comunicazione e processo.',
  },
  {
    icon: Heart,
    category: 'Visibilita',
    title: 'Brand citato poco nelle risposte AI',
    description:
      'Il monitoraggio brand evidenzia competitor piu presenti. Il Copilot suggerisce contenuti e FAQ per recuperare copertura.',
  },
];

export function AITipsSection() {
  return (
    <section className="pt-8 pb-24 md:pt-12 md:pb-32 relative overflow-hidden">
      {/* Light overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--coral)/0.05)] via-transparent to-[hsl(var(--amber)/0.05)]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--coral)/0.2)] border border-[hsl(var(--coral)/0.3)] mb-6">
            <Sparkles className="w-4 h-4 text-[hsl(var(--coral))]" />
            <span className="text-sm font-medium text-[hsl(var(--coral))]">Copilot Strategico</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
            Ti dice cosa fare,{' '}
            <span className="gradient-text">in quale ordine e perche</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Non solo insight: raccomandazioni operative basate sui tuoi segnali reali,
            con priorita, contesto e prossimi passi per il team.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {tips.map((tip, index) => (
            <motion.div
              key={tip.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-[hsl(var(--coral)/0.1)] rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative glass-card rounded-2xl p-6 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--coral)/0.15)] flex items-center justify-center flex-shrink-0">
                    <tip.icon className="w-6 h-6 text-[hsl(var(--coral))]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--coral)/0.15)] text-[hsl(var(--coral))]">
                        {tip.category}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-[hsl(var(--foreground))]">{tip.title}</h3>
                    <p className="text-[hsl(var(--muted-foreground))]">{tip.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[hsl(var(--border)/0.5)]">
                  <Sparkles className="w-4 h-4 text-[hsl(var(--coral)/0.6)]" />
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Proposta dal Copilot, verificabile dal team
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
