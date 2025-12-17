import Link from 'next/link';
import { Check, X, Sparkles, Zap, Building, Crown } from 'lucide-react';

export const metadata = {
    title: 'Pricing | voler.AI',
    description: 'Prezzi semplici e trasparenti. Inizia gratis, scala quando cresci.',
};

const plans = [
    {
        name: 'Free',
        price: '€0',
        period: 'per sempre',
        description: 'Perfetto per provare la piattaforma',
        icon: Sparkles,
        features: [
            { text: '1 intervista attiva', included: true },
            { text: '30 risposte/mese', included: true },
            { text: '1 utente', included: true },
            { text: 'Template base', included: true },
            { text: 'Analytics base', included: true },
            { text: 'Watermark voler.AI', included: true },
            { text: 'Branding custom', included: false },
            { text: 'Export PDF', included: false },
            { text: 'API access', included: false },
        ],
        cta: 'Inizia gratis',
        href: '/onboarding',
        popular: false,
    },
    {
        name: 'Starter',
        price: '€29',
        period: '/mese',
        description: 'Per professionisti e piccoli team',
        icon: Zap,
        features: [
            { text: '3 interviste attive', included: true },
            { text: '150 risposte/mese', included: true },
            { text: '1 utente', included: true },
            { text: 'Tutti i template', included: true },
            { text: 'Analytics avanzati', included: true },
            { text: 'Nessun watermark', included: true },
            { text: 'Export PDF', included: true },
            { text: 'Branding custom', included: false },
            { text: 'API access', included: false },
        ],
        cta: 'Inizia con Starter',
        href: '/api/stripe/checkout?tier=STARTER',
        popular: false,
        tier: 'STARTER',
    },
    {
        name: 'Pro',
        price: '€79',
        period: '/mese',
        description: 'Per team che fanno ricerca regolarmente',
        icon: Crown,
        features: [
            { text: '10 interviste attive', included: true },
            { text: '500 risposte/mese', included: true },
            { text: '3 utenti', included: true },
            { text: 'Tutti i template', included: true },
            { text: 'Analytics avanzati', included: true },
            { text: 'Nessun watermark', included: true },
            { text: 'Export PDF + CSV', included: true },
            { text: 'Branding custom', included: true },
            { text: 'API access', included: true },
        ],
        cta: 'Inizia con Pro',
        href: '/api/stripe/checkout?tier=PRO',
        popular: true,
        tier: 'PRO',
    },
    {
        name: 'Business',
        price: '€199',
        period: '/mese',
        description: 'Per organizzazioni con esigenze avanzate',
        icon: Building,
        features: [
            { text: 'Interviste illimitate', included: true },
            { text: '2000 risposte/mese', included: true },
            { text: '10 utenti', included: true },
            { text: 'Tutti i template', included: true },
            { text: 'Analytics avanzati', included: true },
            { text: 'Nessun watermark', included: true },
            { text: 'Export completo', included: true },
            { text: 'Branding custom', included: true },
            { text: 'API + SSO', included: true },
            { text: 'Supporto prioritario', included: true },
        ],
        cta: 'Inizia con Business',
        href: '/api/stripe/checkout?tier=BUSINESS',
        popular: false,
        tier: 'BUSINESS',
    },
];

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="p-6 border-b border-white/10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/" className="text-2xl font-bold text-white">
                        voler.AI
                    </Link>
                    <div className="flex gap-4">
                        <Link href="/login" className="px-4 py-2 text-slate-300 hover:text-white transition-colors">
                            Accedi
                        </Link>
                        <Link href="/onboarding" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                            Inizia gratis
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-16">
                {/* Hero */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        Prezzi semplici e trasparenti
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                        Inizia gratis, scala quando cresci. Nessun costo nascosto, cancella quando vuoi.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.map((plan) => {
                        const Icon = plan.icon;
                        return (
                            <div
                                key={plan.name}
                                className={`relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border transition-all ${plan.popular
                                        ? 'border-purple-500 ring-2 ring-purple-500/20'
                                        : 'border-white/10 hover:border-white/20'
                                    }`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-500 text-white text-xs font-medium rounded-full">
                                        Più popolare
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-lg ${plan.popular ? 'bg-purple-500/20' : 'bg-white/10'}`}>
                                        <Icon className={`w-5 h-5 ${plan.popular ? 'text-purple-400' : 'text-slate-400'}`} />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                                </div>

                                <div className="mb-4">
                                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                                    <span className="text-slate-400">{plan.period}</span>
                                </div>

                                <p className="text-slate-400 text-sm mb-6">{plan.description}</p>

                                <ul className="space-y-3 mb-6">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm">
                                            {feature.included ? (
                                                <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                                            ) : (
                                                <X className="w-4 h-4 text-slate-600 flex-shrink-0" />
                                            )}
                                            <span className={feature.included ? 'text-slate-300' : 'text-slate-500'}>
                                                {feature.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href={plan.href}
                                    className={`block w-full py-3 rounded-lg text-center font-medium transition-colors ${plan.popular
                                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                            : 'bg-white/10 hover:bg-white/20 text-white'
                                        }`}
                                >
                                    {plan.cta}
                                </Link>
                            </div>
                        );
                    })}
                </div>

                {/* Enterprise CTA */}
                <div className="mt-16 text-center bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-8 border border-purple-500/30">
                    <h2 className="text-2xl font-bold text-white mb-2">Hai bisogno di più?</h2>
                    <p className="text-slate-300 mb-6">
                        Contattaci per un piano Enterprise personalizzato con volumi illimitati, SLA dedicato e onboarding personalizzato.
                    </p>
                    <Link
                        href="mailto:enterprise@voler.ai"
                        className="inline-block px-8 py-3 bg-white text-purple-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Contatta le vendite
                    </Link>
                </div>

                {/* FAQ */}
                <div className="mt-20">
                    <h2 className="text-2xl font-bold text-white text-center mb-10">Domande frequenti</h2>
                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {[
                            {
                                q: 'Posso cambiare piano in qualsiasi momento?',
                                a: 'Sì, puoi effettuare upgrade o downgrade del tuo piano in qualsiasi momento. Le modifiche saranno applicate immediatamente.'
                            },
                            {
                                q: 'Come funziona il limite di risposte?',
                                a: 'Il limite si riferisce alle interviste completate ogni mese. Si resetta automaticamente il primo del mese.'
                            },
                            {
                                q: 'Cosa succede se supero il limite?',
                                a: 'Le nuove interviste verranno messe in pausa fino al reset mensile o fino a quando effettui un upgrade.'
                            },
                            {
                                q: 'Posso cancellare in qualsiasi momento?',
                                a: 'Assolutamente. Nessun vincolo contrattuale. Cancella quando vuoi e mantieni accesso fino alla fine del periodo già pagato.'
                            },
                        ].map((faq, i) => (
                            <div key={i} className="bg-white/5 rounded-xl p-6 border border-white/10">
                                <h3 className="font-semibold text-white mb-2">{faq.q}</h3>
                                <p className="text-slate-400 text-sm">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/10 p-6 mt-16">
                <div className="max-w-7xl mx-auto text-center text-slate-500 text-sm">
                    © 2024 voler.AI - Tutti i diritti riservati
                </div>
            </footer>
        </div>
    );
}
