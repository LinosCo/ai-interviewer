'use client';

import Link from 'next/link';
import { useState } from 'react';

const USE_CASES = [
    {
        id: 'b2b',
        title: 'Clienti B2B',
        icon: '🏢',
        description: 'Capire perché i clienti non riordinano, cosa pensano del servizio, come migliorare la relazione.',
        examples: ['Post-vendita', 'Churn analysis', 'NPS qualitativo', 'Win/Loss analysis']
    },
    {
        id: 'b2c',
        title: 'Clienti B2C',
        icon: '🛒',
        description: 'Raccogliere feedback su prodotti, esperienza d\'acquisto, aspettative e frustrazioni.',
        examples: ['Product feedback', 'Customer journey', 'Concept testing', 'Brand perception']
    },
    {
        id: 'hr',
        title: 'Risorse Umane',
        icon: '👥',
        description: 'Ascoltare dipendenti e collaboratori senza il filtro dell\'ufficio HR.',
        examples: ['Exit interview', 'Clima aziendale', 'Onboarding check', 'Pulse survey']
    },
    {
        id: 'operations',
        title: 'Operations',
        icon: '⚙️',
        description: 'Feedback da fornitori, partner e stakeholder per migliorare processi e relazioni.',
        examples: ['Supplier feedback', 'Partner satisfaction', 'Process improvement', 'Post-progetto']
    }
];

const STEPS = [
    {
        number: '01',
        title: 'Descrivi l\'obiettivo',
        description: 'Scrivi cosa vuoi capire, in linguaggio naturale. "Voglio sapere perché i clienti non riordinano" oppure "Capire come si trovano i nuovi assunti dopo 3 mesi".'
    },
    {
        number: '02',
        title: 'L\'AI prepara l\'intervista',
        description: 'In pochi secondi Business Tuner genera una conversazione strutturata con le domande giuste, basata su metodologie di ricerca qualitativa.'
    },
    {
        number: '03',
        title: 'Condividi il link',
        description: 'Manda il link via email, WhatsApp o qualsiasi canale. Chi risponde parla con l\'AI per 10-15 minuti, quando vuole.'
    },
    {
        number: '04',
        title: 'Ricevi gli insight',
        description: 'Temi ricorrenti, citazioni significative, sentiment. Tutto quello che serve per decidere, senza leggere trascrizioni infinite.'
    }
];

const TESTIMONIALS = [
    {
        quote: "Prima facevamo un sondaggio all'anno con 15% di risposte. Ora raccogliamo feedback continui con il 70% di completamento.",
        author: "Responsabile Qualità",
        company: "Azienda manifatturiera, 120 dipendenti"
    },
    {
        quote: "Le exit interview le faceva l'HR, e nessuno diceva la verità. Con Business Tuner finalmente capiamo perché le persone se ne vanno.",
        author: "HR Manager",
        company: "Azienda servizi, 80 dipendenti"
    },
    {
        quote: "Ho lanciato un'indagine sui clienti inattivi in 10 minuti. In una settimana avevo insight che avrebbero richiesto mesi di consulenza.",
        author: "Titolare",
        company: "PMI commerciale, 25 dipendenti"
    }
];

const PRICING = [
    {
        name: 'Starter',
        price: '49',
        period: '/mese',
        description: 'Per iniziare a raccogliere feedback',
        features: [
            'Fino a 50 interviste/mese',
            '3 progetti attivi',
            'Analisi AI base',
            'Export PDF',
            'Supporto email'
        ],
        cta: 'Inizia gratis',
        highlighted: false
    },
    {
        name: 'Professional',
        price: '149',
        period: '/mese',
        description: 'Per team e aziende strutturate',
        features: [
            'Fino a 200 interviste/mese',
            'Progetti illimitati',
            'Analisi AI avanzata',
            'Branding personalizzato',
            '3 utenti inclusi',
            'Supporto prioritario'
        ],
        cta: 'Prova gratis 14 giorni',
        highlighted: true
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'Per grandi organizzazioni',
        features: [
            'Volume personalizzato',
            'SSO e sicurezza avanzata',
            'Integrazioni custom',
            'Utenti illimitati',
            'Account manager dedicato',
            'SLA garantito'
        ],
        cta: 'Contattaci',
        highlighted: false
    }
];

