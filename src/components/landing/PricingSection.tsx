'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Zap, Users, Crown } from 'lucide-react';
import Link from 'next/link';
import {
    LANDING_PLANS,
    LANDING_CREDIT_PACKS,
    PARTNER_PLAN,
    getYearlyDiscount
} from '@/config/landingPricing';

export function PricingSection() {
    const [isYearly, setIsYearly] = useState(false);
    const yearlyDiscount = getYearlyDiscount();

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
                                -{yearlyDiscount}%
                            </span>
                        )}
                    </div>
                </motion.div>

                {/* Plans Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {LANDING_PLANS.map((plan, index) => (
                        <motion.div
                            key={plan.id}
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
                                className={`h-full bg-[hsl(var(--card))] rounded-2xl p-6 border shadow-soft hover:shadow-medium transition-all flex flex-col ${plan.popular
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

                                <div className="flex items-baseline gap-1 mb-6 min-h-[48px]">
                                    {plan.showPrice ? (
                                        <>
                                            <span className="text-4xl font-bold">
                                                EUR{isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                                            </span>
                                            <span className="text-[hsl(var(--muted-foreground))]">/mese</span>
                                            {isYearly && plan.monthlyPrice !== 0 && (
                                                <span className="text-sm text-[hsl(var(--muted-foreground))] line-through ml-2">
                                                    EUR{plan.monthlyPrice}
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                            Su misura
                                        </span>
                                    )}
                                </div>

                                <ul className="space-y-3 flex-1">
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
                                    className={`block w-full text-center py-3 rounded-xl font-semibold transition-all mt-8 ${plan.popular
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
                    Tutti i piani includono 14 giorni di prova gratuita. Nessuna carta richiesta.
                </motion.p>

                {/* Credit Packs Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="mt-16"
                >
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-amber-700 text-sm font-medium mb-4">
                            <Zap className="w-4 h-4" />
                            Crediti Extra
                        </div>
                        <h3 className="font-display text-2xl font-bold mb-2">
                            Hai bisogno di più crediti?
                        </h3>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            Acquista pack extra che non scadono mai.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                        {LANDING_CREDIT_PACKS.map((pack) => (
                            <div
                                key={pack.id}
                                className={`relative bg-[hsl(var(--card))] rounded-xl p-5 border transition-all hover:shadow-medium ${pack.popular
                                        ? 'border-amber-300 shadow-md'
                                        : 'border-[hsl(var(--border)/0.5)]'
                                    }`}
                            >
                                {pack.popular && (
                                    <div className="absolute -top-2 right-4">
                                        <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500 text-white rounded">
                                            Popolare
                                        </span>
                                    </div>
                                )}
                                <p className="text-3xl font-bold text-[hsl(var(--foreground))] mb-1">
                                    {pack.credits}
                                </p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">crediti</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold">{pack.price}EUR</span>
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                        ({pack.pricePerMillion}EUR/M)
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Partner Teaser */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-16"
                >
                    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 rounded-2xl border border-amber-200 p-8 md:p-12">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 rounded-full text-white text-sm font-medium mb-4">
                                    <Users className="w-4 h-4" />
                                    Programma Partner
                                </div>
                                <h3 className="font-display text-2xl md:text-3xl font-bold mb-4">
                                    Sei un&apos;agenzia o un consulente?
                                </h3>
                                <p className="text-[hsl(var(--muted-foreground))] mb-6 max-w-xl">
                                    Con il programma Partner puoi gestire i tuoi clienti da un&apos;unica dashboard,
                                    trasferire progetti e guadagnare l&apos;accesso gratuito alla piattaforma.
                                </p>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="flex items-center gap-2">
                                        <Check className="w-5 h-5 text-green-500" />
                                        <span className="text-sm">Trial {PARTNER_PLAN.trialDays} giorni</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Check className="w-5 h-5 text-green-500" />
                                        <span className="text-sm">Gratis con {PARTNER_PLAN.freeThreshold}+ clienti</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Crown className="w-5 h-5 text-amber-500" />
                                        <span className="text-sm">White Label con {PARTNER_PLAN.whiteLabelThreshold}+ clienti</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Check className="w-5 h-5 text-green-500" />
                                        <span className="text-sm">Dashboard multi-cliente</span>
                                    </div>
                                </div>
                                <Link
                                    href="/partner"
                                    className="inline-flex items-center gap-2 px-6 py-3 gradient-bg text-white font-semibold rounded-xl shadow-glow hover:opacity-90 transition-all"
                                >
                                    Scopri il Programma Partner
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>
                            <div className="hidden md:block">
                                <div className="bg-white rounded-xl shadow-lg p-6 w-64">
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">A partire da</p>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-4xl font-bold">EUR0</span>
                                        <span className="text-[hsl(var(--muted-foreground))]">/mese</span>
                                    </div>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                        con {PARTNER_PLAN.freeThreshold}+ clienti attivi
                                    </p>
                                    <div className="border-t border-stone-200 mt-4 pt-4">
                                        <p className="text-xs text-stone-500">
                                            Altrimenti {PARTNER_PLAN.basePrice}EUR/mese
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
