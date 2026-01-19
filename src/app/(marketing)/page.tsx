'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, gradients, shadows, radius } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { PLANS, PlanType } from '@/config/plans';

// --- Components ---

const WaveSeparator = ({
    position = 'bottom',
    color = '#FFFBEB',
    height = 60,
    className = '',
    flip = false,
}: {
    position?: 'top' | 'bottom' | 'relative',
    color?: string,
    height?: number,
    className?: string,
    flip?: boolean
}) => {
    const isAbsolute = position !== 'relative';
    return (
        <div
            className={className}
            style={{
                ...(isAbsolute ? {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    [position]: 0,
                } : {
                    position: 'relative',
                    width: '100%',
                }),
                height: `${height}px`,
                zIndex: isAbsolute ? 0 : undefined,
                transform: `${position === 'top' ? 'rotate(180deg)' : ''} ${flip ? 'scaleX(-1)' : ''}`,
                pointerEvents: 'none',
            }}
        >
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
};

const SectionLabel = ({ text, color = colors.amberDark, bg = 'rgba(245, 158, 11, 0.1)' }: { text: string, color?: string, bg?: string }) => (
    <motion.span
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="inline-block text-xs font-bold uppercase tracking-widest py-2 px-4 rounded-full mb-6"
        style={{ color, background: bg }}
    >
        {text}
    </motion.span>
);

const FeatureIcon = ({ icon: Icon, color = colors.amber }: { icon: any, color?: string }) => (
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-stone-100 bg-white" style={{ color }}>
        <Icon size={24} />
    </div>
);

// --- Sections ---

export default function LandingPage() {
    const { data: session } = useSession();
    const [isYearly, setIsYearly] = useState(true);

    return (
        <div className="bg-white overflow-x-hidden">
            <style jsx global>{`
                .glass {
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                .text-gradient {
                    background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
            `}</style>

            {/* 1. HERO SECTION */}
            <section className="relative pt-20 pb-40 lg:pt-32 lg:pb-60 bg-gradient-to-b from-white to-amber-50/30 overflow-hidden">
                <div className="container mx-auto px-6 max-w-7xl relative z-10">
                    <div className="text-center max-w-4xl mx-auto">
                        <SectionLabel text="Piattaforma di Business Intelligence Qualitativa" />

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-5xl lg:text-8xl font-black text-stone-900 leading-[1] mb-8 tracking-tighter"
                        >
                            Ascolta il mercato. <br />
                            <span className="text-gradient">Decidi meglio.</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-xl lg:text-2xl text-stone-600 leading-relaxed mb-12 max-w-3xl mx-auto"
                        >
                            Interviste AI, chatbot intelligente e monitoraggio reputazione in un'unica piattaforma. Per PMI che vogliono capire clienti, mercato e concorrenza.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
                        >
                            <Link href="/register">
                                <Button size="lg" withShimmer className="px-10 py-7 text-lg h-auto rounded-full">
                                    Inizia gratis <Icons.ArrowRight className="ml-2" />
                                </Button>
                            </Link>
                            <Link href="/onboarding/preview">
                                <Button variant="secondary" size="lg" className="px-10 py-7 text-lg h-auto rounded-full bg-stone-100 hover:bg-stone-200 border-transparent text-stone-900">
                                    <Icons.Play className="mr-2" /> Guarda la demo
                                </Button>
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex flex-wrap justify-center gap-8 text-stone-400 text-sm font-medium"
                        >
                            <span className="flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Setup in 5 minuti</span>
                            <span className="flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 50 interviste gratis</span>
                            <span className="flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Nessuna carta richiesta</span>
                        </motion.div>

                        {/* Integration Diagram */}
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="mt-24 relative max-w-2xl mx-auto"
                        >
                            <div className="flex justify-between items-center relative z-10">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center border border-amber-100 group hover:scale-110 transition-transform cursor-default">
                                        <Icons.MessageSquare size={32} className="text-amber-500" />
                                    </div>
                                    <span className="text-xs font-bold text-stone-500 tracking-wider">INTERVIEW</span>
                                </div>

                                <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-100 via-amber-200 to-amber-100 mx-4 relative">
                                    <Icons.ArrowRight className="absolute -right-2 -top-2 text-amber-200" size={16} />
                                </div>

                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center border border-amber-100 group hover:scale-110 transition-transform cursor-default">
                                        <Icons.Bot size={32} className="text-amber-500" />
                                    </div>
                                    <span className="text-xs font-bold text-stone-500 tracking-wider">CHATBOT</span>
                                </div>

                                <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-100 via-amber-200 to-amber-100 mx-4 relative">
                                    <Icons.ArrowRight className="absolute -right-2 -top-2 text-amber-200" size={16} />
                                </div>

                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center border border-amber-100 group hover:scale-110 transition-transform cursor-default">
                                        <Icons.Search size={32} className="text-amber-500" />
                                    </div>
                                    <span className="text-xs font-bold text-stone-500 tracking-wider">VISIBILITY</span>
                                </div>
                            </div>

                            <div className="mt-12 flex flex-col items-center">
                                <div className="w-0.5 h-12 bg-amber-100 relative">
                                    <Icons.ArrowRight className="absolute -bottom-2 -left-2 rotate-90 text-amber-200" size={16} />
                                </div>
                                <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-[2rem] p-6 px-12 shadow-2xl mt-4 border border-stone-700 flex items-center gap-4 group hover:scale-105 transition-transform duration-500">
                                    <Icons.Layers size={24} className="text-amber-500" />
                                    <span className="text-lg font-bold tracking-tight">Unified Insight Hub</span>
                                </div>
                            </div>

                            {/* Decorative Blobs */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-amber-500/5 blur-[120px] -z-10 rounded-full" />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 2. PROBLEM / SOLUTION */}
            <section className="py-32 bg-white relative">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="grid lg:grid-cols-2 gap-24 items-center">
                        <div>
                            <SectionLabel text="Il problema delle PMI" />
                            <h2 className="text-4xl lg:text-5xl font-bold text-stone-900 mb-8 tracking-tight">
                                Perché ascoltare il mercato costa così tanto?
                            </h2>
                            <p className="text-lg text-stone-600 mb-12 leading-relaxed">
                                Le grandi aziende spendono oltre €50.000 all'anno in strumenti isolati.
                                Le PMI hanno le stesse esigenze ma non possono permettersi budget enterprise o team di analisti dedicati.
                            </p>

                            <div className="space-y-6">
                                {[
                                    { label: 'Feedback Clienti', traditional: '€5.000-20.000 / anno', tuner: 'Incluso' },
                                    { label: 'Supporto AI', traditional: '€200+ / mese', tuner: 'Incluso' },
                                    { label: 'Reputazione & Visibility', traditional: '€150+ / mese', tuner: 'Incluso' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 px-6 bg-stone-50 rounded-2xl border border-stone-100">
                                        <span className="font-bold text-stone-800">{item.label}</span>
                                        <div className="text-right">
                                            <div className="text-xs text-stone-400 line-through mb-1">{item.traditional}</div>
                                            <div className="text-amber-600 font-black">{item.tuner}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-3xl font-bold mb-8">Business Tuner: Tutto Integrato</h3>
                                <p className="text-amber-50 mb-10 text-lg">
                                    Un unico ecosistema che automatizza la raccolta dati e li trasforma in azioni.
                                </p>

                                <ul className="space-y-6">
                                    <li className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0"><Icons.Check size={20} /></div>
                                        <div>
                                            <div className="font-bold">Interview AI: 70%+ completion</div>
                                            <div className="text-sm text-amber-100">Conversazioni profonde, non semplici form.</div>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0"><Icons.Check size={20} /></div>
                                        <div>
                                            <div className="font-bold">Chatbot Intelligence</div>
                                            <div className="text-sm text-amber-100">Rileva lacune e suggerisce FAQ in automatico.</div>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0"><Icons.Check size={20} /></div>
                                        <div>
                                            <div className="font-bold">Visibility Tracker</div>
                                            <div className="text-sm text-amber-100">Cosa dicono di te ChatGPT e i forum di settore.</div>
                                        </div>
                                    </li>
                                </ul>

                                <div className="mt-12 pt-12 border-t border-white/20">
                                    <div className="text-sm text-amber-200 uppercase font-black tracking-widest mb-2">Prezzo unico</div>
                                    <div className="text-5xl font-black">da €49<span className="text-xl font-medium">/mese</span></div>
                                </div>
                            </div>
                            <Icons.Logo className="absolute -bottom-20 -right-20 opacity-10" size={400} />
                        </div>
                    </div>
                </div>
            </section>

            <WaveSeparator color="#FAFAF8" height={100} />

            {/* 3. THE THREE TOOLS SECTION */}
            <section className="py-32 bg-[#FAFAF8] relative">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="text-center max-w-3xl mx-auto mb-24">
                        <SectionLabel text="I nostri strumenti" />
                        <h2 className="text-4xl lg:text-6xl font-black text-stone-900 mb-6 tracking-tight">
                            Tre motori per la tua <span className="text-gradient">intelligenza aziendale</span>
                        </h2>
                    </div>

                    {/* Tool 1: Interview AI */}
                    <div className="grid lg:grid-cols-2 gap-20 items-center mb-40">
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg"><Icons.MessageSquare size={24} /></div>
                                <h3 className="text-3xl font-bold text-stone-900 tracking-tight">Interview AI</h3>
                            </div>
                            <h4 className="text-xl text-stone-900 font-bold mb-6">Conversazioni che vanno in profondità.</h4>
                            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                                L'AI conduce interviste strutturate ma flessibili. Fa follow-up intelligenti, adatta il tono all'interlocutore e non ripete mai la stessa domanda.
                            </p>

                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                                    <div className="text-3xl font-black text-amber-500 mb-1">70%+</div>
                                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">Completion Rate</div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                                    <div className="text-3xl font-black text-amber-500 mb-1">10x</div>
                                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">Più economico</div>
                                </div>
                            </div>

                            <ul className="space-y-4 mb-10">
                                {['Generazione automatica domande da obiettivo', 'Memory Manager: evita ripetizioni frustranti', 'Tone Analyzer: formale, amichevole, diretto'].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-stone-700 font-medium">
                                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0"><Icons.Check size={12} /></div>
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <div className="text-sm font-bold text-amber-600">Disponibile da: <span className="px-2 py-1 bg-amber-50 rounded">Free Plan</span></div>
                        </div>

                        <div className="relative">
                            <div className="bg-stone-900 rounded-[2.5rem] p-8 shadow-2xl relative z-10 text-white border border-stone-800">
                                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
                                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center"><Icons.Bot size={16} /></div>
                                    <span className="font-bold">Interview AI</span>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <div className="text-xs text-stone-400 uppercase font-bold tracking-widest">AI: Domanda</div>
                                        <div className="bg-stone-800 p-4 rounded-2xl rounded-tl-none border border-stone-700 leading-relaxed">
                                            "Cosa ti ha portato a scegliere il nostro servizio?"
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 items-end">
                                        <div className="text-xs text-stone-400 uppercase font-bold tracking-widest">Utente</div>
                                        <div className="bg-amber-500 p-4 rounded-2xl rounded-tr-none font-medium leading-relaxed">
                                            "Cercavo più flessibilità..."
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="text-xs text-stone-400 uppercase font-bold tracking-widest">AI: Deep Probe</div>
                                        <div className="bg-stone-800 p-4 rounded-2xl rounded-tl-none border border-stone-700 leading-relaxed border-l-2 border-l-amber-500">
                                            "In che senso flessibilità? Puoi farmi un esempio di una situazione in cui ne hai avuto bisogno?"
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Decorative shadow */}
                            <div className="absolute -inset-10 bg-amber-500/10 blur-[80px] -z-10 rounded-full" />
                        </div>
                    </div>

                    {/* Tool 2: Chatbot Intelligence */}
                    <div className="grid lg:grid-cols-2 gap-20 items-center mb-40">
                        <div className="order-2 lg:order-1 relative">
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl relative z-10 border border-amber-100 overflow-hidden">
                                <div className="bg-amber-50/50 -mx-8 -mt-8 p-6 border-b border-amber-100 mb-8">
                                    <div className="flex justify-between items-center">
                                        <div className="font-bold text-amber-900">Analytics Insights</div>
                                        <div className="text-xs font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-full uppercase">Real-time</div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div>
                                        <div className="flex justify-between mb-4">
                                            <span className="text-sm font-bold text-stone-400 uppercase">Top Domande</span>
                                            <span className="text-sm font-bold text-stone-400 uppercase">Gaps</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-stone-400 font-bold">1.</span>
                                                    <span className="font-bold text-stone-800">"Quanto costa?"</span>
                                                </div>
                                                <Icons.Check className="text-green-500" size={16} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-stone-400 font-bold">2.</span>
                                                    <span className="font-bold text-stone-800">"Shopify?"</span>
                                                </div>
                                                <div className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded">GAP</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center"><Icons.Bot size={16} /></div>
                                            <div className="font-bold text-amber-900 text-sm">FAQ Suggerita</div>
                                        </div>
                                        <p className="text-xs text-amber-800 mb-6 italic">"Questa settimana 23 persone hanno chiesto dell'integrazione Shopify. Vuoi che generi una risposta basata su..."</p>
                                        <div className="flex gap-2">
                                            <button className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">✅ Approva</button>
                                            <button className="flex-1 py-2 rounded-lg bg-white text-amber-600 text-xs font-bold border border-amber-200 hover:bg-amber-50">Modifica</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -inset-10 bg-amber-500/5 blur-[80px] -z-10 rounded-full" />
                        </div>

                        <div className="order-1 lg:order-2">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg"><Icons.Bot size={24} /></div>
                                <h3 className="text-3xl font-bold text-stone-900 tracking-tight">Chatbot Intelligence</h3>
                            </div>
                            <h4 className="text-xl text-stone-900 font-bold mb-6">Supporto clienti che impara dai silenzi.</h4>
                            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                                Molto più di un assistente AI. Business Tuner identifica cosa non sa rispondere e ti suggerisce come migliorare la knowledge base analizzando i trend reali.
                            </p>

                            <ul className="space-y-6 mb-10">
                                <li className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-1"><Icons.Check size={14} /></div>
                                    <div>
                                        <div className="font-bold text-stone-900 uppercase text-xs tracking-widest mb-1">Knowledge Gap Detection</div>
                                        <div className="text-sm text-stone-500 leading-relaxed">Analisi semantica dei messaggi senza risposta. Nessuna domanda va persa.</div>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-1"><Icons.Check size={14} /></div>
                                    <div>
                                        <div className="font-bold text-stone-900 uppercase text-xs tracking-widest mb-1">FAQ Proattive</div>
                                        <div className="text-sm text-stone-500 leading-relaxed">Trasforma le richieste ricorrenti in risorse knowledge base in un click.</div>
                                    </div>
                                </li>
                            </ul>

                            <div className="text-sm font-bold text-amber-600">Disponibile da: <span className="px-2 py-1 bg-amber-50 rounded">Starter Plan (€49/mo)</span></div>
                        </div>
                    </div>

                    {/* Tool 3: Visibility Tracker */}
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg"><Icons.Search size={24} /></div>
                                <h3 className="text-3xl font-bold text-stone-900 tracking-tight">Visibility Tracker</h3>
                            </div>
                            <h4 className="text-xl text-stone-900 font-bold mb-6">Cosa dicono di te online e sull'AI.</h4>
                            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                                Monitora come appari su ChatGPT, Claude, forum e blog. Se qualcuno chiede una soluzione nel tuo settore, assicurati di essere menzionato.
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-10">
                                <div className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
                                    <div className="font-bold text-stone-900 text-sm mb-2">AI Perception</div>
                                    <div className="text-xs text-stone-500">ChatGPT, Claude, Gemini, Perplexity</div>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
                                    <div className="font-bold text-stone-900 text-sm mb-2">Web Presence</div>
                                    <div className="text-xs text-stone-500">Google News, Reddit, Forum di settore</div>
                                </div>
                            </div>

                            <p className="text-sm text-stone-500 italic mb-10">
                                "Il 40% delle ricerche B2B oggi inizia su un'interfaccia AI. Se ChatGPT non ti conosce, non esisti."
                            </p>

                            <div className="text-sm font-bold text-amber-600">Disponibile da: <span className="px-2 py-1 bg-amber-50 rounded">Pro Plan (€149/mo)</span></div>
                        </div>

                        <div className="relative">
                            <div className="bg-stone-50 rounded-[2.5rem] p-8 shadow-2xl relative z-10 border border-stone-200">
                                <div className="grid grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-4">
                                        <div className="text-[10px] font-black tracking-widest text-stone-400 uppercase">AI Perception</div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs font-bold p-2 bg-white rounded-lg border border-stone-200">
                                                <span>ChatGPT</span>
                                                <span className="text-amber-600">Pos. #2</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs font-bold p-2 bg-white rounded-lg border border-stone-200">
                                                <span>Claude</span>
                                                <span className="text-amber-600">Pos. #1</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs font-bold p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                                <span>Gemini</span>
                                                <span className="text-red-500">N.C. ⚠️</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="text-[10px] font-black tracking-widest text-stone-400 uppercase">Web mentions</div>
                                        <div className="space-y-2">
                                            <div className="p-2 bg-white rounded-lg border border-stone-200">
                                                <div className="text-[10px] text-stone-400 uppercase">Reddit</div>
                                                <div className="text-[11px] font-bold text-stone-800 line-clamp-1">"Miglior software per..."</div>
                                            </div>
                                            <div className="p-2 bg-white rounded-lg border border-stone-200">
                                                <div className="text-[10px] text-stone-400 uppercase">Google News</div>
                                                <div className="text-[11px] font-bold text-stone-800 line-clamp-1">"Startup innovativa..."</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-stone-900 rounded-2xl p-4 text-white">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-[10px] font-bold text-stone-500 uppercase">Report Settimanale</div>
                                        <Icons.ArrowRight size={14} className="text-amber-500" />
                                    </div>
                                    <div className="text-sm font-bold mb-1">🔥 Opportunità</div>
                                    <p className="text-[11px] text-stone-400">3 blog post parlano del Tuo Competitor X ma non di te. Vuoi che generi un prompt per contattarli?</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. CROSS-CHANNEL INSIGHT SECTION */}
            <section className="py-40 bg-white overflow-hidden relative">
                <div className="container mx-auto px-6 max-w-7xl relative z-10">
                    <div className="grid lg:grid-cols-2 gap-24 items-center">
                        <div className="relative">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex flex-col items-center justify-center text-center group hover:bg-amber-100 transition-colors cursor-default">
                                    <Icons.MessageSquare size={32} className="text-amber-500 mb-4" />
                                    <div className="text-xs font-black text-amber-900 uppercase">Interviews</div>
                                    <div className="text-stone-500 text-[10px] mt-1 italic">"Il checkout è lungo"</div>
                                </div>
                                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex flex-col items-center justify-center text-center group hover:bg-amber-100 transition-colors cursor-default">
                                    <Icons.Bot size={32} className="text-amber-500 mb-4" />
                                    <div className="text-xs font-black text-amber-900 uppercase">Chatbot</div>
                                    <div className="text-stone-500 text-[10px] mt-1 italic">47 domande sul checkout</div>
                                </div>
                                <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex flex-col items-center justify-center text-center group hover:bg-amber-100 transition-colors cursor-default">
                                    <Icons.Search size={32} className="text-amber-500 mb-4" />
                                    <div className="text-xs font-black text-amber-900 uppercase">Visibility</div>
                                    <div className="text-stone-500 text-[10px] mt-1 italic">Competitor parla di checkout</div>
                                </div>
                                <div className="bg-amber-50 p-6 rounded-[2rem] border border-stone-200 flex flex-col items-center justify-center text-center group hover:scale-105 transition-transform">
                                    <div className="text-3xl font-black text-amber-600">!</div>
                                    <div className="text-xs font-black text-amber-900 uppercase">Topic Hub</div>
                                </div>
                            </div>

                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ repeat: Infinity, duration: 4 }}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 px-8 bg-stone-900 text-white rounded-full shadow-2xl border border-stone-700 font-bold tracking-tight text-center whitespace-nowrap"
                            >
                                <span className="text-amber-500 mr-2">Critical Insight:</span> "Problema Checkout"
                            </motion.div>
                        </div>

                        <div>
                            <SectionLabel text="Cross-Channel Insights" color="#F59E0B" bg="rgba(245, 158, 11, 0.05)" />
                            <h2 className="text-4xl lg:text-5xl font-black text-stone-900 mb-8 tracking-tight">
                                Quando i tuoi strumenti <br /><span className="text-gradient">parlano tra loro</span>
                            </h2>
                            <p className="text-xl text-stone-600 mb-12 leading-relaxed">
                                Il vero differenziatore: colleghiamo i puntini per te. Se un tema emerge ovunque, te lo segnaliamo con priorità alta e azioni concrete suggerite in tempo reale.
                            </p>

                            <div className="space-y-6">
                                {[
                                    { t: 'Priorità unificata', d: 'Più un tema appare su diversi canali, più il sistema lo spinge in alto.' },
                                    { t: 'Azioni suggerite', d: 'Ti suggeriamo FAQ, script per post social o nuovi prompt visibility.' },
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-4 p-6 bg-stone-50 rounded-2xl border border-stone-100 cursor-default hover:bg-amber-50 hover:border-amber-200 transition-colors">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0"><Icons.Zap size={18} /></div>
                                        <div>
                                            <div className="font-bold text-stone-900 mb-1">{item.t}</div>
                                            <div className="text-sm text-stone-500">{item.d}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-amber-50/20 to-transparent -z-10" />
            </section>

            {/* 5. HOW IT WORKS */}
            <section id="how-it-works" className="py-32 bg-[#FAFAF8]">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <SectionLabel text="Workflow" />
                        <h2 className="text-4xl font-bold text-stone-900 tracking-tight mb-4">Inizia in 3 passi</h2>
                        <p className="text-stone-500 text-lg">La potenza dell'AI al servizio del tuo business, senza complessità.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-12 left-20 right-20 h-0.5 bg-dashed bg-stone-200 -z-0"
                            style={{ backgroundImage: 'linear-gradient(to right, #e5e5e5 50%, transparent 50%)', backgroundSize: '10px 1px' }} />

                        {[
                            { step: '①', title: 'Configura', desc: 'Scegli un template o crea da zero il tuo osservatorio in 5 minuti.' },
                            { step: '②', title: 'Raccogli', desc: 'Condividi il link o incorpora il widget. L\'AI lavora h24 per te.' },
                            { step: '③', title: 'Agisci', desc: 'Ricevi insight automatici e azioni suggerite pronte da approvare.' },
                        ].map((s, i) => (
                            <div key={i} className="flex flex-col items-center text-center relative z-10">
                                <div className="w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center text-2xl font-black text-amber-500 mb-8 border border-stone-100 group hover:scale-110 transition-transform">
                                    {s.step}
                                </div>
                                <h3 className="text-xl font-bold text-stone-900 mb-3">{s.title}</h3>
                                <p className="text-stone-500 leading-relaxed text-sm max-w-[240px]">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 7. COMPETITOR COMPARISON */}
            <section className="py-32 bg-white">
                <div className="container mx-auto px-6 max-w-5xl">
                    <div className="text-center mb-16">
                        <SectionLabel text="Confronto" />
                        <h2 className="text-4xl font-bold text-stone-900 tracking-tight">Perché scegliere noi?</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-stone-100">
                                    <th className="py-6 px-4 text-stone-400 font-bold uppercase text-[10px] tracking-widest">Feature</th>
                                    <th className="py-6 px-4 bg-amber-50/50 rounded-t-2xl font-black text-amber-600 text-center">Business Tuner</th>
                                    <th className="py-6 px-4 text-stone-400 text-center font-bold">Competitor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-50">
                                {[
                                    { f: 'Interview AI Qualitativo', tuner: true, other: 'Parziale' },
                                    { f: 'Chatbot con Gap Detection', tuner: true, other: false },
                                    { f: 'Visibility Tracker (AI + Web)', tuner: true, other: false },
                                    { f: 'Cross-channel Insights', tuner: true, other: false },
                                    { f: 'Setup < 5 Minuti', tuner: true, other: true },
                                    { f: 'Supporto Italiano Nativo', tuner: true, other: 'Limited' },
                                ].map((row, i) => (
                                    <tr key={i} className="group hover:bg-stone-50 transition-colors">
                                        <td className="py-5 px-4 font-bold text-stone-700 text-sm">{row.f}</td>
                                        <td className="py-5 px-4 bg-amber-50/50 text-center">
                                            {typeof row.tuner === 'boolean' ? (row.tuner ? <Icons.Check className="mx-auto text-amber-500" size={20} /> : <Icons.X className="mx-auto text-stone-300" size={20} />) : <span className="text-amber-600 font-bold text-sm">{row.tuner}</span>}
                                        </td>
                                        <td className="py-5 px-4 text-center">
                                            {typeof row.other === 'boolean' ? (row.other ? <Icons.Check className="mx-auto text-stone-400" size={20} /> : <Icons.X className="mx-auto text-stone-300" size={20} />) : <span className="text-stone-400 font-bold text-sm">{row.other}</span>}
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td className="py-8 px-4 font-black text-stone-900">Prezzo</td>
                                    <td className="py-8 px-4 bg-amber-50/50 rounded-b-2xl text-center">
                                        <div className="text-2xl font-black text-amber-600">da €49</div>
                                        <div className="text-[10px] text-stone-400 font-bold uppercase tracking-tight">Tutto incluso</div>
                                    </td>
                                    <td className="py-8 px-4 text-center">
                                        <div className="text-2xl font-black text-stone-400">€300+</div>
                                        <div className="text-[10px] text-stone-400 font-bold uppercase tracking-tight">Stack separato</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* 6. PRICING SECTION */}
            <section id="pricing" className="py-32 bg-stone-50">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <SectionLabel text="Prezzi" />
                        <h2 className="text-4xl font-bold text-stone-900 tracking-tight mb-6">Piani semplici, valore reale</h2>

                        {/* Toggle */}
                        <div className="flex items-center justify-center gap-4 bg-white p-1 rounded-full border border-stone-200 w-fit mx-auto shadow-sm">
                            <button
                                onClick={() => setIsYearly(false)}
                                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${!isYearly ? 'bg-amber-500 text-white shadow-md' : 'text-stone-400'}`}
                            >
                                Mensile
                            </button>
                            <button
                                onClick={() => setIsYearly(true)}
                                className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${isYearly ? 'bg-amber-500 text-white shadow-md' : 'text-stone-400'}`}
                            >
                                Annuale <span className="text-[10px] ml-1 bg-white/20 px-1.5 py-0.5 rounded">-25%</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                        {/* Plan: FREE */}
                        <div className="bg-white rounded-3xl p-8 border border-stone-100 flex flex-col hover:shadow-xl transition-shadow">
                            <h3 className="text-xl font-bold mb-1">Free</h3>
                            <div className="text-xs text-stone-400 font-bold uppercase tracking-widest mb-6">Per iniziare</div>
                            <div className="mb-8"><span className="text-4xl font-black">€0</span><span className="text-stone-400 text-sm">/mese</span></div>
                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 50 interviste / mese</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 1 Progetto</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Analytics base</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2 opacity-30"><Icons.X size={16} /> Chatbot Intelligence</li>
                            </ul>
                            <Link href="/register">
                                <Button fullWidth variant="secondary" className="border-stone-200">Per sempre gratis</Button>
                            </Link>
                        </div>

                        {/* Plan: STARTER */}
                        <div className="bg-white rounded-3xl p-8 border border-stone-100 flex flex-col hover:shadow-xl transition-shadow">
                            <h3 className="text-xl font-bold mb-1">Starter</h3>
                            <div className="text-xs text-stone-400 font-bold uppercase tracking-widest mb-6">Per professionisti</div>
                            <div className="mb-8"><span className="text-4xl font-black">€{isYearly ? 49 : 69}</span><span className="text-stone-400 text-sm">/mese</span></div>
                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 300 interviste / mese</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 5 Progetti</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 1 Chatbot Intelligence</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Custom Logo</li>
                            </ul>
                            <Link href="/register?plan=STARTER">
                                <Button fullWidth variant="secondary" className="bg-stone-50 border-stone-200 text-stone-900">Prova 14gg gratis</Button>
                            </Link>
                        </div>

                        {/* Plan: PRO (Highlighted) */}
                        <div className="bg-white rounded-3xl p-8 border-2 border-amber-500 flex flex-col shadow-2xl relative lg:scale-105 z-10 transform translate-y--4">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">Popolare</div>
                            <h3 className="text-xl font-bold mb-1">Pro</h3>
                            <div className="text-xs text-amber-500 font-black uppercase tracking-widest mb-6">Per PMI e agenzie</div>
                            <div className="mb-8"><span className="text-4xl font-black">€{isYearly ? 149 : 199}</span><span className="text-stone-400 text-sm">/mese</span></div>
                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="text-sm font-black text-stone-900 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 1.000 interviste / mese</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 15 Progetti</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 3 Bot (lacune & FAQ)</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2 text-amber-600 font-bold"><Icons.Check className="text-amber-500" size={16} /> Visibility Tracker</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2 text-amber-600 font-bold"><Icons.Check className="text-amber-500" size={16} /> Insight Hub (Cross)</li>
                            </ul>
                            <Link href="/register?plan=PRO">
                                <Button fullWidth withShimmer>Prova 14gg gratis</Button>
                            </Link>
                        </div>

                        {/* Plan: BUSINESS */}
                        <div className="bg-stone-900 rounded-3xl p-8 border border-stone-800 flex flex-col text-white">
                            <h3 className="text-xl font-bold mb-1">Business</h3>
                            <div className="text-xs text-stone-500 font-bold uppercase tracking-widest mb-6">Per grandi aziende</div>
                            <div className="mb-8"><span className="text-4xl font-black">€{isYearly ? 299 : 399}</span><span className="text-stone-500 text-sm">/mese</span></div>
                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 3.000+ interviste</li>
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Illimitati Progetti</li>
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Visibility Giornaliera</li>
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Automazioni complete</li>
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> White Label & API</li>
                            </ul>
                            <Link href="/contact">
                                <Button fullWidth variant="secondary" className="bg-white text-stone-900 border-transparent hover:bg-stone-100">Contattaci</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* 8. SOCIAL PROOF */}
            <section className="py-32 bg-white">
                <div className="container mx-auto px-6 max-w-7xl">
                    <div className="text-center mb-20">
                        <SectionLabel text="Testimonianze" />
                        <h2 className="text-4xl font-bold text-stone-900 tracking-tight">PMI italiane che ascoltano meglio</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[
                            { quote: "Abbiamo scoperto perché il 30% dei clienti ci lasciava. Informazioni che non avremmo mai ottenuto con un survey.", author: "Marco R.", role: "CEO SaaS B2B", tool: "Interview AI" },
                            { quote: "Il chatbot ha ridotto le richieste di supporto del 40%. E ora sappiamo esattamente cosa aggiungere alla knowledge base.", author: "Giulia M.", role: "Customer Success Manager", tool: "Chatbot Intelligence" },
                            { quote: "Non sapevamo che ChatGPT ci menzionava male. Abbiamo corretto i contenuti e ora siamo in prima posizione.", author: "Andrea B.", role: "Marketing Manager", tool: "Visibility Tracker" },
                            { quote: "Il vero valore è vedere tutto insieme. Un tema che emerge ovunque è impossibile da ignorare e richiede azione rapida.", author: "Laura F.", role: "Head of Product", tool: "Cross-Channel Insights" },
                        ].map((t, i) => (
                            <div key={i} className="p-10 rounded-[2.5rem] bg-stone-50 border border-stone-100 relative group hover:-translate-y-1 transition-all">
                                <Icons.Quote className="absolute top-6 right-8 text-stone-100 group-hover:text-amber-100 transition-colors" size={60} />
                                <div className="text-xs font-black text-amber-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Icons.Check size={14} /> {t.tool}
                                </div>
                                <p className="text-xl text-stone-700 leading-relaxed mb-8 italic">"{t.quote}"</p>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center font-bold text-amber-600 uppercase">
                                        {t.author[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-stone-900">{t.author}</div>
                                        <div className="text-xs text-stone-400 font-medium">{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-20 pt-20 border-t border-stone-100 grid grid-cols-2 md:grid-cols-4 gap-8 text-center opacity-40 grayscale hover:grayscale-0 transition-all duration-700 cursor-default">
                        <div className="text-2xl font-black text-stone-900 flex items-center justify-center gap-2">Logo 1</div>
                        <div className="text-2xl font-black text-stone-900 flex items-center justify-center gap-2">Logo 2</div>
                        <div className="text-2xl font-black text-stone-900 flex items-center justify-center gap-2">Logo 3</div>
                        <div className="text-2xl font-black text-stone-900 flex items-center justify-center gap-2">Logo 4</div>
                    </div>
                </div>
            </section>

            {/* 9. FAQ SECTION */}
            <section className="py-32 bg-[#FAFAF8]">
                <div className="container mx-auto px-6 max-w-4xl">
                    <div className="text-center mb-16">
                        <SectionLabel text="FAQ" />
                        <h2 className="text-4xl font-bold text-stone-900 tracking-tight">Dubbi? Risposte.</h2>
                    </div>

                    <div className="space-y-4">
                        {[
                            { q: "Quanto tempo serve per iniziare?", a: "5 minuti. Scegli un template, personalizzalo e condividi il link. L'AI fa il resto." },
                            { q: "Devo avere competenze tecniche?", a: "No. L'interfaccia è pensata per imprenditori e manager, non per sviluppatori. Tutto è drag-and-drop o prompt-based." },
                            { q: "I dati sono sicuri?", a: "Assolutamente. Server EU (Germania/Irlanda), GDPR compliant, crittografia end-to-end. I tuoi dati non vengono mai usati per addestrare modelli AI pubblici." },
                            { q: "Cos'è l'Insight Hub?", a: "È la dashboard che unisce i dati di tutti e tre gli strumenti. Se un tema emerge nelle interviste, nel chatbot E nella visibility, te lo segnaliamo con priorità alta." },
                            { q: "Posso esportare i dati?", a: "Sì. Trascrizioni, insight in CSV o report PDF completi pronti da condividere." },
                        ].map((faq, i) => (
                            <details key={i} className="group bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                                    <h4 className="font-bold text-stone-900 pr-4">{faq.q}</h4>
                                    <div className="text-amber-500 transition-transform duration-300 group-open:rotate-45">
                                        <Icons.Plus size={20} />
                                    </div>
                                </summary>
                                <div className="px-6 pb-6 text-stone-600 leading-relaxed border-t border-stone-50 pt-4 text-sm">
                                    {faq.a}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* 10. FINAL CTA */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-6 max-w-5xl">
                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[3rem] p-12 lg:p-24 text-center text-white relative overflow-hidden shadow-3xl">
                        <div className="relative z-10">
                            <h2 className="text-4xl lg:text-5xl font-black mb-8 tracking-tight">Pronto ad ascoltare <br />il tuo mercato?</h2>
                            <p className="text-xl text-amber-50 mb-12 max-w-2xl mx-auto">
                                Inizia gratis oggi. 50 interviste incluse ogni mese.
                                Nessun limite di tempo, nessuna carta richiesta.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link href="/register">
                                    <Button size="lg" className="bg-white text-stone-900 hover:bg-stone-50 border-none px-12 py-7 rounded-full text-lg h-auto shadow-xl">
                                        Inizia gratis ora <Icons.ArrowRight className="ml-2" />
                                    </Button>
                                </Link>
                                <Link href="/contact">
                                    <button className="text-amber-50 font-bold hover:text-white transition-colors">Prenota una demo personalizzata</button>
                                </Link>
                            </div>
                        </div>
                        <Icons.Logo className="absolute -bottom-20 -left-20 opacity-10" size={300} />
                        <Icons.Logo className="absolute -top-20 -right-20 opacity-10" size={300} />
                    </div>
                </div>
            </section>
        </div>
    );
}
