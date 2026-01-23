'use client';

import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Users, AlertTriangle, Heart } from 'lucide-react';

const tips = [
  {
    icon: TrendingUp,
    category: 'Crescita',
    title: 'Opportunità di upselling',
    description:
      "I clienti premium menzionano spesso l'interesse per servizi aggiuntivi. Considera di proporre un pacchetto esteso.",
  },
  {
    icon: Users,
    category: 'Team',
    title: 'Clima aziendale positivo',
    description:
      "Il 78% del team ha risposto positivamente. È il momento ideale per lanciare nuove iniziative.",
  },
  {
    icon: AlertTriangle,
    category: 'Attenzione',
    title: 'Feedback ricorrente',
    description:
      '3 clienti hanno menzionato ritardi nella spedizione. Verifica con la logistica.',
  },
  {
    icon: Heart,
    category: 'Soddisfazione',
    title: 'NPS in crescita',
    description:
      'Il Net Promoter Score è salito di 12 punti. I clienti sono più propensi a raccomandare.',
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
            <span className="text-sm font-medium text-[hsl(var(--coral))]">AI-Powered</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
            Consigli pratici,{' '}
            <span className="gradient-text">non solo dati</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            L&apos;AI di Business Tuner non si limita a raccogliere informazioni. Ti
            dice cosa fare, quando agire e perché.
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
                    Generato da Business Tuner AI
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
