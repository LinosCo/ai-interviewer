'use client';

import { motion } from 'framer-motion';
import { GraduationCap, Brain, Trophy, BookOpen, ArrowRight, Check, Play } from 'lucide-react';
import Link from 'next/link';

const steps = [
    {
        number: '01',
        title: 'Carica la knowledge base',
        description: 'Carica documenti, URL o testo strutturato. Il training bot studia i tuoi materiali e li usa per guidare la formazione.',
    },
    {
        number: '02',
        title: 'Configura i topic di apprendimento',
        description: 'Definisci gli argomenti e i sotto-obiettivi. Il bot guiderà ogni trainee attraverso una conversazione strutturata su ciascun topic.',
    },
    {
        number: '03',
        title: 'Quiz di valutazione finale',
        description: "Al termine della sessione, il bot somministra un quiz adattivo. Ogni risposta viene valutata con AI e il punteggio viene salvato automaticamente.",
    },
];

const benefits = [
    'Formazione conversazionale, non solo slide',
    'Valutazione automatica con score AI',
    'Knowledge base personalizzata con i tuoi materiali',
    'Percorsi con certificazione finale per team e stakeholder',
    'Tracciamento progressi per ogni trainee',
    'Multi-topic con obiettivi di apprendimento',
    'Dashboard analytics per HR e team lead',
];

