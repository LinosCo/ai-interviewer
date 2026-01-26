'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Free',
    description: 'Per sempre gratuito',
    monthlyPrice: '0',
    yearlyPrice: '0',
    features: [
      '500K crediti/mese',
      '1 progetto',
      'Interview AI base',
      'Analytics base',
      'Export PDF (watermark)',
    ],
    cta: 'Inizia Gratis',
    ctaHref: '/register',
    popular: false,
  },
  {
    name: 'Starter',
    description: 'Per iniziare',
    monthlyPrice: '69',
    yearlyPrice: '49',
    features: [
      '6M crediti/mese',
      'Interview AI completo',
      'Chatbot illimitati',
      'Progetti illimitati',
      'Analytics completi',
      'Export PDF/CSV',
    ],
    cta: 'Inizia 14 giorni gratis',
    ctaHref: '/register?plan=starter',
    popular: false,
  },
  {
    name: 'Pro',
    description: 'Per professionisti',
    monthlyPrice: '199',
    yearlyPrice: '149',
    features: [
      '20M crediti/mese',
      'Brand Monitor',
      'AI Tips',
      'Copilot Strategico',
      'Tutto Starter incluso',
      'Supporto prioritario',
    ],
    cta: 'Inizia 14 giorni gratis',
    ctaHref: '/register?plan=pro',
    popular: true,
  },
  {
    name: 'Business',
    description: 'Per aziende',
    monthlyPrice: '399',
    yearlyPrice: '299',
    features: [
      '50M crediti/mese',
      'Tutto Pro incluso',
      'White Label',
      'API Access',
      'CMS Integrations',
      'Utenti illimitati',
      'Account manager dedicato',
    ],
    cta: 'Contattaci',
    ctaHref: '/sales',
    popular: false,
  },
];

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="pt-8 pb-20 md:pt-12 md:pb-28 relative">
      {/* White overlay */}
      <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Prezzi <span className="gradient-text">semplici e trasparenti</span>
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-8">
            Nessun costo nascosto. Inizia gratis, scala quando cresci.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
              Mensile
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-14 h-7 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] transition-colors"
            >
              <motion.div
                className="absolute top-1 w-5 h-5 rounded-full gradient-bg shadow-md"
                animate={{ left: isYearly ? '32px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
              Annuale
            </span>
            {isYearly && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full gradient-bg text-white">
                -25%
              </span>
            )}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative ${plan.popular ? 'lg:-mt-4 lg:mb-4' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full gradient-bg shadow-glow">
                    <Star className="w-3 h-3 text-white fill-white" />
                    <span className="text-xs font-semibold text-white">
                      Più popolare
                    </span>
                  </div>
                </div>
              )}

              <div
                className={`h-full bg-[hsl(var(--card))] rounded-2xl p-6 border shadow-soft hover:shadow-medium transition-all ${
                  plan.popular
                    ? 'border-[hsl(var(--coral))] shadow-glow'
                    : 'border-[hsl(var(--border)/0.5)]'
                }`}
              >
                <div className="mb-6">
                  <h3 className="font-display text-xl font-bold mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {plan.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">
                    €{isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-[hsl(var(--muted-foreground))]">/mese</span>
                  {isYearly && plan.monthlyPrice !== '0' && (
                    <span className="text-sm text-[hsl(var(--muted-foreground))] line-through ml-2">
                      €{plan.monthlyPrice}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  className={`block w-full text-center py-3 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'gradient-bg shadow-glow text-white hover:opacity-90'
                      : 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary)/0.8)]'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-[hsl(var(--muted-foreground))] mt-8"
        >
          Tutti i piani includono 14 giorni di prova gratuita. Nessuna carta
          richiesta.
        </motion.p>
      </div>
    </section>
  );
}
