'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';

// --- Components ---

const WaveSeparator = ({
    position = 'bottom',
    color = '#FFFBEB', // amber-50
    height = 60
}: {
    position?: 'top' | 'bottom',
    color?: string,
    height?: number
}) => (
    <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 20,
        height: `${height}px`,
        [position]: 0,
        transform: position === 'top' ? 'rotate(180deg)' : 'none'
    }}>
        <svg
            viewBox="0 0 1440 320"
            style={{ width: '100%', height: '100%' }}
            preserveAspectRatio="none"
        >
            <path
                fill={color}
                fillOpacity="1"
                d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            />
        </svg>
    </div>
);

const SectionLabel = ({ text, color = colors.amberDark, bg = 'rgba(251,191,36,0.1)' }: { text: string, color?: string, bg?: string }) => (
    <span className="inline-block text-xs font-bold uppercase tracking-widest py-2 px-4 rounded-full mb-6" style={{ color, background: bg }}>
        {text}
    </span>
);

export default function LandingPage() {
    const [mounted, setMounted] = useState(false);
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        setMounted(true);
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen font-sans bg-white overflow-x-hidden">

            {/* Styles for animation */}
            <style jsx global>{`
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes waveTyping { 0%, 100% { transform: scaleY(0.4); opacity: 0.5; } 50% { transform: scaleY(1); opacity: 1; } }
            `}</style>

            {/* --- HERO SECTION (White) --- */}
            <section className="relative z-10 pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Background Mesh (Subtle) */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-60"
                    style={{
                        background: `
                            radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.peach}40 0%, transparent 50%),
                            radial-gradient(ellipse 60% 40% at 100% 30%, ${colors.rose}20 0%, transparent 40%)
                        `
                    }}
                />

                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">

                        {/* Content */}
                        <div
                            className={`transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md border border-amber-500/30 rounded-full mb-8 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-sm font-semibold text-amber-900 tracking-tight">
                                    Interviste qualitative con AI
                                </span>
                            </div>

                            <h1 className="text-5xl lg:text-7xl font-bold text-stone-900 tracking-tight leading-[1.1] mb-8">
                                Ascolta il mercato.<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600">
                                    Decidi meglio.
                                </span>
                            </h1>

                            <p className="text-xl text-stone-600 leading-relaxed mb-10 max-w-lg">
                                Crea interviste intelligenti in 10 minuti. Raccogli feedback profondi da clienti, dipendenti e partner, scalando la ricerca qualitativa.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 mb-12">
                                <Link href="/register">
                                    <Button withShimmer className="w-full sm:w-auto text-lg px-8 py-6 h-auto">
                                        Inizia gratis <Icons.ArrowRight className="ml-2" size={20} />
                                    </Button>
                                </Link>
                                <Link href="/onboarding/preview">
                                    <Button variant="secondary" className="w-full sm:w-auto text-lg px-8 py-6 h-auto bg-stone-100 hover:bg-stone-200 text-stone-800 border-transparent">
                                        <Icons.Play className="mr-2" size={20} /> Guarda demo
                                    </Button>
                                </Link>
                            </div>

                            {/* Use Cases Pills */}
                            <div className="flex flex-wrap gap-3">
                                {[
                                    'Customer Feedback', 'Exit Interview', 'Clima Aziendale', 'NPS Qualitativo', 'Win/Loss Analysis'
                                ].map((label, i) => (
                                    <span key={i} className="px-4 py-2 bg-stone-100 text-stone-600 rounded-full text-sm font-medium hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-default border border-transparent hover:border-amber-200">
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Visual */}
                        <div
                            className={`relative hidden lg:block transition-all duration-1000 delay-200 ease-out ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
                        >
                            <div className="relative z-10 bg-white/60 backdrop-blur-xl rounded-[2.5rem] p-4 shadow-2xl border border-white/50 animate-[float_6s_ease-in-out_infinite]">
                                <div className="bg-white rounded-[2rem] overflow-hidden shadow-inner border border-stone-100">
                                    {/* Chat Header */}
                                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white">
                                            <Icons.Chat size={24} />
                                        </div>
                                        <div>
                                            <div className="text-white font-bold text-lg">Feedback Clienti Q4</div>
                                            <div className="text-white/80 text-sm">Target: Clienti Premium</div>
                                        </div>
                                    </div>

                                    {/* Chat Messages */}
                                    <div className="p-8 space-y-6 bg-stone-50/50">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
                                                <Icons.Logo size={20} />
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-stone-100 text-stone-800 max-w-[85%]">
                                                <p>Cosa ti ha portato a scegliere il nostro servizio rispetto ai competitor?</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 flex-row-reverse">
                                            <div className="bg-amber-500 text-white p-4 rounded-2xl rounded-tr-none shadow-lg shadow-amber-500/20 max-w-[85%]">
                                                <p>Cercavo più flessibilità. I competitor avevano contratti rigidi che non si adattavano alla stagionalità del mio business.</p>
                                            </div>
                                        </div>

                                        {/* Typing Indicator */}
                                        <div className="flex gap-4 items-center">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
                                                <Icons.Logo size={20} />
                                            </div>
                                            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none shadow-sm border border-stone-100 flex gap-1">
                                                {[0, 1, 2].map(i => (
                                                    <div key={i} className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Insight Card */}
                            <div
                                className="absolute -bottom-8 -left-8 bg-white/90 backdrop-blur-xl p-5 rounded-2xl shadow-xl border border-white/50 max-w-xs z-20"
                                style={{ transform: `translateY(${scrollY * 0.05}px)` }}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                                        <Icons.Zap size={16} />
                                    </div>
                                    <span className="font-bold text-stone-800 text-sm">Insight Trovato</span>
                                </div>
                                <p className="text-stone-600 text-sm">
                                    Il <strong className="text-amber-600">67%</strong> dei clienti cita la "flessibilità contrattuale" come driver d'acquisto.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>

                <WaveSeparator color="#FFFBEB" height={80} />
            </section>

            {/* --- STATS & HOW IT WORKS (Light Warm Background) --- */}
            <section className="relative z-10 bg-[#FFFBEB] py-24 lg:py-32">

                {/* Stats */}
                <div className="container mx-auto px-6 max-w-7xl mb-32">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-amber-500/10">
                        {[
                            { value: '70%+', label: 'Rate di completamento' },
                            { value: '10x', label: 'Più economico e veloce' },
                            { value: '∞', label: 'Scalabilità immediata' }
                        ].map((stat, i) => (
                            <div key={i} className="pt-8 md:pt-0 px-4">
                                <div className="text-5xl lg:text-6xl font-bold text-amber-500 mb-2 font-display tracking-tight">
                                    {stat.value}
                                </div>
                                <div className="text-stone-600 font-medium uppercase tracking-wide text-sm">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* How it works */}
                <div id="how-it-works" className="container mx-auto px-6 max-w-7xl">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <SectionLabel text="Come Funziona" />
                        <h2 className="text-4xl lg:text-5xl font-bold text-stone-900 mb-6 tracking-tight">
                            Da zero a insight in <span className="text-amber-600">4 passi</span>
                        </h2>
                        <p className="text-xl text-stone-600">
                            Non servono competenze tecniche. Tu metti l'obiettivo, l'AI fa il resto.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[
                            { num: '01', title: 'Definisci l\'obiettivo', desc: 'Descrivi cosa vuoi scoprire in linguaggio naturale.' },
                            { num: '02', title: 'L\'AI crea l\'intervista', desc: 'Generazione automatica di domande, tono e logica.' },
                            { num: '03', title: 'Condividi il link', desc: 'Invia via email, social o incorpora nel tuo sito.' },
                            { num: '04', title: 'Ottieni insight', desc: 'Analisi automatica di temi, sentiment e pattern.' }
                        ].map((step, i) => (
                            <div key={i} className="bg-white rounded-3xl p-8 shadow-xl shadow-amber-900/5 border border-amber-900/5 relative group hover:-translate-y-1 transition-transform duration-300">
                                <div className="text-6xl font-bold text-amber-100 mb-6 font-display absolute top-4 right-6 select-none group-hover:text-amber-200 transition-colors">
                                    {step.num}
                                </div>
                                <div className="relative z-10">
                                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                                        <Icons.ArrowRight size={24} className={i === 3 ? '' : '-rotate-45'} />
                                    </div>
                                    <h3 className="text-xl font-bold text-stone-900 mb-3">{step.title}</h3>
                                    <p className="text-stone-600 leading-relaxed">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <WaveSeparator color="#FFFFFF" height={80} />
            </section>

            {/* --- USE CASES (White) --- */}
            <section id="use-cases" className="relative z-10 bg-white py-24 lg:py-32">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="flex flex-col md:flex-row gap-16 items-start">

                        <div className="md:w-1/3 sticky top-32">
                            <SectionLabel text="Casi d'uso" />
                            <h2 className="text-4xl font-bold text-stone-900 mb-6 tracking-tight">Per chi è Business Tuner?</h2>
                            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                                La flessibilità dell'intervistatore AI si adatta a ogni esigenza di ricerca qualitativa, dal prodotto alle risorse umane.
                            </p>
                            <Link href="/register">
                                <Button variant="secondary" className="border-stone-200">
                                    Esplora tutti i casi <Icons.ArrowRight size={16} className="ml-2" />
                                </Button>
                            </Link>
                        </div>

                        <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                                { icon: Icons.Building, title: 'B2B & SaaS', desc: 'Indaga churn, valida feature e capisci i decision maker.' },
                                { icon: Icons.Cart, title: 'E-commerce', desc: 'Feedback post-acquisto, test pricing e packaging.' },
                                { icon: Icons.Users, title: 'HR & Interne', desc: 'Exit interview anonime, clima aziendale e feedback sui manager.' },
                                { icon: Icons.Settings, title: 'Operations', desc: 'Qualifica fornitori, audit di sicurezza e incident reporting.' }
                            ].map((uc, i) => (
                                <div key={i} className="p-8 rounded-3xl bg-stone-50 border border-stone-100 hover:bg-amber-50/50 hover:border-amber-100 transition-colors duration-300">
                                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-stone-900 mb-6">
                                        <uc.icon size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-stone-900 mb-3">{uc.title}</h3>
                                    <p className="text-stone-600 text-sm leading-relaxed">{uc.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <WaveSeparator color="#F59E0B" height={60} />
            </section>

            {/* --- PRICING (Bold Amber) --- */}
            <section id="pricing" className="relative z-10 bg-[#F59E0B] py-24 lg:py-32 text-white overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
                />

                <div className="container mx-auto px-6 max-w-7xl relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <span className="inline-block text-xs font-bold uppercase tracking-widest py-2 px-4 rounded-full mb-6 bg-white/20 text-white">
                            Prezzi Semplici
                        </span>
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
                            Investi nella qualità dei dati
                        </h2>
                        <p className="text-xl text-amber-100">
                            Piani trasparenti. Scala quando vuoi. Disdici quando vuoi.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
                        {/* Starter */}
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 text-white">
                            <h3 className="text-xl font-bold mb-2">Starter</h3>
                            <p className="text-amber-100 text-sm mb-6">Per professionisti e freelance</p>
                            <div className="mb-6"><span className="text-4xl font-bold">€39</span><span className="text-amber-200">/mese</span></div>
                            <ul className="space-y-4 mb-8 text-sm">
                                {['3 interviste attive', '100 risposte/mese', 'Analytics base', 'Export PDF'].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3"><Icons.Check size={16} /> {f}</li>
                                ))}
                            </ul>
                            <Link href="/register?plan=STARTER">
                                <Button fullWidth variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-transparent">Inizia gratis</Button>
                            </Link>
                        </div>

                        {/* Pro (Highlighted) */}
                        <div className="bg-white rounded-[2rem] p-8 shadow-2xl transform lg:scale-105 relative">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-stone-900 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                                Consigliato
                            </div>
                            <h3 className="text-xl font-bold text-stone-900 mb-2">Pro</h3>
                            <p className="text-stone-500 text-sm mb-6">Per PMI e agenzie</p>
                            <div className="mb-6"><span className="text-5xl font-bold text-stone-900">€99</span><span className="text-stone-500">/mese</span></div>
                            <ul className="space-y-4 mb-8 text-sm text-stone-700">
                                {['10 interviste attive', '300 risposte/mese', 'AI Analysis Avanzata', 'Logica condizionale', 'Export CSV + Webhook'].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3"><span className="text-amber-500"><Icons.Check size={18} /></span> {f}</li>
                                ))}
                            </ul>
                            <Link href="/register?plan=PRO">
                                <Button fullWidth className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30">Prova 14 giorni gratis</Button>
                            </Link>
                        </div>

                        {/* Business */}
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 text-white">
                            <h3 className="text-xl font-bold mb-2">Business</h3>
                            <p className="text-amber-100 text-sm mb-6">Per grandi aziende</p>
                            <div className="mb-6"><span className="text-4xl font-bold">€249</span><span className="text-amber-200">/mese</span></div>
                            <ul className="space-y-4 mb-8 text-sm">
                                {['Illimitate interviste', '1.000+ risposte/mese', 'API Access', 'White Label', 'Supporto Prioritario'].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3"><Icons.Check size={16} /> {f}</li>
                                ))}
                            </ul>
                            <Link href="mailto:sales@businesstuner.ai">
                                <Button fullWidth variant="secondary" className="bg-white text-amber-600 border-transparent hover:bg-amber-50">Contattaci</Button>
                            </Link>
                        </div>
                    </div>
                </div>

                <WaveSeparator color="#FFFFFF" height={80} />
            </section>

            {/* --- TESTIMONIALS & FINAL CTA (White) --- */}
            <section className="relative z-10 bg-white py-24 lg:py-32">
                <div className="container mx-auto px-6 max-w-4xl text-center">

                    {/* Testimonial */}
                    <div className="mb-24">
                        <div className="flex justify-center gap-1 mb-6 text-amber-400">
                            {[0, 1, 2, 3, 4].map(i => <Icons.Star key={i} size={24} fill="currentColor" />)}
                        </div>
                        <blockquote className="text-2xl md:text-3xl font-medium text-stone-900 leading-normal mb-8">
                            "Abbiamo raccolto più insight qualitativi in una settimana con Business Tuner che in sei mesi di survey tradizionali."
                        </blockquote>
                        <div className="flex items-center justify-center gap-4">
                            <div className="w-12 h-12 bg-stone-200 rounded-full overflow-hidden">
                                {/* Check if image exists or use initials */}
                                <div className="w-full h-full flex items-center justify-center bg-stone-800 text-white font-bold">MR</div>
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-stone-900">Marco Rossi</div>
                                <div className="text-sm text-stone-500">Head of Product, TechCorp</div>
                            </div>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="bg-stone-900 rounded-[2.5rem] p-12 md:p-20 relative overflow-hidden text-center text-white">
                        <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-black z-0" />
                        <div className="absolute top-0 right-0 p-12 opacity-10">
                            <Icons.Logo size={200} />
                        </div>

                        <div className="relative z-10 max-w-2xl mx-auto">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">Pronto a sintonizzarti?</h2>
                            <p className="text-lg text-stone-400 mb-10">
                                Inizia la tua prova gratuita di 14 giorni. Nessuna carta di credito richiesta.
                            </p>
                            <Link href="/register">
                                <Button size="lg" className="bg-white text-stone-900 hover:bg-stone-100 border-none px-10 py-6 text-lg h-auto">
                                    Inizia ora <Icons.ArrowRight className="ml-2" />
                                </Button>
                            </Link>
                        </div>
                    </div>

                </div>
            </section>

        </div>
    );
}