export function TrainingBotSection() {
    return (
        <section
            id="training"
            className="pt-8 pb-20 md:pt-12 md:pb-28 relative"
        >
            {/* White overlay matching FeaturesSection */}
            <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px]" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] mb-6">
                        <GraduationCap className="w-4 h-4 text-[hsl(var(--coral))]" />
                        <span className="text-sm font-medium">Training Bot</span>
                    </div>
                    <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                        Forma il tuo team con{' '}
                        <span className="gradient-text">conversazioni AI</span>
                    </h2>
                    <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
                        Un agente AI che conduce sessioni di formazione strutturate, valuta le
                        conoscenze acquisite e abilita percorsi certificati. Onboarding, compliance,
                        product training e allineamento stakeholder in un unico flusso.
                    </p>
                </motion.div>

                {/* Main feature block: 2-col layout */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="grid lg:grid-cols-2 gap-12 items-center mb-20"
                >
                    {/* Content */}
                    <div>
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6 bg-[hsl(var(--coral)/0.1)]">
                            <Brain className="w-7 h-7 text-[hsl(var(--coral))]" />
                        </div>
                        <h3 className="font-display text-2xl md:text-3xl font-bold mb-4">
                            Formazione strutturata, valutazione automatica
                        </h3>
                        <p className="text-lg text-[hsl(var(--muted-foreground))] mb-6">
                            Il Training Bot guida ogni trainee attraverso topic di apprendimento con
                            dialogo adattivo. Al termine, un quiz valutato dall&apos;AI misura le
                            conoscenze acquisite e restituisce un punteggio obiettivo.
                        </p>
                        <ul className="space-y-3 mb-8">
                            {benefits.map((benefit) => (
                                <li key={benefit} className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full gradient-bg flex items-center justify-center flex-shrink-0">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                    <span className="text-[hsl(var(--foreground))]">{benefit}</span>
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/register"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--secondary))] transition-colors font-medium group"
                        >
                            Prova il Training Bot
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>

                    {/* Mockup: training session UI */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="relative"
                    >
                        <div className="absolute inset-0 rounded-3xl blur-2xl opacity-50 bg-[hsl(var(--coral)/0.1)]" />
                        <div className="relative bg-[hsl(var(--card))] rounded-3xl p-6 md:p-8 border border-[hsl(var(--border)/0.5)] shadow-strong">
                            {/* Training session mockup */}
                            <div className="bg-[hsl(var(--card))] rounded-xl p-4 shadow-soft border border-[hsl(var(--border)/0.5)]">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[hsl(var(--coral)/0.2)] flex items-center justify-center">
                                            <GraduationCap className="w-4 h-4 text-[hsl(var(--coral))]" />
                                        </div>
                                        <div>
                                            <span className="font-medium text-sm block">Training: Onboarding 2024</span>
                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">Topic 2 di 4 · Politiche aziendali</span>
                                        </div>
                                    </div>
                                    <div className="text-xs font-medium text-[hsl(var(--coral))] bg-[hsl(var(--coral)/0.1)] px-2 py-1 rounded-full">
                                        12:30 rimasti
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="h-1.5 bg-[hsl(var(--secondary))] rounded-full mb-4 overflow-hidden">
                                    <div className="h-full w-2/5 gradient-bg rounded-full" />
                                </div>
                                {/* Conversation */}
                                <div className="space-y-3">
                                    <div className="bg-[hsl(var(--secondary))] rounded-lg p-3 mr-8">
                                        <p className="text-sm">Puoi descrivere il processo di approvazione per le spese superiori a €500?</p>
                                    </div>
                                    <div className="bg-[hsl(var(--coral)/0.1)] rounded-lg p-3 ml-8 border border-[hsl(var(--coral)/0.2)]">
                                        <p className="text-sm">
                                            Le spese sopra €500 richiedono l&apos;approvazione del responsabile diretto e del CFO...
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                                        <div className="w-2 h-2 rounded-full bg-[hsl(var(--coral))] animate-pulse" />
                                        <span>L&apos;AI sta valutando la risposta...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* How it works: 3 steps */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="mb-16"
                >
                    <h3 className="font-display text-2xl font-bold text-center mb-10">Come funziona</h3>
                    <div className="grid md:grid-cols-3 gap-8">
                        {steps.map((step, i) => (
                            <motion.div
                                key={step.number}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="relative"
                            >
                                {/* Connector line */}
                                {i < steps.length - 1 && (
                                    <div className="hidden md:block absolute top-6 left-[calc(100%-1rem)] w-8 h-0.5 bg-[hsl(var(--border))] z-10" />
                                )}
                                <div className="bg-[hsl(var(--card))] rounded-2xl p-6 border border-[hsl(var(--border)/0.5)] shadow-soft h-full">
                                    <div className="font-display text-4xl font-bold gradient-text mb-4">{step.number}</div>
                                    <h4 className="font-semibold text-lg mb-2">{step.title}</h4>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{step.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Bottom callout: use cases */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="relative"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--coral)/0.08)] to-[hsl(var(--amber)/0.08)] rounded-3xl blur-xl" />
                    <div className="relative bg-[hsl(var(--card))] rounded-3xl p-8 md:p-10 border border-[hsl(var(--border)/0.5)] shadow-medium">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <Trophy className="w-8 h-8 text-[hsl(var(--amber))]" />
                                    <h3 className="font-display text-2xl font-bold">Casi d&apos;uso ideali</h3>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {[
                                        { icon: BookOpen, label: 'Onboarding nuovi assunti' },
                                        { icon: GraduationCap, label: 'Compliance & normative' },
                                        { icon: Brain, label: 'Product knowledge' },
                                        { icon: Trophy, label: 'Certificazioni interne' },
                                    ].map(({ icon: Icon, label }) => (
                                        <div
                                            key={label}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))]"
                                        >
                                            <Icon className="w-4 h-4 text-[hsl(var(--coral))] flex-shrink-0" />
                                            <span className="text-sm font-medium">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-4 text-center md:text-left md:items-start">
                                <p className="text-[hsl(var(--muted-foreground))] max-w-xs">
                                    Disponibile nel piano <strong>Pro</strong> e <strong>Business</strong>. Crea il tuo primo training bot in 5 minuti.
                                </p>
                                <Link
                                    href="/register"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-bg text-white font-semibold shadow-glow hover:opacity-90 transition-opacity"
                                >
                                    <Play className="w-4 h-4" />
                                    Inizia gratis
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
