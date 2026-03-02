'use client';

import { motion } from 'framer-motion';
import { Webhook, Search, ArrowRight, Workflow, TrendingUp, Bell, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const integrations = [
    {
        name: 'n8n',
        logo: (
            <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none">
                <rect width="40" height="40" rx="8" fill="#EA4B71" />
                <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">n8n</text>
            </svg>
        ),
        description: 'Instrada gli AI Tips verso Slack, Notion, CRM e oltre 400 app.',
        badge: 'Automazione',
        badgeColor: 'bg-pink-100 text-pink-700',
    },
    {
        name: 'Webhook',
        logo: <Webhook className="w-7 h-7 text-[hsl(var(--coral))]" />,
        description: 'Ricevi notifiche in uscita su ogni nuova risposta, tip o evento.',
        badge: 'Notifiche',
        badgeColor: 'bg-[hsl(var(--coral)/0.1)] text-[hsl(var(--coral))]',
    },
    {
        name: 'Google Search Console',
        logo: (
            <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none">
                <rect width="40" height="40" rx="8" fill="#4285F4" />
                <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">G</text>
            </svg>
        ),
        description: 'Importa query, posizioni e CTR dalla Search Console per correlare dati SEO con il feedback qualitativo.',
        badge: 'SEO',
        badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
        name: 'SERP & AI Monitor',
        logo: <Search className="w-7 h-7 text-green-600" />,
        description: 'Monitora come il tuo brand appare su Google e nelle risposte AI di ChatGPT, Claude e Gemini.',
        badge: 'Visibilità',
        badgeColor: 'bg-green-100 text-green-700',
    },
];

const flowSteps = [
    { icon: Bell, label: 'Nuovo feedback raccolto' },
    { icon: RefreshCw, label: "AI genera insight e tip" },
    { icon: Webhook, label: 'Webhook / n8n inviato' },
    { icon: TrendingUp, label: 'Azione nei tuoi tool' },
];

export function AutomationSection() {
    return (
        <section
            id="integrazioni"
            className="pt-8 pb-24 md:pt-12 md:pb-32 relative overflow-hidden"
        >
            {/* Subtle gradient overlay — transparent background like AITipsSection */}
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--amber)/0.05)] via-transparent to-green-500/5" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--amber)/0.2)] border border-[hsl(var(--amber)/0.3)] mb-6">
                        <Workflow className="w-4 h-4 text-[hsl(var(--amber))]" />
                        <span className="text-sm font-medium text-[hsl(var(--amber))]">Integrazioni & Automazioni</span>
                    </div>
                    <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
                        I tuoi insight,{' '}
                        <span className="gradient-text">dove ne hai bisogno</span>
                    </h2>
                    <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
                        Collega Business Tuner ai tuoi strumenti. Instrada automaticamente ogni AI Tip
                        verso Slack, Notion, il tuo CRM — o qualsiasi altro sistema via n8n o webhook.
                    </p>
                </motion.div>

                {/* Automation flow visual */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-wrap justify-center items-center gap-3 mb-16"
                >
                    {flowSteps.map((step, i) => (
                        <div key={step.label} className="flex items-center gap-3">
                            <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 border border-[hsl(var(--border)/0.5)]">
                                <div className="w-8 h-8 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0">
                                    <step.icon className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm font-medium whitespace-nowrap">{step.label}</span>
                            </div>
                            {i < flowSteps.length - 1 && (
                                <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                            )}
                        </div>
                    ))}
                </motion.div>

                {/* Integration cards grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-12">
                    {integrations.map((integration, index) => (
                        <motion.div
                            key={integration.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="group relative"
                        >
                            <div className="absolute inset-0 bg-[hsl(var(--amber)/0.08)] rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative glass-card rounded-2xl p-6 transition-all border border-[hsl(var(--border)/0.5)]">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[hsl(var(--secondary))] flex items-center justify-center flex-shrink-0 border border-[hsl(var(--border))]">
                                        {integration.logo}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-semibold">{integration.name}</span>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${integration.badgeColor}`}>
                                                {integration.badge}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
                                            {integration.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA strip */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                >
                    <p className="text-[hsl(var(--muted-foreground))] mb-4 text-sm">
                        Webhook e integrazioni disponibili dal piano <strong>Pro</strong>. Google Search Console e SERP monitoring inclusi in tutti i piani.
                    </p>
                    <Link
                        href="#pricing"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--secondary))] transition-colors font-medium group"
                    >
                        Scopri i piani
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
}
