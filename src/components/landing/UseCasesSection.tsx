'use client';

import { motion } from 'framer-motion';
import { Store, Building2, Users, Briefcase, MessageSquare, TrendingUp } from 'lucide-react';

const useCases = [
  {
    icon: Store,
    category: 'B2C / Retail',
    title: 'Capire cosa pensano i clienti',
    description:
      'Un e-commerce voleva capire perché i clienti abbandonavano il carrello. Con interviste AI automatiche post-acquisto, ha scoperto che il 67% citava "tempi di consegna poco chiari".',
    result: '+23% conversioni in 3 mesi',
    color: 'coral',
  },
  {
    icon: Building2,
    category: 'B2B / Filiera',
    title: 'Ascoltare fornitori e partner',
    description:
      'Un produttore manifatturiero ha usato Business Tuner per intervistare 150 rivenditori. Ha identificato 3 problemi ricorrenti nella comunicazione che nessuno osava segnalare.',
    result: 'NPS filiera da 32 a 58',
    color: 'amber',
  },
  {
    icon: Users,
    category: 'HR / Team',
    title: 'Misurare il clima aziendale',
    description:
      'Una PMI con 80 dipendenti ha sostituito il questionario annuale con micro-interviste AI mensili. Ha intercettato segnali di burnout in un reparto prima che diventasse turnover.',
    result: '-40% turnover annuo',
    color: 'green',
  },
  {
    icon: Briefcase,
    category: 'Consulenza',
    title: 'Scalare la ricerca qualitativa',
    description:
      "Un'agenzia di marketing usava fare 10 interviste manuali a progetto. Con Business Tuner ne fa 50 in metà tempo, offrendo insight più ricchi ai clienti.",
    result: '5x clienti serviti',
    color: 'coral',
  },
];

export function UseCasesSection() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Light background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--amber)/0.03)] via-transparent to-[hsl(var(--coral)/0.03)]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] mb-6">
            <MessageSquare className="w-4 h-4 text-[hsl(var(--coral))]" />
            <span className="text-sm font-medium">Casi reali</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
            Come le PMI usano{' '}
            <span className="gradient-text">Business Tuner</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Esempi concreti di aziende che hanno trasformato feedback in decisioni migliori
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="h-full glass-card rounded-2xl p-6 transition-all hover:-translate-y-1 border border-[hsl(var(--border)/0.5)]">
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      useCase.color === 'coral'
                        ? 'bg-[hsl(var(--coral)/0.15)]'
                        : useCase.color === 'amber'
                        ? 'bg-[hsl(var(--amber)/0.15)]'
                        : 'bg-green-500/15'
                    }`}
                  >
                    <useCase.icon
                      className={`w-6 h-6 ${
                        useCase.color === 'coral'
                          ? 'text-[hsl(var(--coral))]'
                          : useCase.color === 'amber'
                          ? 'text-[hsl(var(--amber))]'
                          : 'text-green-500'
                      }`}
                    />
                  </div>
                  <div>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        useCase.color === 'coral'
                          ? 'text-[hsl(var(--coral))]'
                          : useCase.color === 'amber'
                          ? 'text-[hsl(var(--amber))]'
                          : 'text-green-500'
                      }`}
                    >
                      {useCase.category}
                    </span>
                    <h3 className="font-semibold text-lg text-[hsl(var(--foreground))]">
                      {useCase.title}
                    </h3>
                  </div>
                </div>

                <p className="text-[hsl(var(--muted-foreground))] mb-4 leading-relaxed">
                  {useCase.description}
                </p>

                <div className="flex items-center gap-2 pt-4 border-t border-[hsl(var(--border)/0.5)]">
                  <TrendingUp
                    className={`w-5 h-5 ${
                      useCase.color === 'coral'
                        ? 'text-[hsl(var(--coral))]'
                        : useCase.color === 'amber'
                        ? 'text-[hsl(var(--amber))]'
                        : 'text-green-500'
                    }`}
                  />
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    {useCase.result}
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
