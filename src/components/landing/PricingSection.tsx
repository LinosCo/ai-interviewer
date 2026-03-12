'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Star, Users, Zap } from 'lucide-react';
import Link from 'next/link';

import {
    LANDING_CREDIT_PACKS,
    LANDING_PLANS,
    PARTNER_PLAN,
    getYearlyDiscount,
} from '@/config/landingPricing';

export function PricingSection() {
    const [isYearly, setIsYearly] = useState(true);
    const [creditsOpen, setCreditsOpen] = useState(false);
    const yearlyDiscount = getYearlyDiscount();

    return (
        <section id="pricing" className="pt-8 pb-20 md:pt-12 md:pb-28 relative">
            {/* White phase overlay */}
            <div className="absolute inset-0 bg-white/87 backdrop-blur-[2px]" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-12"
                >
                    <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                        Scegli il piano giusto per la tua{' '}
                        <span className="gradient-text">organizzazione</span>
                    </h2>
                    <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-6">
                        Un abbonamento per organizzazione, utenti illimitati.
                        Prova gratuita di 14 giorni su tutti i piani a pagamento.
                    </p>

                    {/* Per-org pricing badge */}
                    <div className="flex justify-center mb-8">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[hsl(var(--coral)/0.3)] bg-[hsl(var(--coral)/0.08)] text-sm text-[hsl(var(--foreground))]">
                            <Users className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                            Un abbonamento, utenti illimitati - crea tutte le utenze che vuoi
                        </span>
                    </div>

                    {/* Billing toggle */}
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                        <span
                            className={`text-sm font-medium transition-colors ${
                                !isYearly
                                    ? 'text-[hsl(var(--foreground))]'
                                    : 'text-[hsl(var(--muted-foreground))]'
                            }`}
                        >
                            Mensile
                        </span>
                        <button
                            onClick={() => setIsYearly(!isYearly)}
                            aria-pressed={isYearly}
                            className="relative w-14 h-7 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] transition-colors"
                        >
                            <motion.div
                                className="absolute top-1 w-5 h-5 rounded-full gradient-bg shadow-md"
                                animate={{ left: isYearly ? '32px' : '4px' }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                        </button>
                        <span
                            className={`text-sm font-medium transition-colors ${
                                isYearly
                                    ? 'text-[hsl(var(--foreground))]'
                                    : 'text-[hsl(var(--muted-foreground))]'
                            }`}
                        >
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
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                className={`h-full bg-[hsl(var(--card))] rounded-2xl p-6 border shadow-soft hover:shadow-medium transition-all flex flex-col ${
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

                                <div className="flex items-baseline gap-1 mb-6 min-h-[48px]">
                                    {plan.showPrice ? (
                                        <>
                                            <span className="text-4xl font-bold">
                                                €{isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                                            </span>
                                            <span className="text-[hsl(var(--muted-foreground))]">
                                                /mese
                                            </span>
                                            {isYearly && plan.monthlyPrice !== 0 && (
                                                <span className="text-sm text-[hsl(var(--muted-foreground))] line-through ml-2">
                                                    €{plan.monthlyPrice}
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
                                    className={`block w-full text-center py-3 rounded-xl font-semibold transition-all mt-8 ${
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
                    Tutti i piani includono 14 giorni di prova gratuita, con onboarding
                    guidato per team, consulenti e agenzie.
                </motion.p>

                {/* Credit Packs — Collapsible */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="mt-12"
                >
                    <div className="max-w-4xl mx-auto">
                        <button
                            onClick={() => setCreditsOpen(!creditsOpen)}
                            className="w-full rounded-[24px] border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--card))] px-5 py-4 text-left shadow-soft transition-all hover:shadow-medium"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-[hsl(var(--amber)/0.12)] flex items-center justify-center shrink-0">
                                        <Zap className="w-5 h-5 text-[hsl(var(--amber))]" />
                                    </div>
                                    <div>
                                        <p className="font-display text-lg font-bold text-[hsl(var(--foreground))]">
                                            Hai bisogno di piu crediti?
                                        </p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                            Apri i pack extra che non scadono mai e tieni margine sui mesi ad alta attivita.
                                        </p>
                                    </div>
                                </div>
                                <motion.span
                                    animate={{ rotate: creditsOpen ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="inline-flex shrink-0 rounded-full border border-[hsl(var(--border))] p-2"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </motion.span>
                            </div>
                        </button>
                    </div>

                    <AnimatePresence initial={false}>
                        {creditsOpen && (
                            <motion.div
                                key="credit-packs"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="pt-8">
                                    <p className="text-center text-[hsl(var(--muted-foreground))] mb-6">
                                        Acquista pack extra che non scadono mai.
                                    </p>
                                    <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                        {LANDING_CREDIT_PACKS.map((pack) => (
                                            <div
                                                key={pack.id}
                                                className={`relative bg-[hsl(var(--card))] rounded-xl p-5 border transition-all hover:shadow-medium ${
                                                    pack.popular
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
                                                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
                                                    crediti
                                                </p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-bold">
                                                        €{pack.price}
                                                    </span>
                                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        (€{pack.pricePerThousand}/1K)
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Partner Banner */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-8"
                >
                    <div className="rounded-[28px] border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-white p-6 md:p-8 lg:p-10">
                        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] lg:items-center">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-glow mb-5">
                                    <Users className="w-4 h-4" />
                                    Programma Partner
                                </div>

                                <h3 className="font-display text-2xl md:text-3xl font-bold mb-4 leading-tight">
                                    Sei un&apos;agenzia o un consulente?{' '}
                                    <span className="gradient-text">Scopri il Programma Partner</span>
                                </h3>

                                <p className="text-base text-[hsl(var(--muted-foreground))] leading-relaxed max-w-2xl mb-6">
                                    Un pacchetto pensato per chi gestisce piu clienti: trial esteso, accesso gratuito al raggiungimento della soglia e white label quando il programma scala.
                                </p>

                                <div className="flex flex-wrap gap-3 mb-7">
                                    <span className="rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))]">
                                        Trial {PARTNER_PLAN.trialDays} giorni
                                    </span>
                                    <span className="rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))]">
                                        Gratis con {PARTNER_PLAN.freeThreshold}+ clienti
                                    </span>
                                    <span className="rounded-full border border-amber-200 bg-white/80 px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))]">
                                        White label con {PARTNER_PLAN.whiteLabelThreshold}+ clienti
                                    </span>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                                    <Link
                                        href="/partner"
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3 gradient-bg text-white font-semibold rounded-xl shadow-glow hover:opacity-90 transition-all"
                                    >
                                        Scopri di piu
                                        <span aria-hidden="true">&rarr;</span>
                                    </Link>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        Dashboard multi-cliente, trasferimento progetti e supporto dedicato partner.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {PARTNER_PLAN.benefits.map((benefit) => (
                                    <div
                                        key={benefit.title}
                                        className="rounded-2xl border border-amber-200/80 bg-white/80 p-4 shadow-soft"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center shrink-0 mt-0.5">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-[hsl(var(--foreground))]">
                                                    {benefit.title}
                                                </p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed mt-1">
                                                    {benefit.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