export default function LandingPage() {
    const [activeUseCase, setActiveUseCase] = useState('b2b');
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const currentUseCase = USE_CASES.find(uc => uc.id === activeUseCase)!;

    return (
        <div className="overflow-hidden">
            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center">
                {/* Background decoration */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-gradient-to-br from-amber-100/40 to-orange-100/40 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-stone-100 to-stone-200/50 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-6xl mx-auto px-6 py-24">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            {/* Badge */}
                            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200/50 rounded-full px-4 py-1.5 mb-8">
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                <span className="text-amber-800 text-sm font-medium">Interviste qualitative con AI</span>
                            </div>

                            {/* Headline */}
                            <h1 className="text-5xl md:text-6xl font-bold text-stone-900 leading-[1.1] tracking-tight mb-6">
                                Ascolta il mercato.
                                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
                                    Decidi meglio.
                                </span>
                            </h1>

                            {/* Subheadline */}
                            <p className="text-xl text-stone-600 leading-relaxed mb-8 max-w-lg">
                                Raccogli feedback qualitativi da clienti, dipendenti e stakeholder. 
                                Senza interviste manuali, senza consulenti, senza sondaggi ignorati.
                            </p>

                            {/* CTA */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link
                                    href="/onboarding"
                                    className="inline-flex items-center justify-center gap-2 bg-stone-900 text-white px-8 py-4 rounded-full font-medium hover:bg-stone-800 transition-all hover:scale-105 shadow-lg shadow-stone-900/20"
                                >
                                    Crea la tua prima intervista
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </Link>
                                <Link
                                    href="#come-funziona"
                                    className="inline-flex items-center justify-center gap-2 bg-white text-stone-700 px-8 py-4 rounded-full font-medium border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-all"
                                >
                                    Guarda come funziona
                                </Link>
                            </div>

                            {/* Social proof */}
                            <div className="mt-12 pt-8 border-t border-stone-200">
                                <p className="text-sm text-stone-500 mb-3">Usato da team di prodotto, HR e direzione in</p>
                                <div className="flex items-center gap-6 text-stone-400">
                                    <span className="text-sm font-medium">PMI</span>
                                    <span className="w-1 h-1 bg-stone-300 rounded-full" />
                                    <span className="text-sm font-medium">Mid-market</span>
                                    <span className="w-1 h-1 bg-stone-300 rounded-full" />
                                    <span className="text-sm font-medium">Enterprise</span>
                                </div>
                            </div>
                        </div>

                        {/* Hero Visual */}
                        <div className="relative hidden lg:block">
                            <div className="relative bg-white rounded-2xl shadow-2xl shadow-stone-900/10 border border-stone-200/50 overflow-hidden">
                                {/* Mock chat interface */}
                                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">Feedback Clienti Q4</div>
                                            <div className="text-white/70 text-sm">12 risposte · 3 in corso</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-amber-600 text-sm">🎯</span>
                                        </div>
                                        <div className="bg-stone-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[280px]">
                                            <p className="text-stone-700 text-sm">Cosa ti ha portato a scegliere il nostro servizio rispetto ad altri?</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 justify-end">
                                        <div className="bg-amber-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[280px]">
                                            <p className="text-sm">Cercavo qualcosa di più flessibile. I competitor avevano contratti troppo rigidi per noi...</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-amber-600 text-sm">🎯</span>
                                        </div>
                                        <div className="bg-stone-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[280px]">
                                            <p className="text-stone-700 text-sm">Interessante. Puoi farmi un esempio concreto di questa flessibilità?</p>
                                        </div>
                                    </div>
                                </div>
                                {/* Typing indicator */}
                                <div className="px-6 pb-6">
                                    <div className="flex items-center gap-2 text-stone-400 text-sm">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span>Marco sta scrivendo...</span>
                                    </div>
                                </div>
                            </div>

                            {/* Floating insight card */}
                            <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg border border-stone-200 p-4 max-w-[220px]">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-stone-900">Tema emergente</span>
                                </div>
                                <p className="text-sm text-stone-600">"Flessibilità contrattuale" citata dal 67% dei rispondenti</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Problem/Solution Section */}
            <section className="py-24 bg-stone-900 text-white">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-16">
                        <div>
                            <span className="text-amber-400 text-sm font-medium uppercase tracking-wider">Il problema</span>
                            <h2 className="text-3xl font-bold mt-4 mb-6">Le decisioni si prendono al buio</h2>
                            <ul className="space-y-4 text-stone-400">
                                <li className="flex items-start gap-3">
                                    <span className="text-red-400 mt-1">✗</span>
                                    <span>I commerciali filtrano il feedback, arriva solo quello che vogliono far sapere</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-400 mt-1">✗</span>
                                    <span>I sondaggi hanno tassi di risposta del 10-15%, e risposte superficiali</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-400 mt-1">✗</span>
                                    <span>Le interviste manuali richiedono tempo, competenze, budget per consulenti</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-red-400 mt-1">✗</span>
                                    <span>I dipendenti non dicono la verità all'HR, i clienti non la dicono ai venditori</span>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <span className="text-amber-400 text-sm font-medium uppercase tracking-wider">La soluzione</span>
                            <h2 className="text-3xl font-bold mt-4 mb-6">Un intervistatore che lavora per te</h2>
                            <ul className="space-y-4 text-stone-300">
                                <li className="flex items-start gap-3">
                                    <span className="text-green-400 mt-1">✓</span>
                                    <span>Conversazioni vere che vanno in profondità, non checkbox da spuntare</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-green-400 mt-1">✓</span>
                                    <span>Tassi di completamento del 70%+, perché rispondere è facile e naturale</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-green-400 mt-1">✓</span>
                                    <span>Pronto in 10 minuti, senza competenze tecniche o metodologiche</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-green-400 mt-1">✓</span>
                                    <span>Le persone sono più oneste con un AI: niente giudizio, niente imbarazzo</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it Works Section */}
            <section id="come-funziona" className="py-24">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-amber-600 text-sm font-medium uppercase tracking-wider">Come funziona</span>
                        <h2 className="text-4xl font-bold text-stone-900 mt-4">Da zero a insight in 4 passi</h2>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {STEPS.map((step, index) => (
                            <div key={step.number} className="relative">
                                {index < STEPS.length - 1 && (
                                    <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-amber-300 to-transparent z-0" />
                                )}
                                <div className="relative z-10">
                                    <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mb-6">
                                        <span className="text-2xl font-bold text-amber-600">{step.number}</span>
                                    </div>
                                    <h3 className="text-xl font-semibold text-stone-900 mb-3">{step.title}</h3>
                                    <p className="text-stone-600 leading-relaxed">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Use Cases Section */}
            <section id="casi-uso" className="py-24 bg-stone-50">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-amber-600 text-sm font-medium uppercase tracking-wider">Casi d'uso</span>
                        <h2 className="text-4xl font-bold text-stone-900 mt-4">Per ogni tipo di feedback</h2>
                        <p className="text-stone-600 mt-4 max-w-2xl mx-auto">
                            Che tu voglia capire i clienti, ascoltare i dipendenti o migliorare i processi, 
                            Business Tuner si adatta alle tue esigenze.
                        </p>
                    </div>

                    {/* Tab selector */}
                    <div className="flex flex-wrap justify-center gap-3 mb-12">
                        {USE_CASES.map((uc) => (
                            <button
                                key={uc.id}
                                onClick={() => setActiveUseCase(uc.id)}
                                className={`px-6 py-3 rounded-full font-medium transition-all ${
                                    activeUseCase === uc.id
                                        ? 'bg-stone-900 text-white shadow-lg'
                                        : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                                }`}
                            >
                                <span className="mr-2">{uc.icon}</span>
                                {uc.title}
                            </button>
                        ))}
                    </div>

                    {/* Active use case content */}
                    <div className="bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden">
                        <div className="grid md:grid-cols-2">
                            <div className="p-10">
                                <div className="text-4xl mb-4">{currentUseCase.icon}</div>
                                <h3 className="text-2xl font-bold text-stone-900 mb-4">{currentUseCase.title}</h3>
                                <p className="text-stone-600 mb-8">{currentUseCase.description}</p>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Template pronti:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {currentUseCase.examples.map((example) => (
                                            <span key={example} className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm">
                                                {example}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-10 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-6">
                                        <span className="text-4xl">{currentUseCase.icon}</span>
                                    </div>
                                    <p className="text-stone-600 mb-4">Prova un template {currentUseCase.title}</p>
                                    <Link
                                        href="/onboarding"
                                        className="inline-flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full font-medium hover:bg-stone-800 transition-all"
                                    >
                                        Inizia ora
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-24">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-amber-600 text-sm font-medium uppercase tracking-wider">Testimonianze</span>
                        <h2 className="text-4xl font-bold text-stone-900 mt-4">Chi lo usa, lo consiglia</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {TESTIMONIALS.map((testimonial, index) => (
                            <div key={index} className="bg-white rounded-2xl p-8 shadow-lg border border-stone-100">
                                <div className="flex gap-1 mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <svg key={i} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ))}
                                </div>
                                <blockquote className="text-stone-700 mb-6 leading-relaxed">
                                    "{testimonial.quote}"
                                </blockquote>
                                <div>
                                    <div className="font-medium text-stone-900">{testimonial.author}</div>
                                    <div className="text-sm text-stone-500">{testimonial.company}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="prezzi" className="py-24 bg-stone-50">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-amber-600 text-sm font-medium uppercase tracking-wider">Prezzi</span>
                        <h2 className="text-4xl font-bold text-stone-900 mt-4">Scegli il piano giusto per te</h2>
                        <p className="text-stone-600 mt-4">Inizia gratis, scala quando serve.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {PRICING.map((plan) => (
                            <div
                                key={plan.name}
                                className={`rounded-2xl p-8 ${
                                    plan.highlighted
                                        ? 'bg-stone-900 text-white ring-4 ring-amber-400 shadow-2xl scale-105'
                                        : 'bg-white border border-stone-200 shadow-lg'
                                }`}
                            >
                                {plan.highlighted && (
                                    <div className="inline-block bg-amber-400 text-stone-900 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4">
                                        Più popolare
                                    </div>
                                )}
                                <h3 className={`text-xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-stone-900'}`}>
                                    {plan.name}
                                </h3>
                                <p className={`text-sm mb-6 ${plan.highlighted ? 'text-stone-400' : 'text-stone-500'}`}>
                                    {plan.description}
                                </p>
                                <div className="mb-6">
                                    <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-stone-900'}`}>
                                        {plan.price === 'Custom' ? '' : '€'}{plan.price}
                                    </span>
                                    <span className={plan.highlighted ? 'text-stone-400' : 'text-stone-500'}>
                                        {plan.period}
                                    </span>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3">
                                            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-amber-400' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className={`text-sm ${plan.highlighted ? 'text-stone-300' : 'text-stone-600'}`}>
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={plan.name === 'Enterprise' ? 'mailto:sales@businesstuner.it' : '/onboarding'}
                                    className={`block text-center py-3 rounded-full font-medium transition-all ${
                                        plan.highlighted
                                            ? 'bg-amber-400 text-stone-900 hover:bg-amber-300'
                                            : 'bg-stone-900 text-white hover:bg-stone-800'
                                    }`}
                                >
                                    {plan.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-24">
                <div className="max-w-3xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-amber-600 text-sm font-medium uppercase tracking-wider">FAQ</span>
                        <h2 className="text-4xl font-bold text-stone-900 mt-4">Domande frequenti</h2>
                    </div>

                    <div className="space-y-4">
                        {[
                            {
                                q: 'I miei clienti/dipendenti risponderanno davvero a un bot?',
                                a: 'Sì, e più volentieri di quanto pensi. Le persone sono più oneste con un sistema automatico: niente imbarazzo, niente giudizio. I nostri tassi di completamento superano il 70%, contro il 10-15% dei sondaggi tradizionali.'
                            },
                            {
                                q: 'Quanto tempo serve per creare un\'intervista?',
                                a: 'Meno di 10 minuti. Descrivi l\'obiettivo in linguaggio naturale, Business Tuner genera automaticamente la struttura. Puoi modificarla se vuoi, oppure pubblicare subito.'
                            },
                            {
                                q: 'I dati sono al sicuro? GDPR?',
                                a: 'Assolutamente. I dati sono criptati, conservati in Europa, e trattati secondo il GDPR. Ogni intervista include l\'informativa privacy e la raccolta del consenso.'
                            },
                            {
                                q: 'Posso personalizzare l\'aspetto dell\'intervista?',
                                a: 'Sì, dal piano Professional in su puoi inserire il tuo logo, i colori del brand, e personalizzare i messaggi. L\'intervista sembrerà parte della tua comunicazione.'
                            },
                            {
                                q: 'In che lingue funziona?',
                                a: 'Italiano e inglese sono completamente supportati. Altre lingue europee su richiesta per i piani Professional ed Enterprise.'
                            },
                            {
                                q: 'Posso provare prima di pagare?',
                                a: 'Certo. Il piano Starter include 14 giorni di prova gratuita. Nessuna carta di credito richiesta per iniziare.'
                            }
                        ].map((faq, index) => (
                            <div key={index} className="border border-stone-200 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                    className="w-full flex items-center justify-between p-6 text-left bg-white hover:bg-stone-50 transition-colors"
                                >
                                    <span className="font-medium text-stone-900 pr-4">{faq.q}</span>
                                    <svg
                                        className={`w-5 h-5 text-stone-400 flex-shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {openFaq === index && (
                                    <div className="px-6 pb-6 text-stone-600 leading-relaxed">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-24 bg-gradient-to-br from-stone-900 to-stone-800">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Pronto ad ascoltare davvero?
                    </h2>
                    <p className="text-xl text-stone-400 mb-10 max-w-2xl mx-auto">
                        Crea la tua prima intervista in 10 minuti. Gratis, senza carta di credito.
                    </p>
                    <Link
                        href="/onboarding"
                        className="inline-flex items-center gap-3 bg-amber-400 text-stone-900 px-10 py-5 rounded-full text-lg font-semibold hover:bg-amber-300 transition-all hover:scale-105 shadow-2xl"
                    >
                        Inizia ora
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </Link>
                </div>
            </section>
        </div>
    );
}
