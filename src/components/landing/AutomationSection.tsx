'use client';

import { motion } from 'framer-motion';
import { Webhook, ArrowRight, Workflow, TrendingUp, Bell, RefreshCw, BarChart3 } from 'lucide-react';
import Link from 'next/link';

const logoGoogleAnalytics = (
    <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="8" fill="#F9AB00" />
        <rect x="10" y="20" width="5" height="12" rx="2.5" fill="white" />
        <rect x="18" y="14" width="5" height="18" rx="2.5" fill="white" />
        <circle cx="30" cy="27" r="4" fill="white" />
    </svg>
);

const logoSearchConsole = (
    <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="8" fill="#4285F4" />
        <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">GSC</text>
    </svg>
);

const logoWordPress = (
    <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="8" fill="#21759B" />
        <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="14" fontWeight="700">W</text>
    </svg>
);

const logoWooCommerce = (
    <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="8" fill="#96588A" />
        <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">WOO</text>
    </svg>
);

const logoN8n = (
    <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="8" fill="#EA4B71" />
        <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">n8n</text>
    </svg>
);

const integrations = [
    {
        name: 'Google Analytics',
        logo: logoGoogleAnalytics,
        description: 'Collega i dati di traffico e conversione per contestualizzare insight e azioni nel funnel.',
        badge: 'Analytics',
        badgeColor: 'bg-orange-100 text-orange-700',
    },
    {
        name: 'Google Search Console',
        logo: logoSearchConsole,
        description: 'Importa query, posizioni e CTR per collegare performance SEO a feedback qualitativo e intenti reali.',
        badge: 'SEO',
        badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
        name: 'WordPress',
        logo: logoWordPress,
        description: 'Sincronizza contenuti e pagine per applicare rapidamente le azioni suggerite dal Copilot.',
        badge: 'CMS',
        badgeColor: 'bg-sky-100 text-sky-700',
    },
    {
        name: 'WooCommerce',
        logo: logoWooCommerce,
        description: 'Attiva flussi su catalogo e percorso di acquisto, collegando insight a decisioni e-commerce.',
        badge: 'E-commerce',
        badgeColor: 'bg-violet-100 text-violet-700',
    },
    {
        name: 'n8n',
        logo: logoN8n,
        description: 'Instrada insight e AI Tips verso Slack, Notion, CRM e oltre 400 app senza codice.',
        badge: 'Automazione',
        badgeColor: 'bg-pink-100 text-pink-700',
    },
    {
        name: 'Webhook',
        logo: <Webhook className="w-7 h-7 text-[hsl(var(--coral))]" />,
        description: 'Ricevi eventi pronti da usare nel tuo stack: nuovi insight, tip operativi, stato azioni.',
        badge: 'Notifiche',
        badgeColor: 'bg-[hsl(var(--coral)/0.1)] text-[hsl(var(--coral))]',
    },
];

const connectedPlatforms = [
    { name: 'Google Analytics', logo: logoGoogleAnalytics },
    { name: 'Search Console', logo: logoSearchConsole },
    { name: 'WordPress', logo: logoWordPress },
    { name: 'WooCommerce', logo: logoWooCommerce },
    { name: 'Webhook', logo: <Webhook className="w-5 h-5 text-[hsl(var(--coral))]" /> },
    { name: 'n8n', logo: logoN8n },
];

const flowSteps = [
    { icon: Bell, label: 'Segnale raccolto' },
    { icon: RefreshCw, label: 'Copilot orienta la decisione' },
    { icon: Webhook, label: 'Regola n8n/webhook' },
    { icon: TrendingUp, label: 'Task eseguito e tracciato' },
];

const playbooks = [
    {
        title: 'Lead Qualification',
        text: 'Dal chatbot al CRM con campi arricchiti e qualificazione commerciale automatica.',
    },
    {
        title: 'Content Loop',
        text: 'Da insight ricorrenti a FAQ, contenuti e ticket editoriale nei tuoi tool di lavoro.',
    },
    {
        title: 'Brand Recovery',
        text: 'Alert su cali di visibilita AI + check list operativa per recupero copertura.',
    },
];

export function AutomationSection() {
    return (
        <section
            id="esegui"
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
                        <span className="text-sm font-medium text-[hsl(var(--amber))]">03 Esegui - Integrazioni & Automazioni</span>
                    </div>
                    <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
                        Dall&apos;insight all&apos;azione,{' '}
                        <span className="gradient-text">senza attriti operativi</span>
                    </h2>
                    <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
                        Collega Business Tuner al tuo stack operativo. Dal segnale all&apos;azione:
                        il Copilot propone, le automazioni distribuiscono, il team esegue.
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
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
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

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    <div className="rounded-2xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--card)/0.75)] p-5 md:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-4 h-4 text-[hsl(var(--coral))]" />
                            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                Piattaforme esterne collegabili
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {connectedPlatforms.map((platform) => (
                                <div
                                    key={platform.name}
                                    className="rounded-xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--background)/0.85)] px-3 py-3 flex items-center gap-2"
                                    title={platform.name}
                                >
                                    <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                                        {platform.logo}
                                    </div>
                                    <span className="text-xs font-medium text-[hsl(var(--foreground))] whitespace-nowrap">
                                        {platform.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="grid md:grid-cols-3 gap-4 mb-12"
                >
                    {playbooks.map((playbook) => (
                        <div
                            key={playbook.title}
                            className="rounded-2xl border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--card)/0.75)] p-5"
                        >
                            <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-2">{playbook.title}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{playbook.text}</p>
                        </div>
                    ))}
                </motion.div>

                {/* CTA strip */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                >
                    <p className="text-[hsl(var(--muted-foreground))] mb-4 text-sm">
                        Workflow no-code disponibili nei piani con Copilot e strumenti avanzati (Pro+).
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
