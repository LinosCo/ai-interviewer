'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';

// --- Components ---

const SectionLabel = ({ text, color = colors.amberDark, bg = 'rgba(251,191,36,0.1)' }: { text: string, color?: string, bg?: string }) => (
    <span className="inline-block text-xs font-bold uppercase tracking-widest py-2 px-4 rounded-full mb-6" style={{ color, background: bg }}>
        {text}
    </span>
);

export default function LandingPage() {
    const [mounted, setMounted] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const [typewriterText, setTypewriterText] = useState('');
    const [typewriterIndex, setTypewriterIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    const words = ["il mercato", "la filiera", "i reparti", "i dipendenti", "gli stakeholder"];
    const speed = isDeleting ? 50 : 150;

    useEffect(() => {
        setMounted(true);
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleTyping = () => {
            const currentWord = words[typewriterIndex % words.length];
            if (!isDeleting) {
                setTypewriterText(currentWord.substring(0, typewriterText.length + 1));
                if (typewriterText === currentWord) {
                    setTimeout(() => setIsDeleting(true), 1500);
                }
            } else {
                setTypewriterText(currentWord.substring(0, typewriterText.length - 1));
                if (typewriterText === '') {
                    setIsDeleting(false);
                    setTypewriterIndex(typewriterIndex + 1);
                }
            }
        };

        const timer = setTimeout(handleTyping, speed);
        return () => clearTimeout(timer);
    }, [typewriterText, isDeleting, typewriterIndex]);

    return (
        <div className="min-h-screen font-sans bg-white overflow-x-hidden">

            {/* Styles for animation */}
            <style jsx global>{`
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes waveTyping { 0%, 100% { transform: scaleY(0.4); opacity: 0.5; } 50% { transform: scaleY(1); opacity: 1; } }
                @keyframes equalizer {
                    0%, 100% { height: 100%; }
                    50% { height: 40%; }
                }
            `}</style>

            {/* --- MOVING EQUALIZER SEPARATOR --- */}
            <div className="absolute top-0 left-0 right-0 h-1 z-30 flex items-end justify-center gap-[6px] opacity-15 pointer-events-none">
                {Array.from({ length: 60 }).map((_, i) => (
                    <div
                        key={i}
                        className="w-[6px] bg-amber-400 rounded-t-lg"
                        style={{
                            height: `${30 + Math.random() * 40}%`,
                            animation: `equalizer ${4 + Math.random() * 4}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 5}s`
                        }}
                    />
                ))}
            </div>

            {/* --- HERO SECTION (White) --- */}
            <section className="relative z-10 pt-20 pb-32 lg:pt-32 lg:pb-64 min-h-screen flex flex-col bg-gradient-to-b from-white to-amber-50/30">
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

                <div className="container mx-auto px-6 max-w-7xl relative z-50">
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

                            <h1 className="text-5xl lg:text-7xl font-bold text-stone-900 tracking-tight leading-[1.1] mb-8 min-h-[220px]">
                                Ascolta <br />
                                <span className="text-amber-600 inline-block">
                                    {typewriterText}
                                    <span className="animate-pulse">|</span>
                                </span> <br />
                                <span className="text-stone-900">decidi meglio.</span>
                            </h1>

                            <p className="text-xl text-stone-600 leading-relaxed mb-10 max-w-lg">
                                Raccogli feedback dai tuoi stakeholder con conversazioni guidate dall'AI. Più profondo di un form. Più scalabile di un'intervista.
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

                        <div
                            className={`relative hidden lg:block transition-all duration-1000 delay-200 ease-out ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
                        >
                            <div className="relative z-10 bg-white shadow-2xl rounded-[2rem] p-6 border border-stone-100 animate-[float_6s_ease-in-out_infinite]">
                                <div className="space-y-6">
                                    <div className="bg-stone-50 p-4 rounded-2xl rounded-tl-none text-stone-800 text-lg shadow-sm border border-stone-100">
                                        Qual è il tuo obiettivo?
                                    </div>
                                    <div className="flex justify-end">
                                        <div className="bg-amber-100 text-amber-900 p-4 rounded-2xl rounded-tr-none text-lg shadow-sm border border-amber-200">
                                            Ok, indagherò i punti di attrito nel processo di pagamento.
                                        </div>
                                    </div>
                                    <div className="bg-stone-50 p-4 rounded-2xl rounded-tl-none text-stone-800 text-lg shadow-sm border border-stone-100">
                                        L'utente risponde...
                                    </div>
                                    <div className="flex justify-end">
                                        <div className="bg-amber-100 text-amber-900 p-4 rounded-2xl rounded-tr-none text-lg shadow-sm border border-amber-200">
                                            Quale campo specifico ti è sembrato più superfluo?
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
                    <div className="flex items-end justify-center gap-[6px] h-32 opacity-20 px-4">
                        {Array.from({ length: 60 }).map((_, i) => (
                            <div
                                key={i}
                                className="w-[8px] bg-white rounded-t-xl"
                                style={{
                                    height: `${20 + Math.sin(i / 5) * 30 + Math.random() * 30}%`,
                                    animation: `equalizer ${3 + Math.random() * 5}s ease-in-out infinite`,
                                    animationDelay: `${Math.random() * 5}s`
                                }}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* --- WHAT IS (Light Warm Background) --- */}
            <section className="relative z-20 bg-[#FFFBEB] py-16 lg:py-24 overflow-hidden">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <SectionLabel text="Cos'è Business Tuner" />
                            <h2 className="text-4xl lg:text-5xl font-bold text-stone-900 mb-8 tracking-tight">
                                Un nuovo modo di <span className="text-amber-600">raccogliere feedback</span>
                            </h2>
                            <p className="text-xl text-stone-600 leading-relaxed mb-8">
                                Business Tuner non è un questionario e non è un'intervista tradizionale.
                            </p>
                            <p className="text-lg text-stone-600 leading-relaxed mb-8">
                                È una <strong className="text-amber-900 font-bold underline decoration-amber-500/30 decoration-4 underline-offset-4">conversazione guidata</strong> che si adatta a chi risponde: fa domande aperte, approfondisce quando serve, e ti restituisce insight organizzati.
                            </p>
                            <p className="text-lg text-stone-600 leading-relaxed">
                                Funziona come un collaboratore che fa le domande giuste al posto tuo, senza i costi e i tempi di una ricerca tradizionale.
                            </p>
                            <div className="mt-10">
                                <Link href="/methodology">
                                    <button className="flex items-center gap-2 text-amber-700 font-bold hover:gap-3 transition-all underline decoration-amber-500/30 decoration-2 underline-offset-4">
                                        Scopri la nostra metodologia <Icons.ArrowRight size={20} />
                                    </button>
                                </Link>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-amber-100 relative z-10">
                                <div className="space-y-6">
                                    {[
                                        { q: "Qual è il tuo obiettivo?", a: "Voglio capire perché i clienti abbandonano il checkout." },
                                        { q: "L'AI genera l'intervista...", a: "Ok, indagherò i punti di attrito nel processo di pagamento." },
                                        { q: "L'utente risponde...", a: "Il form è troppo lungo." },
                                        { q: "L'AI approfondisce...", a: "Quale campo specifico ti è sembrato più superfluo?" }
                                    ].map((chat, i) => (
                                        <div key={i} className={`flex ${i % 2 !== 0 ? 'justify-end' : ''}`}>
                                            <div className={`max-w-[80%] p-4 rounded-2xl ${i % 2 !== 0 ? 'bg-amber-100 text-amber-900 rounded-tr-none' : 'bg-stone-100 text-stone-900 rounded-tl-none'}`}>
                                                <p className="text-sm">{i % 2 === 0 ? chat.q : chat.a}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Decorative background element */}
                            <div className="absolute -inset-4 bg-amber-500/10 rounded-[4rem] blur-3xl -z-10 animate-pulse" />
                        </div>
                    </div>
                </div>
            </section>

            {/* --- STATS & HOW IT WORKS (Light Warm Background) --- */}
            <section className="relative z-20 bg-[#FFFBEB] py-24 lg:py-32">

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

            </section>

            {/* --- USE CASES (White) --- */}
            <section id="use-cases" className="relative z-20 bg-white py-24 lg:py-32">
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


        </div>

        {/* --- DASHBOARD & ANALYTICS PREVIEW (Amber-50) --- */ }
    <section className="relative z-20 bg-amber-50 py-24 lg:py-32 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-20">
                <SectionLabel text="Potenza Lab" />
                <h2 className="text-4xl lg:text-5xl font-bold text-stone-900 mb-6 tracking-tight">
                    Una dashboard per <span className="text-amber-600">tutto il team</span>
                </h2>
                <p className="text-xl text-stone-600">
                    Gestisci i tuoi bot, analizza i risultati in tempo reale e trasforma i dati in decisioni.
                </p>
            </div>

            <div className="space-y-32">
                {/* Dashboard Feature */}
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <div className="order-2 lg:order-1">
                        <div className="bg-white rounded-3xl p-4 shadow-2xl border border-amber-100 transform -rotate-2">
                            <div className="bg-stone-50 rounded-2xl overflow-hidden border border-stone-100 aspect-[16/10] relative">
                                {/* Mockup Dashboard Content */}
                                <div className="p-6 bg-white border-b border-stone-100 flex items-center justify-between">
                                    <div className="flex gap-4">
                                        <div className="w-3 h-3 rounded-full bg-red-400" />
                                        <div className="w-3 h-3 rounded-full bg-amber-400" />
                                        <div className="w-3 h-3 rounded-full bg-green-400" />
                                    </div>
                                    <div className="h-6 w-40 bg-stone-100 rounded-full" />
                                </div>
                                <div className="p-8 grid grid-cols-2 gap-6">
                                    <div className="space-y-6">
                                        <div className="h-32 bg-amber-50 rounded-2xl border border-amber-100 p-6 flex flex-col justify-end">
                                            <div className="text-amber-800 font-bold text-2xl">42</div>
                                            <div className="text-amber-600 text-sm">Interviste Attive</div>
                                        </div>
                                        <div className="h-32 bg-stone-100 rounded-2xl p-6" />
                                    </div>
                                    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
                                        <div className="h-4 w-1/2 bg-stone-100 rounded mb-4" />
                                        <div className="space-y-3">
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} className="h-3 bg-stone-50 rounded" />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="order-1 lg:order-2">
                        <h3 className="text-3xl font-bold text-stone-900 mb-6">Centralizza la tua ricerca</h3>
                        <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                            Crea progetti dedicati per diversi reparti o obiettivi. Invita i colleghi, monitora i progressi e gestisci la libreria dei tuoi bot da un unico posto.
                        </p>
                        <ul className="space-y-4">
                            {[
                                'Gestione progetti granulare',
                                'Accesso multi-utente',
                                'Template personalizzati',
                                'Webhook & Integrazioni'
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-stone-700 font-medium">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                        <Icons.Check size={14} />
                                    </div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Analytics Feature */}
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h3 className="text-3xl font-bold text-stone-900 mb-6">Risultati, non dati grezzi</h3>
                        <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                            Non perdere tempo a leggere centinaia di trascrizioni. La nostra AI identifica automaticamente i temi ricorrenti e trasforma il rumore in insight azionabili.
                        </p>
                        <ul className="space-y-4">
                            {[
                                { t: 'Temi ricorrenti', d: 'Identifica pattern e raggruppa le risposte per tema.' },
                                { t: 'Citazioni chiave', d: 'Le frasi più significative, già estratte e categorizzate.' },
                                { t: 'Sentiment analysis', d: 'Capisci l\'umore generale e le aree critiche.' },
                                { t: 'Export flessibile', d: 'CSV per i numeri, report PDF per la presentazione.' }
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-stone-700">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Icons.Check size={14} />
                                    </div>
                                    <div>
                                        <div className="font-bold">{item.t}</div>
                                        <div className="text-sm text-stone-500">{item.d}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <div className="bg-white rounded-3xl p-4 shadow-2xl border border-amber-100 transform rotate-2">
                            <div className="bg-stone-50 rounded-2xl overflow-hidden border border-stone-100 p-8 aspect-[16/10] relative">
                                <div className="flex justify-between items-end h-full gap-4">
                                    {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                                        <div key={i} className="w-full bg-amber-200 rounded-t-lg transition-all duration-1000" style={{ height: `${h}%` }} />
                                    ))}
                                </div>
                                <div className="absolute top-8 left-8 right-8">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                                            <Icons.Zap size={20} />
                                        </div>
                                        <div className="font-bold text-stone-800">Insight Extraction</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                                        <div className="text-xs text-amber-600 font-black uppercase mb-1">Punto Critico</div>
                                        <div className="text-sm text-stone-800 italic">"Il processo di checkout richiede troppi passaggi inutili."</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {/* --- POSITIONING DETAILS (White) --- */ }
    <section className="relative z-20 bg-white py-24 lg:py-32">
        <div className="container mx-auto px-6 max-w-7xl">
            <div className="grid md:grid-cols-2 gap-16">
                {/* Per chi è */}
                <div className="space-y-12">
                    <div>
                        <h2 className="text-4xl font-bold text-stone-900 mb-8 tracking-tight">Perfetto quando...</h2>
                        <div className="space-y-8">
                            {[
                                { title: 'Hai bisogno di capire il "perché"', desc: 'I numeri dicono cosa succede, non perché. Business Tuner raccoglie le motivazioni, le frustrazioni e i suggerimenti.' },
                                { title: 'I form non bastano più', desc: 'Le risposte a crocette non ti danno abbastanza profondità. Ma non hai budget per interviste uno-a-uno.' },
                                { title: 'Vuoi scalare senza perdere qualità', desc: 'Devi parlare con 50, 100 o 500 persone. Impossibile farlo manualmente, deprimente farlo con un form standard.' },
                                { title: 'Il tempo è poco', desc: 'Lanci un\'intervista in 10 minuti. I risultati arrivano in giorni, non settimane.' }
                            ].map((item, i) => (
                                <div key={i}>
                                    <h4 className="text-xl font-bold text-stone-900 mb-2">{item.title}</h4>
                                    <p className="text-stone-600 leading-relaxed text-lg">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Cosa non è */}
                <div className="bg-stone-50 rounded-[3rem] p-12 lg:p-16 border border-stone-100">
                    <h2 className="text-4xl font-bold text-stone-900 mb-8 tracking-tight">Trasparenza prima di tutto</h2>
                    <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                        Business Tuner è uno strumento potente, ma non sostituisce tutto. Ecco cosa <strong>non</strong> può fare:
                    </p>
                    <div className="space-y-8">
                        {[
                            { title: 'Non sostituisce interviste professionali', desc: 'Per ricerche che richiedono rapport umano, sensibilità culturale o approfondimenti etnografici complessi, serve un ricercatore qualificato.' },
                            { title: 'Non produce campioni statistici', desc: 'I risultati sono qualitativi. Se cerchi significatività statistica decimale, usa strumenti quantitativi.' },
                            { title: 'Non legge la mente', desc: 'L\'AI fa domande intelligenti, ma la qualità degli insight dipende da come progetti l\'intervista e da chi la riceve.' }
                        ].map((item, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="mt-1"><Icons.X size={20} className="text-red-500" /></div>
                                <div>
                                    <h4 className="text-lg font-bold text-stone-900 mb-1">{item.title}</h4>
                                    <p className="text-stone-600 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </section>

    {/* --- FAQ SECTION (Amber-50) --- */ }
    <section className="relative z-20 bg-amber-50 py-24 lg:py-32">
        <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-16">
                <SectionLabel text="Domande Frequenti" />
                <h2 className="text-4xl font-bold text-stone-900 tracking-tight">Hai dubbi? Abbiamo risposte.</h2>
            </div>

            <div className="space-y-6">
                {[
                    { q: "Cos'è esattamente il feedback conversazionale?", a: "È un approccio ibrido che usa l'AI per condurre interviste strutturate ma flessibili. L'AI capisce la risposta dell'utente e, se necessario, pone domande di approfondimento per chiarire i concetti." },
                    { q: "Qual è la differenza rispetto a un Typeform o Google Form?", a: "In un form le domande sono fisse. Con Business Tuner, se un utente dice 'Il prodotto è difficile da usare', l'AI chiederà 'In quale parte specifica hai trovato difficoltà?'. Questo permette di raccogliere dettagli che andrebbero persi." },
                    { q: "Posso esportare i dati?", a: "Certamente. Puoi esportare le trascrizioni complete, i temi estratti in CSV o generare un report PDF pronto da presentare agli stakeholder." },
                    { q: "L'AI è sicura e rispetta la privacy?", a: "Sì. Implementiamo livelli di anonimizzazione configurabili e i dati vengono utilizzati esclusivamente per generare i tuoi report. Non vendiamo dati a terzi." },
                    { q: "Quanto tempo serve per creare un bot?", a: "Meno di 10 minuti. Puoi descrivere il tuo obiettivo in linguaggio naturale e l'AI genererà per te l'intero flusso di domande e argomenti." },
                    { q: "Come faccio a fidarmi delle risposte?", a: "La qualità degli insight dipende da tre fattori: come progetti l'intervista, chi la riceve, e come la presenti. Ti forniamo template collaudati e strumenti per calibrare tono e domande, ma come ogni ricerca qualitativa, il contesto è fondamentale." },
                    { q: "È statisticamente significativo?", a: "No, e non deve esserlo. Business Tuner raccoglie insight qualitativi: il 'perché', non il 'quanto'. Se ti serve sapere che il 73% dei clienti preferisce un'opzione, usa un survey quantitativo. Se vuoi capire perché lo preferiscono, usa Business Tuner." },
                    { q: "L'AI può davvero capire le risposte?", a: "L'AI è molto brava a identificare pattern, estrarre temi ricorrenti e riconoscere sentiment. Per sfumature culturali o emozioni complesse, puoi sempre leggere le trascrizioni originali e complete fornite nei report." }
                ].map((faq, i) => (
                    <details key={i} className="group bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                        <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                            <h4 className="font-bold text-stone-900 pr-4">{faq.q}</h4>
                            <Icons.ArrowRight size={20} className="text-amber-500 transform group-open:rotate-90 transition-transform duration-300" />
                        </summary>
                        <div className="px-6 pb-6 text-stone-600 leading-relaxed border-t border-stone-50 pt-4">
                            {faq.a}
                        </div>
                    </details>
                ))}
            </div>
        </div>
    </section>

    {/* --- PRICING (Bold Amber) --- */ }
    <section id="pricing" className="relative z-20 bg-[#F59E0B] py-24 lg:py-32 text-white overflow-hidden">
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
                    <div className="mb-6"><span className="text-4xl font-bold">€49</span><span className="text-amber-200">/mese</span></div>
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
                    <div className="mb-6"><span className="text-5xl font-bold text-stone-900">€149</span><span className="text-stone-500">/mese</span></div>
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
                    <div className="mb-6"><span className="text-4xl font-bold">€299</span><span className="text-amber-200">/mese</span></div>
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

    {/* --- TESTIMONIALS & FINAL CTA (White) --- */ }
    <section className="relative z-20 bg-white py-24 lg:py-32">
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

        </div >
    );
}
