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

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://businesstuner.it').replace(/\/+$/, '');
const PARTNER_FAQS = [
    {
        q: 'Cos\'e il Programma Partner in termini pratici?',
        a: 'E un modello per erogare consulenza e servizi con una regia unica: ascolti stakeholder, raccogli segnali di mercato, definisci priorita e trasformi le decisioni in azioni operative tracciabili.'
    },
    {
        q: 'Per quali profili e pensato?',
        a: 'Per agenzie, consulenti strategici, business advisor e team che seguono PMI o aziende strutturate. Funziona sia quando fai delivery digitale diretta sia quando coordini partner esterni.'
    },
    {
        q: 'Qual e la logica di lavoro consigliata con ogni cliente?',
        a: 'Parti con un perimetro chiaro, attivi ascolto e monitoraggio, usi il Copilot per ordinare le priorita e chiudi ogni ciclo con un piano operativo. In questo modo il cliente vede un metodo continuativo, non attivita isolate.'
    },
    {
        q: 'Che ruolo ha il Copilot nel rapporto consulente-cliente?',
        a: 'Il Copilot aiuta a sintetizzare insight, evidenziare priorita e proporre prossime azioni. Tu resti la guida strategica: il Copilot accelera analisi e decisioni, non sostituisce il giudizio consulenziale.'
    },
    {
        q: 'Come aumenta il valore percepito del servizio?',
        a: 'Perche il cliente vede una catena completa: dati raccolti, decisioni motivate, piano d\'azione e avanzamento monitorato. Questo rende la consulenza piu concreta, misurabile e facile da difendere in fase di rinnovo.'
    },
    {
        q: 'Se non gestisco l\'operativita digitale, posso comunque usarlo con efficacia?',
        a: 'Sì. Puoi gestire discovery, strategia, governance e controllo risultati, mentre l\'execution resta al team del cliente o a una seconda agenzia. In pratica diventi il centro di coordinamento decisionale.'
    },
    {
        q: 'Come collaborano consulente, cliente e team operativo?',
        a: 'Il partner definisce obiettivi e priorita, il cliente valida direzione e timing, il team operativo esegue. Tutti lavorano su un contesto condiviso, riducendo incomprensioni e dispersione.'
    },
    {
        q: 'Qual e il primo use case da attivare per creare fiducia velocemente?',
        a: 'Di solito funziona partire da ascolto stakeholder + monitoraggio brand su un tema specifico. In poche settimane ottieni segnali utili, una priorita chiara e un piano azionabile da presentare al cliente.'
    },
    {
        q: 'Come supporta meeting periodici e report direzionali?',
        a: 'Ti aiuta a portare ai meeting una narrativa ordinata: cosa e successo, cosa conta davvero, cosa fare adesso. Questo migliora la qualita delle decisioni e la percezione di controllo del cliente.'
    },
    {
        q: 'Cosa si intende per "cliente attivo"?',
        a: 'Un cliente attivo e un utente a cui hai trasferito almeno un progetto e che ha un abbonamento pagante (Starter, Pro o Business). I clienti in trial o con piano Free non contano per le soglie.'
    },
    {
        q: 'Cosa succede se perdo clienti e scendo sotto la soglia?',
        a: `Hai un grace period di 30 giorni per riacquistare clienti. Se non raggiungi la soglia, la fee mensile di ${PARTNER_PLAN.basePrice}EUR si riattiva automaticamente.`
    },
    {
        q: 'Come funziona il White Label?',
        a: `Con ${PARTNER_PLAN.whiteLabelThreshold}+ clienti attivi, puoi personalizzare la piattaforma con il tuo logo e branding. I tuoi clienti vedranno il tuo brand invece di Business Tuner.`
    },
    {
        q: 'Posso passare da un piano normale a Partner?',
        a: 'Sì, puoi richiedere di diventare Partner in qualsiasi momento. Il trial di 60 giorni partirà dalla data di attivazione del piano Partner.'
    }
];

const partnerJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Service',
            '@id': `${siteUrl}/partner#service`,
            serviceType: 'Programma Partner Marketing Intelligence',
            provider: {
                '@type': 'Organization',
                name: 'Business Tuner',
                url: siteUrl,
            },
            areaServed: 'IT',
            audience: {
                '@type': 'Audience',
                audienceType: 'Agenzie, consulenti strategici, business advisor',
            },
            description:
                'Modello partner per gestire clienti con ascolto stakeholder, Copilot strategico e operativita tracciabile.',
            url: `${siteUrl}/partner`,
        },
        {
            '@type': 'FAQPage',
            '@id': `${siteUrl}/partner#faq`,
            mainEntity: PARTNER_FAQS.map((faq) => ({
                '@type': 'Question',
                name: faq.q,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: faq.a,
                },
            })),
        },
    ],
};

export default function PartnerPage() {
    return (
        <main className="relative min-h-screen overflow-x-hidden">
            <script
                id="partner-jsonld"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(partnerJsonLd) }}
            />
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
                            Programma Partner per Agenzie e Consulenti
                        </div>
                        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                            Fai crescere clienti e advisory con{' '}
                            <span className="gradient-text">Business Tuner</span>
                        </h1>
                        <p className="text-xl text-[hsl(var(--muted-foreground))] mb-8 max-w-2xl mx-auto">
                            Offri ai tuoi clienti uno strumento operativo di ascolto, raccolta dati e decisione strategica.
                            Ideale per PMI, agenzie, consulenti strategici e business advisor, anche quando l&apos;operativita digitale
                            viene gestita dal team del cliente o da partner esterni.
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
                                Avvia nuovi clienti o percorsi consulenziali senza costi iniziali e senza pressione commerciale.
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
                                Raggiungi {PARTNER_PLAN.freeThreshold} clienti attivi e azzeri la fee mensile, mantenendo margine su delivery e advisory.
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
                                Presenta ai clienti una piattaforma con il tuo brand per aumentare fiducia e valore percepito.
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
                            In 4 step attivi un modello Partner che funziona per clienti PMI e aziende strutturate, sia in delivery digitale che in consulenza strategica.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-4 gap-8">
                        {[
                            {
                                step: 1,
                                icon: Users,
                                title: 'Attiva il Piano Partner',
                                description: 'Inizia il trial gratuito con tutte le funzionalita PRO e configura il tuo workspace.'
                            },
                            {
                                step: 2,
                                icon: Building2,
                                title: 'Crea Template e Framework',
                                description: 'Prepara progetti, interviste, monitoraggio e checklist decisionali riusabili per ogni cliente.'
                            },
                            {
                                step: 3,
                                icon: Send,
                                title: 'Condividi con Cliente e Team Operativo',
                                description: 'Trasferisci i progetti al cliente o collabora con team interni e agenzie esterne che gestiscono l\'operativita.'
                            },
                            {
                                step: 4,
                                icon: BarChart3,
                                title: 'Guida le Decisioni dai Dati',
                                description: 'Usa dashboard e Copilot per allineare priorita, report e prossime azioni con maggiore autorevolezza.'
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
                                Tutto cio che ti serve per <span className="gradient-text">scalare servizi e advisory</span>
                            </h2>
                            <p className="text-lg text-[hsl(var(--muted-foreground))] mb-8">
                                Il piano Partner include tutte le funzionalita PRO piu strumenti esclusivi
                                per la gestione multi-cliente di agenzie, consulenti strategici e business advisor su clienti PMI e corporate.
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
                                <h3 className="font-display text-xl font-bold">Piano Partner Agenzie + Consulenti</h3>
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
                                    <span>10K crediti/mese inclusi per attivare ascolto, analisi e automazioni</span>
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
                        <p className="text-lg text-[hsl(var(--muted-foreground))]">
                            Le risposte sono orientate a strategia, metodo e risultati percepiti dal cliente.
                        </p>
                    </motion.div>

                    <div className="space-y-4">
                        {PARTNER_FAQS.map((faq, index) => (
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
                            Pronto a far crescere la tua offerta Partner?
                        </h2>
                        <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                            Attiva oggi il trial: ideale per agenzie, consulenti strategici e business advisor
                            che vogliono piu efficacia operativa e piu valore percepito su clienti PMI e corporate.
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
