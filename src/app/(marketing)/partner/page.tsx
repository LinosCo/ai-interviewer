'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Users,
    Crown,
    Zap,
    ArrowRight,
    Check,
    Clock,
    Gift,
    Building2,
    BarChart3,
    Send,
    Shield
} from 'lucide-react';
import { PARTNER_PLAN } from '@/config/landingPricing';
import { FluidBackground } from '@/components/landing/FluidBackground';

export default function PartnerPage() {
    return (
        <main className="relative min-h-screen overflow-x-hidden">
            <FluidBackground />

            {/* Hero Section */}
            <section className="relative pt-24 pb-16 md:pt-32 md:pb-24">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center max-w-4xl mx-auto"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 rounded-full text-white text-sm font-medium mb-6">
                            <Users className="w-4 h-4" />
                            Programma Partner
                        </div>
                        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                            Fai crescere la tua agenzia con{' '}
                            <span className="gradient-text">Business Tuner</span>
                        </h1>
                        <p className="text-xl text-[hsl(var(--muted-foreground))] mb-8 max-w-2xl mx-auto">
                            Offri ai tuoi clienti strumenti AI avanzati per la ricerca di mercato e il marketing strategico.
                            Guadagna l&apos;accesso gratuito costruendo il tuo portafoglio.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/register?plan=partner"
                                className="inline-flex items-center gap-2 px-8 py-4 gradient-bg text-white font-bold rounded-xl shadow-glow hover:opacity-90 transition-all"
                            >
                                Inizia il Trial Gratuito
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                            <Link
                                href="#come-funziona"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-white border border-stone-200 text-stone-700 font-semibold rounded-xl hover:bg-stone-50 transition-all"
                            >
                                Come Funziona
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Transition: Hero → Key Benefits (white) */}
            <div className="h-24 section-fade-from-transparent" />

            {/* Key Benefits */}
            <section className="py-16 md:py-24 relative">
                <div className="absolute inset-0 bg-white/90" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid md:grid-cols-3 gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-200"
                        >
                            <div className="w-14 h-14 bg-amber-500 rounded-xl flex items-center justify-center mb-6">
                                <Clock className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-display text-2xl font-bold mb-3">
                                {PARTNER_PLAN.trialDays} Giorni di Trial
                            </h3>
                            <p className="text-[hsl(var(--muted-foreground))]">
                                Prova gratuita estesa per costruire il tuo portafoglio clienti senza pressioni.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-200"
                        >
                            <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mb-6">
                                <Gift className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-display text-2xl font-bold mb-3">
                                Gratis con {PARTNER_PLAN.freeThreshold}+ Clienti
                            </h3>
                            <p className="text-[hsl(var(--muted-foreground))]">
                                Raggiungi {PARTNER_PLAN.freeThreshold} clienti attivi e non paghi mai più. Zero fee mensili.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-8 border border-purple-200"
                        >
                            <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center mb-6">
                                <Crown className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-display text-2xl font-bold mb-3">
                                White Label con {PARTNER_PLAN.whiteLabelThreshold}+ Clienti
                            </h3>
                            <p className="text-[hsl(var(--muted-foreground))]">
                                Personalizza la piattaforma con il tuo brand e logo per un&apos;esperienza premium.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Transition: Key Benefits (white) → How it Works (transparent) */}
            <div className="h-24 section-fade-to-transparent" />

            {/* How it Works */}
            <section id="come-funziona" className="py-16 md:py-24 relative">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                            Come <span className="gradient-text">Funziona</span>
                        </h2>
                        <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
                            In 4 semplici step diventi partner e inizi a gestire i tuoi clienti.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            {
                                step: 1,
                                icon: Users,
                                title: 'Registrati come Partner',
                                description: 'Inizia il trial di 60 giorni gratuito con tutte le funzionalità PRO.'
                            },
                            {
                                step: 2,
                                icon: Building2,
                                title: 'Crea Progetti Template',
                                description: 'Configura progetti base che puoi duplicare per i tuoi clienti.'
                            },
                            {
                                step: 3,
                                icon: Send,
                                title: 'Trasferisci ai Clienti',
                                description: 'Invia inviti via email per trasferire progetti configurati.'
                            },
                            {
                                step: 4,
                                icon: BarChart3,
                                title: 'Monitora dalla Dashboard',
                                description: 'Gestisci tutti i clienti da un\'unica interfaccia centralizzata.'
                            }
                        ].map((item, index) => (
                            <motion.div
                                key={item.step}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="relative"
                            >
                                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-soft h-full">
                                    <div className="absolute -top-4 left-6">
                                        <span className="w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                            {item.step}
                                        </span>
                                    </div>
                                    <div className="w-12 h-12 bg-stone-100 rounded-lg flex items-center justify-center mb-4 mt-2">
                                        <item.icon className="w-6 h-6 text-stone-600" />
                                    </div>
                                    <h3 className="font-display text-lg font-bold mb-2">{item.title}</h3>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{item.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Transition: How it Works (transparent) → Features List (white) */}
            <div className="h-24 section-fade-from-transparent" />

            {/* Features List */}
            <section className="py-16 md:py-24 relative">
                <div className="absolute inset-0 bg-white/90" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">
                                Tutto ciò che ti serve per <span className="gradient-text">crescere</span>
                            </h2>
                            <p className="text-lg text-[hsl(var(--muted-foreground))] mb-8">
                                Il piano Partner include tutte le funzionalità PRO più strumenti esclusivi
                                per la gestione multi-cliente.
                            </p>

                            <div className="grid gap-4">
                                {PARTNER_PLAN.features.map((feature, index) => (
                                    <motion.div
                                        key={feature}
                                        initial={{ opacity: 0, x: -20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex items-center gap-3"
                                    >
                                        <div className="w-6 h-6 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                                            <Check className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="font-medium">{feature}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-2xl p-8 text-white"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <Shield className="w-8 h-8 text-amber-400" />
                                <h3 className="font-display text-xl font-bold">Piano Partner</h3>
                            </div>

                            <div className="mb-8">
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-5xl font-bold">€0</span>
                                    <span className="text-stone-400">/mese</span>
                                </div>
                                <p className="text-stone-400">con {PARTNER_PLAN.freeThreshold}+ clienti attivi</p>
                            </div>

                            <div className="border-t border-stone-700 pt-6 mb-8">
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-2xl font-bold">EUR{PARTNER_PLAN.basePrice}</span>
                                    <span className="text-stone-400">/mese</span>
                                </div>
                                <p className="text-stone-400">con meno di {PARTNER_PLAN.freeThreshold} clienti</p>
                            </div>

                            <div className="space-y-3 mb-8">
                                <div className="flex items-center gap-3">
                                    <Zap className="w-5 h-5 text-amber-400" />
                                    <span>10M crediti/mese inclusi</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 text-amber-400" />
                                    <span>Trial {PARTNER_PLAN.trialDays} giorni gratuito</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Crown className="w-5 h-5 text-amber-400" />
                                    <span>White Label con {PARTNER_PLAN.whiteLabelThreshold}+ clienti</span>
                                </div>
                            </div>

                            <Link
                                href="/register?plan=partner"
                                className="block w-full text-center py-4 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all"
                            >
                                Inizia il Trial Gratuito
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Transition: Features List (white) → FAQ (transparent) */}
            <div className="h-24 section-fade-to-transparent" />

            {/* FAQ */}
            <section className="py-16 md:py-24 relative">
                <div className="max-w-3xl mx-auto px-6 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                            Domande <span className="gradient-text">Frequenti</span>
                        </h2>
                    </motion.div>

                    <div className="space-y-4">
                        {[
                            {
                                q: 'Cosa si intende per "cliente attivo"?',
                                a: 'Un cliente attivo è un utente a cui hai trasferito almeno un progetto e che ha un abbonamento pagante (Starter, Pro o Business). I clienti in trial o con piano Free non contano per le soglie.'
                            },
                            {
                                q: 'Cosa succede se perdo clienti e scendo sotto la soglia?',
                                a: `Hai un grace period di 30 giorni per riacquistare clienti. Se non raggiungi la soglia, la fee mensile di ${PARTNER_PLAN.basePrice}EUR si riattiva automaticamente.`
                            },
                            {
                                q: 'Posso trasferire progetti a clienti esistenti?',
                                a: 'Sì, puoi trasferire progetti a qualsiasi email. Se il cliente esiste già, il progetto viene aggiunto al suo account. Se non esiste, riceverà un invito a registrarsi.'
                            },
                            {
                                q: 'Come funziona il White Label?',
                                a: `Con ${PARTNER_PLAN.whiteLabelThreshold}+ clienti attivi, puoi personalizzare la piattaforma con il tuo logo e branding. I tuoi clienti vedranno il tuo brand invece di Business Tuner.`
                            },
                            {
                                q: 'Posso passare da un piano normale a Partner?',
                                a: 'Sì, puoi richiedere di diventare Partner in qualsiasi momento. Il trial di 60 giorni partirà dalla data di attivazione del piano Partner.'
                            }
                        ].map((faq, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white rounded-xl p-6 border border-stone-200"
                            >
                                <h3 className="font-semibold text-lg mb-2">{faq.q}</h3>
                                <p className="text-[hsl(var(--muted-foreground))]">{faq.a}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-16 md:py-24 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500" />
                <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-6">
                            Pronto a far crescere la tua agenzia?
                        </h2>
                        <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                            Inizia oggi con {PARTNER_PLAN.trialDays} giorni di trial gratuito.
                            Nessuna carta richiesta.
                        </p>
                        <Link
                            href="/register?plan=partner"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-amber-600 font-bold rounded-xl shadow-lg hover:bg-stone-50 transition-all"
                        >
                            Diventa Partner
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}
