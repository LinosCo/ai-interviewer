'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, gradients, shadows, radius } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { PLANS, PlanType } from '@/config/plans';
import { SpotlightCard } from '@/components/ui/visual-effects/SpotlightCard';
import { TiltCard } from '@/components/ui/visual-effects/TiltCard';
import { ParallaxElement } from '@/components/ui/visual-effects/ParallaxElement';
import { FloatingElement } from '@/components/ui/visual-effects/FloatingElement';

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

// Hero rotating phrases - slide animation (positive/opportunity-focused)
const HERO_PHRASES = [
    'cosa pensano i clienti?',
    'se il team è motivato?',
    'come parlano di te online?',
    'dove ottimizzare il budget?',
    'se l\'assistenza funziona?',
    'come ti vede la filiera?',
    'perché i clienti comprano?',
    'cosa cercano i talenti?',
    'come migliorare il prodotto?',
    'se i prezzi sono giusti?',
    'cosa fanno i competitor?',
    'come comunicare meglio?',
    'come migliorare il servizio?',
];

const SectionDivider = ({
    position = "bottom",
    gradient = "to-b",
    height = "h-32"
}: {
    position?: "top" | "bottom"
    gradient?: "to-b" | "to-t"
    height?: string
}) => {
    return (
        <div
            className={`absolute left-0 right-0 z-10 pointer-events-none ${height} ${position === "bottom" ? "bottom-0" : "top-0"} bg-gradient-to-b from-transparent to-stone-950`}
            style={{
                background: `linear-gradient(${gradient === "to-b" ? "180deg" : "0deg"}, rgba(12,10,9,0) 0%, rgba(12,10,9,1) 100%)`
            }}
        />
    )
}

export default function LandingPage() {
    const { data: session } = useSession();
    const [isYearly, setIsYearly] = useState(true);
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

    // Auto-rotate phrases every 3 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentPhraseIndex((prev) => (prev + 1) % HERO_PHRASES.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const [showStickyCTA, setShowStickyCTA] = useState(false);
    const [showDemoForm, setShowDemoForm] = useState(false);
    const [demoEmail, setDemoEmail] = useState('');
    const [demoSubmitted, setDemoSubmitted] = useState(false);
    const [cookieConsent, setCookieConsent] = useState<string | null>(null);

    // Check cookie consent on mount
    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        setCookieConsent(consent);

        // Listen for cookie consent changes
        const handleStorage = () => {
            const newConsent = localStorage.getItem('cookie-consent');
            setCookieConsent(newConsent);
        };

        window.addEventListener('storage', handleStorage);
        // Also check periodically in case of same-tab changes
        const interval = setInterval(handleStorage, 500);

        return () => {
            window.removeEventListener('storage', handleStorage);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setShowStickyCTA(window.scrollY > 600);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleDemoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // In production, this would send to an API
        console.log('Demo requested for:', demoEmail);
        setDemoSubmitted(true);
        setTimeout(() => {
            setShowDemoForm(false);
            setDemoSubmitted(false);
            setDemoEmail('');
        }, 3000);
    };

    return (
        <div className="bg-white overflow-x-hidden">
            <style jsx global>{`
                .glass {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
                }
                .glass-dark {
                    background: rgba(17, 24, 39, 0.7);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
                }
                .text-gradient {
                    background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
            `}</style>

            {/* Sticky CTA Bar - Floating Pill Design (only show after cookie consent) */}
            <AnimatePresence>
                {showStickyCTA && cookieConsent && (
                    <motion.div
                        initial={{ y: 100, opacity: 0, x: '-50%' }}
                        animate={{ y: 0, opacity: 1, x: '-50%' }}
                        exit={{ y: 100, opacity: 0, x: '-50%' }}
                        style={{ left: '50%' }}
                        className="fixed bottom-6 z-[100] w-[90%] max-w-4xl"
                    >
                        <div className="bg-stone-900/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-3xl md:rounded-full py-3 px-6 md:py-4 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-center md:text-left hidden sm:block">
                                <p className="font-bold text-white leading-tight">Pronto a capire meglio i tuoi clienti?</p>
                                <p className="text-xs text-stone-400 font-medium">Prova gratuitamente la potenza di Business Tuner</p>
                            </div>

                            {/* Mobile-only text (shorter) */}
                            <div className="text-center sm:hidden">
                                <p className="font-bold text-white text-sm">Inizia a raccogliere feedback gratis</p>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end">
                                <Link href="/onboarding/preview" className="flex-1 md:flex-none">
                                    <button className="w-full px-6 py-2.5 rounded-full border border-white/20 text-white font-bold text-sm hover:bg-white/10 transition-colors bg-transparent">
                                        Demo Intervista
                                    </button>
                                </Link>
                                <Link href="/register" className="flex-1 md:flex-none">
                                    <Button size="sm" withShimmer className="w-full px-6 rounded-full py-2.5 shadow-lg shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 border-none">
                                        Inizia gratis
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global style to nudge the external chatbot bubble and hide its redundant components */}
            <style jsx global>{`
                /* Target the Voler.ai chatbot bubble and containers */
                #bt-chatbot-iframe,
                [id^="voler-"],
                .voler-widget-bubble,
                .fixed.bottom-4.right-4,
                .fixed.bottom-6.right-6 {
                    bottom: ${showStickyCTA ? '110px' : '30px'} !important;
                    transition: bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }

                /* Hide redundant cookie/consent windows from the external widget */
                [id^="voler-"] [class*="consent"],
                [id^="voler-"] [class*="cookie"],
                .voler-consent-banner {
                    display: none !important;
                }
                
                @media (max-width: 768px) {
                    #bt-chatbot-iframe,
                    [id^="voler-"] {
                        bottom: ${showStickyCTA ? '160px' : '20px'} !important;
                    }
                }
            `}</style>

            {/* Demo Request Modal */}
            <AnimatePresence>
                {showDemoForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
                        onClick={() => setShowDemoForm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {!demoSubmitted ? (
                                <>
                                    <h3 className="text-2xl font-bold text-stone-900 mb-2">Richiedi una demo</h3>
                                    <p className="text-stone-500 mb-6">Ti mostreremo come Business Tuner può aiutare la tua azienda.</p>
                                    <form onSubmit={handleDemoSubmit} className="space-y-4">
                                        <input
                                            type="email"
                                            value={demoEmail}
                                            onChange={(e) => setDemoEmail(e.target.value)}
                                            placeholder="La tua email aziendale"
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                                        />
                                        <Button type="submit" fullWidth withShimmer className="py-3">
                                            Richiedi demo gratuita
                                        </Button>
                                    </form>
                                    <p className="text-xs text-stone-400 mt-4 text-center">Ti contatteremo entro 24 ore lavorative</p>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Icons.Check className="text-green-600" size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-stone-900 mb-2">Richiesta inviata!</h3>
                                    <p className="text-stone-500">Ti contatteremo presto per organizzare la demo.</p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 1. HERO SECTION */}
            <section className="relative pt-0 pb-20 lg:pb-32 bg-stone-950 overflow-hidden min-h-screen flex flex-col justify-center">
                {/* Aurora Background Effect - WARN TONES ONLY */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-stone-800/20 rounded-full blur-[120px] mix-blend-screen" />
                    <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[120px] mix-blend-screen" />
                    <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] bg-orange-900/10 rounded-full blur-[120px] mix-blend-screen" />
                </div>

                {/* Floating Blobs */}
                <FloatingElement className="absolute top-20 left-10 z-0" duration={8} yOffset={30}>
                    <div className="w-64 h-64 bg-amber-500/5 rounded-full blur-[80px]" />
                </FloatingElement>
                <FloatingElement className="absolute bottom-20 right-10 z-0" duration={10} yOffset={-30} delay={2}>
                    <div className="w-80 h-80 bg-orange-500/5 rounded-full blur-[100px]" />
                </FloatingElement>

                <div className="container mx-auto px-6 max-w-7xl relative z-10">
                    <div className="text-center max-w-4xl mx-auto">
                        <SectionLabel text="Per PMI e professionisti" color="#F59E0B" bg="rgba(255,255,255,0.05)" />

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6"
                        >
                            {/* PRE-HEADER: Uppercase, smaller, less emphasis */}
                            <span className="text-lg lg:text-xl font-bold uppercase tracking-widest text-stone-500 block mb-4">
                                Ti piacerebbe sapere
                            </span>

                            {/* HEADLINE: Equal weight for rotating and static part */}
                            <h1 className="text-5xl lg:text-7xl font-black text-white leading-[1.1] tracking-tighter">
                                <span className="block mb-2">se il team è </span>
                                <span className="relative inline-block min-h-[1.3em] text-gradient">
                                    <AnimatePresence mode="wait">
                                        <motion.span
                                            key={currentPhraseIndex}
                                            initial={{ y: 40, opacity: 0, scale: 0.95 }}
                                            animate={{ y: 0, opacity: 1, scale: 1 }}
                                            exit={{ y: -40, opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                            className="block"
                                            style={{
                                                background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 50%, #D97706 100%)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent'
                                            }}
                                        >
                                            {HERO_PHRASES[currentPhraseIndex]}
                                        </motion.span>
                                    </AnimatePresence>
                                </span>
                            </h1>
                        </motion.div>

                        {/* Subheadline - constrained to White text, no gray */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="mb-12 max-w-3xl mx-auto"
                        >
                            <p className="text-2xl lg:text-3xl text-white font-medium leading-relaxed mb-4 opacity-90">
                                La piattaforma di business intelligence che ascolta{' '}
                                <span className="text-orange-400 font-bold">mercato, dipendenti e filiera</span>.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16"
                        >
                            <Link href="/register">
                                <Button size="lg" withShimmer className="px-10 py-6 text-lg h-auto rounded-2xl shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)] hover:shadow-[0_0_60px_-10px_rgba(245,158,11,0.6)] transition-all bg-gradient-to-br from-amber-500 to-orange-600 border-none">
                                    Inizia gratis <Icons.ArrowRight className="ml-2" />
                                </Button>
                            </Link>
                            <Link href="/onboarding/preview">
                                <Button variant="secondary" size="lg" className="px-10 py-6 text-lg h-auto rounded-2xl bg-white text-stone-900 border-white/20 shadow-xl hover:bg-white/90 hover:scale-105 transition-all">
                                    <Icons.Play className="mr-2 text-amber-600" /> Demo Intervista
                                </Button>
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex flex-wrap justify-center gap-8 text-white/60 text-sm font-medium"
                        >
                            <span className="flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Setup in 5 minuti</span>
                            <span className="flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 20 interviste/mese gratis per sempre</span>
                            <span className="flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Nessuna carta richiesta</span>
                        </motion.div>

                        {/* Integration Diagram - Refined with Tilt and Glass */}
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="mt-24 relative max-w-2xl mx-auto"
                        >
                            <div className="flex justify-between items-center relative z-10 px-4">
                                <TiltCard className="flex flex-col items-center gap-4 group cursor-default">
                                    <div className="w-24 h-24 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:bg-white/10 group-hover:border-amber-500/30 transition-all duration-300">
                                        <Icons.MessageSquare size={32} className="text-amber-500 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <span className="text-xs font-bold text-white/50 tracking-widest group-hover:text-amber-400 transition-colors">RACCOGLI</span>
                                </TiltCard>

                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-2 relative">
                                    <div className="absolute top-[-4px] left-[50%] w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse" />
                                </div>

                                <TiltCard className="flex flex-col items-center gap-4 group cursor-default">
                                    <div className="w-24 h-24 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:bg-white/10 group-hover:border-amber-500/30 transition-all duration-300 relative">
                                        <div className="absolute inset-0 bg-amber-500/10 rounded-3xl blur-xl group-hover:bg-amber-500/20 transition-all" />
                                        <Icons.Bot size={40} className="text-amber-500 group-hover:scale-110 transition-transform relative z-10" />
                                    </div>
                                    <span className="text-xs font-bold text-white/50 tracking-widest group-hover:text-amber-400 transition-colors">ANALIZZA</span>
                                </TiltCard>

                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-2 relative">
                                    <div className="absolute top-[-4px] left-[50%] w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse" />
                                </div>

                                <TiltCard className="flex flex-col items-center gap-4 group cursor-default">
                                    <div className="w-24 h-24 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl group-hover:bg-white/10 group-hover:border-amber-500/30 transition-all duration-300">
                                        <Icons.Search size={32} className="text-amber-500 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <span className="text-xs font-bold text-white/50 tracking-widest group-hover:text-amber-400 transition-colors">MONITORA</span>
                                </TiltCard>
                            </div>

                            <div className="mt-16 flex flex-col items-center relative z-20">
                                <div className="w-px h-16 bg-gradient-to-b from-white/20 to-amber-500/50 relative"></div>
                                <TiltCard className="mt-4">
                                    <div className="bg-gradient-to-br from-amber-500 to-orange-700 text-white rounded-[2rem] p-6 px-12 shadow-[0_20px_60px_-15px_rgba(245,158,11,0.4)] border-t border-white/20 flex items-center gap-4 hover:scale-[1.02] transition-transform duration-300">
                                        <div className="bg-white/20 p-2 rounded-lg">
                                            <Icons.Layers size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <span className="text-lg font-bold tracking-tight block">Azioni Concrete</span>
                                            <span className="text-sm text-white/80">Suggerimenti pronti da applicare</span>
                                        </div>
                                    </div>
                                </TiltCard>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 2. HOW IT WORKS - DARK to ORANGE GRADIENT FLOW */}
            <section id="how-it-works" className="py-32 relative overflow-hidden">
                {/* Background Gradient: Dark Stone -> Rich Orange */}
                <div className="absolute inset-0 z-0 bg-gradient-to-b from-stone-950 via-amber-900 to-orange-600" />

                <div className="container mx-auto px-6 max-w-7xl relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <SectionLabel text="Come funziona" color="#F59E0B" bg="rgba(245,158,11,0.1)" />
                        <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-4 text-white">
                            Crea il tuo osservatorio <br /> <span className="text-stone-500">in pochi minuti</span>
                        </h2>
                        <p className="text-stone-400 text-xl font-medium">L'AI lavora 24/7 su tre fronti per darti risposte.</p>
                    </div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                        variants={{
                            hidden: { opacity: 0 },
                            visible: {
                                opacity: 1,
                                transition: { staggerChildren: 0.15 }
                            }
                        }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12"
                    >
                        {/* Step 1: Configura */}
                        <TiltCard className="h-full" rotationFactor={3}>
                            <motion.div
                                variants={{
                                    hidden: { opacity: 0, y: 30 },
                                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 40 } }
                                }}
                                className="bg-stone-900/40 backdrop-blur-xl h-full rounded-3xl p-8 border border-white/5 hover:bg-stone-900/60 transition-colors group"
                            >
                                <div className="text-8xl font-black text-white/5 mb-4 leading-none select-none group-hover:text-amber-500/10 transition-colors">01</div>
                                <h3 className="text-2xl font-bold text-white mb-6">Configura</h3>
                                <ul className="space-y-4 text-sm text-stone-400">
                                    <li className="flex items-start gap-3">
                                        <Icons.Check size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span>Descrivi in una frase cosa ti interessa sapere</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Icons.Check size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span>Definisci i target: clienti, dipendenti, fornitori</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Icons.Check size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span>Personalizza tono e stile dell'AI</span>
                                    </li>
                                </ul>
                            </motion.div>
                        </TiltCard>

                        {/* Step 2: Ascolta */}
                        <TiltCard className="h-full" rotationFactor={3}>
                            <motion.div
                                variants={{
                                    hidden: { opacity: 0, y: 30 },
                                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 40 } }
                                }}
                                className="bg-stone-900/40 backdrop-blur-xl h-full rounded-3xl p-8 border border-white/5 hover:bg-stone-900/60 transition-colors group"
                            >
                                <div className="text-8xl font-black text-white/5 mb-4 leading-none select-none group-hover:text-amber-500/10 transition-colors">02</div>
                                <h3 className="text-2xl font-bold text-white mb-6">Ascolta</h3>
                                <ul className="space-y-4 text-sm text-stone-400">
                                    <li className="flex items-start gap-3">
                                        <Icons.MessageSquare size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span><strong>Interviste:</strong> raccogli feedback profondi</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Icons.Bot size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span><strong>Chatbot:</strong> scopri lacune nel tuo supporto</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Icons.Search size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span><strong>Monitor:</strong> traccia reputazione su AI e Web</span>
                                    </li>
                                </ul>
                            </motion.div>
                        </TiltCard>

                        {/* Step 3: Agisci */}
                        <TiltCard className="h-full" rotationFactor={3}>
                            <motion.div
                                variants={{
                                    hidden: { opacity: 0, y: 30 },
                                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 40 } }
                                }}
                                className="bg-stone-900/40 backdrop-blur-xl h-full rounded-3xl p-8 border border-white/5 hover:bg-stone-900/60 transition-colors group relative overflow-hidden"
                            >
                                {/* Subtle highlight for the final step */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/20 to-transparent rounded-bl-full" />

                                <div className="text-8xl font-black text-white/5 mb-4 leading-none select-none group-hover:text-amber-500/10 transition-colors">03</div>
                                <h3 className="text-2xl font-bold text-white mb-4">Agisci</h3>
                                <p className="text-amber-500/80 text-sm mb-4 italic">Suggerimenti pronti all'uso:</p>
                                <ul className="space-y-4 text-sm text-stone-400">
                                    <li className="flex items-start gap-3">
                                        <Icons.Zap size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span>Aggiorna FAQ o contenuti del sito</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Icons.Zap size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span>Correggi prezzi o descrizioni errate</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Icons.Zap size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                        <span>Intervieni su clienti a rischio churn</span>
                                    </li>
                                </ul>
                            </motion.div>
                        </TiltCard>
                    </motion.div>
                </div>

                {/* Transition to Light Section - Smooth Gradient FADE */}
                <div className="absolute left-0 right-0 bottom-0 h-64 bg-gradient-to-t from-stone-50 via-orange-500/10 to-transparent z-20 pointer-events-none" />
            </section>

            {/* 3. PROBLEM / SOLUTION */}
            <section className="py-20 bg-white relative">
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
                                    { label: 'Reputazione & Presenza Online', traditional: '€150+ / mese', tuner: 'Incluso' },
                                ].map((item, i) => (
                                    <SpotlightCard key={i} className="rounded-2xl border border-stone-200 bg-stone-50/50" spotlightColor="rgba(245, 158, 11, 0.2)">
                                        <div className="flex items-center justify-between p-4 px-6 relative z-10">
                                            <span className="font-bold text-stone-800">{item.label}</span>
                                            <div className="text-right">
                                                <div className="text-xs text-stone-400 line-through mb-1">{item.traditional}</div>
                                                <div className="text-amber-600 font-black">{item.tuner}</div>
                                            </div>
                                        </div>
                                    </SpotlightCard>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-3xl font-bold mb-8">Business Tuner: tutto integrato</h3>
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
                                            <div className="font-bold">Assistente Chatbot</div>
                                            <div className="text-sm text-amber-100">Rileva lacune e suggerisce FAQ in automatico.</div>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0"><Icons.Check size={20} /></div>
                                        <div>
                                            <div className="font-bold">Brand Monitor</div>
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

            {/* 4. THE THREE TOOLS SECTION */}
            <section id="use-cases" className="py-32 bg-white relative overflow-hidden">
                {/* Background Pattern - Dot Matrix */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                <div className="container mx-auto px-6 max-w-7xl relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-24">
                        <SectionLabel text="Cosa fa per te" />
                        <h2 className="text-4xl lg:text-6xl font-black text-stone-900 mb-6 tracking-tight">
                            Tre strumenti per <span className="text-gradient">capire e migliorare</span>
                        </h2>
                    </div>

                    {/* Tool 1: Interview AI */}
                    <div className="grid lg:grid-cols-2 gap-20 items-center mb-40">
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg"><Icons.MessageSquare size={24} /></div>
                                <h3 className="text-3xl font-bold text-stone-900 tracking-tight">Raccogli Feedback</h3>
                            </div>
                            <h4 className="text-xl text-stone-900 font-bold mb-6">Scopri cosa pensano davvero clienti, dipendenti e fornitori.</h4>
                            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                                Un'intelligenza artificiale che intervista <strong>clienti, dipendenti o fornitori</strong> con la stessa facilità. Ti fa capire cosa pensano davvero, senza form noiosi che nessuno compila.
                            </p>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
                                    <div className="text-2xl font-black text-amber-500 mb-1">70%+</div>
                                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Completion Rate</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
                                    <div className="text-2xl font-black text-amber-500 mb-1">10x</div>
                                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Più economico</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
                                    <div className="text-2xl font-black text-amber-500 mb-1">+25%</div>
                                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Team Engagement</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
                                    <div className="text-2xl font-black text-amber-500 mb-1">-40%</div>
                                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tempo Risposta</div>
                                </div>
                            </div>

                            <ul className="space-y-4 mb-10">
                                {['Scrivi cosa vuoi capire, l\'AI crea le domande', 'L\'AI fa domande di approfondimento, come un vero intervistatore', 'Risultati chiari: cosa migliorare nel prodotto, servizio o comunicazione'].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3 text-stone-700 font-medium">
                                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0"><Icons.Check size={12} /></div>
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <div className="text-sm font-bold text-amber-600">Disponibile da: <span className="px-2 py-1 bg-amber-50 rounded">Free Plan</span></div>
                        </div>

                        <div className="relative">
                            <ParallaxElement offset={40} className="relative z-10">
                                <div className="bg-stone-900 rounded-[2.5rem] p-8 shadow-2xl text-white border border-stone-800">
                                    <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
                                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center"><Icons.Bot size={16} /></div>
                                        <span className="font-bold">Interview AI</span>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="flex flex-col gap-2">
                                            <div className="text-xs text-stone-400 uppercase font-bold tracking-widest">AI: Domanda</div>
                                            <div className="bg-stone-800 p-4 rounded-2xl rounded-tl-none border border-stone-700 leading-relaxed">
                                                "Come valuti la comunicazione interna del team?"
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 items-end">
                                            <div className="text-xs text-stone-400 uppercase font-bold tracking-widest">Dipendente</div>
                                            <div className="bg-amber-500 p-4 rounded-2xl rounded-tr-none font-medium leading-relaxed">
                                                "A volte le informazioni non arrivano in tempo..."
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="text-xs text-stone-400 uppercase font-bold tracking-widest">AI: Deep Probe</div>
                                            <div className="bg-stone-800 p-4 rounded-2xl rounded-tl-none border border-stone-700 leading-relaxed border-l-2 border-l-amber-500">
                                                "Puoi farmi un esempio recente di una situazione in cui questo ha creato problemi?"
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ParallaxElement>
                            {/* Decorative shadow */}
                            <div className="absolute -inset-10 bg-amber-500/10 blur-[80px] -z-10 rounded-full" />
                        </div>
                    </div>

                    {/* Tool 2: Chatbot Intelligence */}
                    <div className="grid lg:grid-cols-2 gap-20 items-center mb-40">
                        <div className="order-2 lg:order-1 relative">
                            <ParallaxElement offset={-40} className="relative z-10">
                                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-amber-100 overflow-hidden">
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
                                                        <span className="font-bold text-stone-800">"Tempi di consegna?"</span>
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
                                            <p className="text-xs text-amber-800 mb-6 italic">"Questa settimana 12 dipendenti hanno chiesto informazioni sui benefit aziendali. Vuoi che aggiunga una pagina dedicata?"</p>
                                            <div className="flex gap-2">
                                                <button className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">✅ Approva</button>
                                                <button className="flex-1 py-2 rounded-lg bg-white text-amber-600 text-xs font-bold border border-amber-200 hover:bg-amber-50">Modifica</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ParallaxElement>
                            <div className="absolute -inset-10 bg-amber-500/5 blur-[80px] -z-10 rounded-full" />
                        </div>

                        <div className="order-1 lg:order-2">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg"><Icons.Bot size={24} /></div>
                                <h3 className="text-3xl font-bold text-stone-900 tracking-tight">Assistente AI</h3>
                            </div>
                            <h4 className="text-xl text-stone-900 font-bold mb-6">Rispondi a clienti e dipendenti 24/7. Scopri cosa non trovano.</h4>
                            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                                Un assistente che risponde alle domande di <strong>clienti, prospect e dipendenti</strong> e ti dice cosa non trova. Così sai esattamente cosa aggiungere o migliorare.
                            </p>

                            <ul className="space-y-6 mb-10">
                                <li className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-1"><Icons.Check size={14} /></div>
                                    <div>
                                        <div className="font-bold text-stone-900 uppercase text-xs tracking-widest mb-1">Rileva le lacune</div>
                                        <div className="text-sm text-stone-500 leading-relaxed">Ti mostra le domande a cui non ha saputo rispondere. Così sai cosa manca sul sito.</div>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 mt-1"><Icons.Check size={14} /></div>
                                    <div>
                                        <div className="font-bold text-stone-900 uppercase text-xs tracking-widest mb-1">Suggerisce le risposte</div>
                                        <div className="text-sm text-stone-500 leading-relaxed">Ti propone le risposte da aggiungere con un click. Meno lavoro per te.</div>
                                    </div>
                                </li>
                            </ul>

                            <div className="text-sm font-bold text-amber-600">Disponibile da: <span className="px-2 py-1 bg-amber-50 rounded">Starter Plan (€69/mo)</span></div>
                        </div>
                    </div>

                    {/* Tool 3: Visibility Tracker */}
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg"><Icons.Search size={24} /></div>
                                <h3 className="text-3xl font-bold text-stone-900 tracking-tight">Brand Monitor</h3>
                            </div>
                            <h4 className="text-xl text-stone-900 font-bold mb-6">Cosa dicono di te su Google e cosa risponde l'AI agli utenti che cercano prodotti o servizi come i tuoi.</h4>
                            <p className="text-lg text-stone-600 mb-8 leading-relaxed">
                                Scopri se quando qualcuno chiede a ChatGPT o Google un prodotto come il tuo, ti menzionano o no. Se non lo fanno, ti diciamo come migliorare.
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-10">
                                <div className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
                                    <div className="font-bold text-stone-900 text-sm mb-2">Cosa dice l'AI di te</div>
                                    <div className="text-xs text-stone-500">ChatGPT, Claude, Gemini, Perplexity</div>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
                                    <div className="font-bold text-stone-900 text-sm mb-2">Cosa dice il web di te</div>
                                    <div className="text-xs text-stone-500">Google News, articoli, forum</div>
                                </div>
                            </div>

                            <p className="text-sm text-stone-500 italic mb-10">
                                "Il 40% delle ricerche B2B oggi inizia chiedendo a un'AI. Se ChatGPT non ti conosce, perdi opportunità."
                            </p>

                            <div className="text-sm font-bold text-amber-600">Disponibile da: <span className="px-2 py-1 bg-amber-50 rounded">Pro Plan (€199/mo)</span></div>
                        </div>

                        <div className="relative">
                            <ParallaxElement offset={40} className="relative z-10">
                                <div className="bg-stone-50 rounded-[2.5rem] p-8 shadow-2xl border border-stone-200">
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
                            </ParallaxElement>
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
                                    <div className="text-xs font-black text-amber-900 uppercase">Brand Monitor</div>
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
                            <SectionLabel text="Suggerimenti & Consulenza" color="#F59E0B" bg="rgba(245, 158, 11, 0.05)" />
                            <h2 className="text-4xl lg:text-5xl font-black text-stone-900 mb-8 tracking-tight">
                                Consigli pratici su <br /><span className="text-gradient">cosa migliorare</span>
                            </h2>
                            <p className="text-xl text-stone-600 mb-12 leading-relaxed">
                                La piattaforma collega feedback, domande dei clienti e reputazione online. Ti dice cosa migliorare nel prodotto, nel marketing o nel servizio. E se serve aiuto, <strong>puoi richiedere una consulenza</strong>.
                            </p>

                            <div className="space-y-6">
                                {[
                                    { t: 'Suggerimenti automatici', d: 'Ti diciamo cosa fare: aggiungere una FAQ, modificare un testo sul sito, rispondere a una recensione.' },
                                    { t: 'Consulenza su richiesta', d: 'Per le decisioni strategiche (pricing, posizionamento, nuove funzionalità), puoi chiedere una consulenza dedicata.' },
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

            {/* 6. FUNZIONALITÀ AVANZATE - Dark background */}
            <section className="py-32 bg-stone-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#F59E0B_1px,transparent_1px)] [background-size:24px_24px]"></div>
                <motion.div
                    animate={{ y: [0, -15, 0] }}
                    transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                    className="absolute top-10 right-10 w-60 h-60 bg-amber-500/10 rounded-full blur-[100px]"
                />
                <div className="container mx-auto px-6 max-w-7xl relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <SectionLabel text="Funzionalità avanzate" color="#F59E0B" bg="rgba(255,255,255,0.1)" />
                        <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 tracking-tight">
                            Tecnologia che <span className="text-gradient">fa la differenza</span>
                        </h2>
                        <p className="text-lg text-stone-400">
                            Dietro l'interfaccia semplice, funzionalità avanzate che rendono Business Tuner unico.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 hover:bg-white/10 hover:scale-[1.02] transition-all duration-300"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                                <Icons.Brain size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-3">Memory Manager</h3>
                            <p className="text-sm text-stone-400 leading-relaxed">
                                L'AI ricorda le risposte precedenti e costruisce un profilo dell'intervistato per domande più pertinenti.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 hover:bg-white/10 hover:scale-[1.02] transition-all duration-300"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                                <Icons.Timer size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-3">Rilevamento fatica</h3>
                            <p className="text-sm text-stone-400 leading-relaxed">
                                Monitora i segnali di stanchezza dell'utente e adatta la lunghezza dell'intervista di conseguenza.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                            className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 hover:bg-white/10 hover:scale-[1.02] transition-all duration-300"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                                <Icons.FileText size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-3">Prompt trasparenti</h3>
                            <p className="text-sm text-stone-400 leading-relaxed">
                                Visualizza e modifica i prompt usati dall'AI. Pieno controllo su come l'intelligenza artificiale lavora.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 hover:bg-white/10 hover:scale-[1.02] transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-4 right-4 text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full border border-amber-500/30">
                                Per clienti Voler.ai
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                                <Icons.Globe size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-3">CMS Automation</h3>
                            <p className="text-sm text-stone-400 leading-relaxed">
                                Aggiorna automaticamente FAQ e contenuti sul tuo sito basandosi sui feedback raccolti.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* 7. COMPETITOR COMPARISON */}
            <section className="py-32 bg-stone-50">
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
                                    { f: 'Features', tuner: true, other: false }, // Header placeholder
                                    { f: 'Interview AI + Deep Probing', tuner: true, other: 'Solo Form' },
                                    { f: 'Brand Monitor (LLM + Web)', tuner: true, other: 'Solo Web' },
                                    { f: 'Strategic Copilot (AI Tips)', tuner: true, other: false },
                                    { f: 'CMS & Data Automation', tuner: true, other: false },
                                    { f: 'Supporto Italiano Nativo', tuner: true, other: 'No' },
                                ].map((row, i) => (
                                    <tr key={i} className="group hover:bg-stone-50 transition-colors">
                                        <td className="py-5 px-4 font-bold text-stone-700 text-sm">{row.f}</td>
                                        <td className="py-5 px-4 bg-amber-50/50 text-center">
                                            {typeof row.tuner === 'boolean' ? (row.tuner ? <Icons.Check className="mx-auto text-amber-500" size={20} /> : <span className="text-xs font-bold text-stone-300 invisible">.</span>) : <span className="text-amber-600 font-bold text-sm text-center block">{row.tuner}</span>}
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

            {/* 8. PRICING SECTION */}
            <section id="pricing" className="py-32 bg-white">
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
                        <p className="text-xs text-stone-400 mt-4">I prezzi si riferiscono a un singolo utente. Per team con più utenti, contattaci per un preventivo personalizzato.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                        {/* Plan: FREE */}
                        <div className="bg-white rounded-3xl p-8 border border-stone-100 flex flex-col hover:shadow-xl transition-shadow">
                            <h3 className="text-xl font-bold mb-1">Free</h3>
                            <div className="text-xs text-stone-400 font-bold uppercase tracking-widest mb-6">Per iniziare</div>
                            <div className="mb-8"><span className="text-4xl font-black">€0</span><span className="text-stone-400 text-sm">/mese</span></div>
                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 20 interviste / mese</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 1 Progetto</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Analytics base</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2 opacity-30"><Icons.X size={16} /> Assistente Chatbot</li>
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
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 100 interviste / mese</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 3 Progetti</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 1 Chatbot (500 sessioni)</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2 opacity-50"><Icons.X size={16} /> Brand Monitor</li>
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
                                <li className="text-sm font-black text-stone-900 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 400 interviste / mese</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 10 Progetti</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 3 Bot (4.000 sessioni)</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2 text-amber-600 font-bold"><Icons.Check className="text-amber-500" size={16} /> Brand Monitor (800 query)</li>
                                <li className="text-sm font-medium text-stone-600 flex items-center gap-2 text-amber-600 font-bold"><Icons.Check className="text-amber-500" size={16} /> AI Tips & Suggestions</li>
                            </ul>
                            <Link href="/register?plan=PRO">
                                <Button fullWidth withShimmer>Prova 14gg gratis</Button>
                            </Link>
                        </div>

                        {/* Plan: BUSINESS */}
                        <div className="bg-stone-900 rounded-3xl p-8 border border-stone-800 flex flex-col text-white">
                            <h3 className="text-xl font-bold mb-1">Business</h3>
                            <div className="text-xs text-stone-500 font-bold uppercase tracking-widest mb-6">Per aziende strutturate</div>
                            <div className="mb-8"><span className="text-4xl font-black">€{isYearly ? 299 : 399}</span><span className="text-stone-500 text-sm">/mese</span></div>
                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 1.000 interviste / mese</li>
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Progetti Illimitati</li>
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> 10 Bot (12.000 sessioni)</li>
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Brand Monitor (4.000 query)</li>
                                <li className="text-sm font-medium text-stone-400 flex items-center gap-2"><Icons.Check className="text-amber-500" size={16} /> Priority Support</li>
                            </ul>
                            <Link href="/register?plan=BUSINESS">
                                <Button fullWidth variant="secondary" className="bg-white text-stone-900 border-transparent hover:bg-stone-100">Prova gratis</Button>
                            </Link>
                        </div>
                    </div>

                    {/* ENTERPRISE SECTION */}
                    <div className="mt-12 bg-white rounded-3xl p-8 border-2 border-dashed border-stone-200 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="text-xs font-black bg-stone-900 text-white px-3 py-1 rounded-full uppercase">Enterprise</div>
                                <h3 className="text-2xl font-bold text-stone-900">Hai esigenze specifiche?</h3>
                            </div>
                            <p className="text-stone-500 max-w-xl">
                                Per grandi organizzazioni offriamo soluzioni su misura: risorse dedicate, funzionalità custom, Webhook e API avanzate per integrare i dati nei tuoi sistemi aziendali.
                            </p>
                        </div>
                        <div className="flex-shrink-0">
                            <Link href="/contact">
                                <Button variant="secondary" className="px-8 border-stone-300 hover:border-stone-900 hover:bg-stone-50">Parla con noi</Button>
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
                            { quote: "Il nostro eCommerce di arredamento perdeva carrelli. L'AI ha scoperto che i clienti svizzeri non capivano i dazi. Abbiamo corretto con CMS Automation e recuperato il 15% di fatturato.", author: "Davide C.", role: "Founder, ArredoDesign", tool: "CMS Automation", note: "Funzionalità disponibile per clienti con sito sviluppato da Voler.ai" },
                            { quote: "Come agenzia, monitorare 20 clienti su ChatGPT era impossibile. Con Brand Monitor vediamo in un attimo chi sta perdendo visibilità e interveniamo.", author: "Elisa M.", role: "Digital Strategist", tool: "Brand Monitor" },
                            { quote: "I sondaggi tradizionali ci davano voti alti, ma i clienti continuavano ad andarsene. Le interviste intelligenti hanno fatto emergere il vero problema: l'assistenza post-vendita era lenta.", author: "Marco R.", role: "CEO Software B2B", tool: "Interviste Intelligenti" },
                            { quote: "Prima aprivamo 10 tool diversi. Ora con Strategic Copilot ho ogni lunedì la lista delle 3 cose da fare per migliorare.", author: "Laura F.", role: "Marketing Manager", tool: "Strategic Copilot" },
                        ].map((t, i) => (
                            <div key={i} className="p-10 rounded-[2.5rem] bg-stone-50 border border-stone-100 relative group hover:-translate-y-1 transition-all">
                                <Icons.Quote className="absolute top-6 right-8 text-stone-100 group-hover:text-amber-100 transition-colors" size={60} />
                                <div className="text-xs font-black text-amber-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Icons.Check size={14} /> {t.tool}
                                </div>
                                <p className="text-xl text-stone-700 leading-relaxed mb-8 italic">"{t.quote}"</p>
                                {'note' in t && t.note && (
                                    <p className="text-xs text-stone-400 italic mb-4">* {t.note}</p>
                                )}
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

                    {/* 
                    <div className="mt-20 pt-20 border-t border-stone-100 grid grid-cols-2 md:grid-cols-4 gap-8 text-center opacity-40 grayscale hover:grayscale-0 transition-all duration-700 cursor-default">
                        <div className="text-2xl font-black text-stone-900 flex items-center justify-center gap-2">Logo 1</div>
                        <div className="text-2xl font-black text-stone-900 flex items-center justify-center gap-2">Logo 2</div>
                        <div className="text-2xl font-black text-stone-900 flex items-center justify-center gap-2">Logo 3</div>
                        <div className="text-2xl font-black text-stone-900 flex items-center justify-center gap-2">Logo 4</div>
                    </div> 
                    */}
                </div>
            </section >

            {/* VOLER.AI CUSTOM DEVELOPMENT */}
            <section className="py-32 bg-stone-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F59E0B_1px,transparent_1px)] [background-size:24px_24px]"></div>
                <div className="container mx-auto px-6 max-w-7xl relative z-10">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="order-2 lg:order-1">
                            <SectionLabel text="Voler.ai Development" color="#F59E0B" bg="rgba(255,255,255,0.1)" />
                            <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tight">
                                ...e possiamo fare <br /><span className="text-amber-500">anche di più</span>
                            </h2>
                            <p className="text-xl text-stone-400 mb-10 leading-relaxed">
                                Sviluppiamo <strong className="text-white">siti AI Native</strong> con contenuti che si aggiornano in automatico per rispondere alle esigenze reali dei tuoi stakeholder.
                                Possiamo connettere anche il tuo sito esistente a Business Tuner per automatizzare news, FAQ, blog e molto altro.
                            </p>

                            <ul className="space-y-8">
                                <li className="flex gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center flex-shrink-0 text-amber-500 font-bold">01</div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-2">CMS Automation</h4>
                                        <p className="text-stone-400 text-sm">FAQ, descrizioni prodotto e contenuti del sito si aggiornano automaticamente basandosi sui feedback e sulle domande reali dei clienti.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center flex-shrink-0 text-amber-500 font-bold">02</div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-2">Workflow su misura</h4>
                                        <p className="text-stone-400 text-sm">Notifiche su Slack, ticket su Jira, alert via email: costruiamo automazioni personalizzate per i tuoi processi aziendali.</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center flex-shrink-0 text-amber-500 font-bold">03</div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-2">Integrazioni custom</h4>
                                        <p className="text-stone-400 text-sm">Colleghiamo Business Tuner ai tuoi CRM, ERP o sistemi interni per un flusso dati completamente automatizzato.</p>
                                    </div>
                                </li>
                            </ul>

                            <div className="mt-10">
                                <Link href="/contact">
                                    <Button variant="secondary" className="bg-white text-stone-900 border-transparent hover:bg-amber-50">
                                        Richiedi una consulenza
                                    </Button>
                                </Link>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2 bg-stone-800 rounded-3xl p-8 border border-stone-700 shadow-2xl relative">
                            {/* Mockup of an automation interface */}
                            <div className="space-y-4 font-mono text-sm">
                                <div className="flex items-center gap-2 text-green-400 mb-4 bg-black/20 p-2 rounded w-fit">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    <span>Automation Active</span>
                                </div>
                                <div className="p-4 bg-black/30 rounded-xl border border-stone-600">
                                    <div className="text-stone-500 text-xs uppercase mb-2">Trigger</div>
                                    <div className="text-white">Se {'>'} 5 clienti chiedono "Spedite in Svizzera?"</div>
                                </div>
                                <div className="flex justify-center"><Icons.ArrowRight className="rotate-90 text-stone-500" /></div>
                                <div className="p-4 bg-amber-500/20 rounded-xl border border-amber-500/50">
                                    <div className="text-amber-500 text-xs uppercase mb-2">Action: Update CMS</div>
                                    <div className="text-white">Aggiungi a /faq: <br /> <span className="text-amber-300">"Sì, spediamo in Svizzera con dazi inclusi..."</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 9. FAQ SECTION */}
            < section className="py-32 bg-[#FAFAF8]" >
                <div className="container mx-auto px-6 max-w-4xl">
                    <div className="text-center mb-16">
                        <SectionLabel text="FAQ" />
                        <h2 className="text-4xl font-bold text-stone-900 tracking-tight">Dubbi? Risposte.</h2>
                    </div>

                    <div className="space-y-4">
                        {[
                            { q: "Quanto tempo serve per iniziare?", a: "5 minuti. Scegli un template, personalizzalo e condividi il link. L'AI fa il resto." },
                            { q: "Devo avere competenze tecniche?", a: "Zero. Business Tuner è fatto per imprenditori, non per tecnici. Se sai usare WhatsApp, sai configurare il tuo primo osservatorio in 5 minuti." },
                            { q: "I dati sono sicuri?", a: "Sì. Usiamo server in Europa, criptiamo tutto e non usiamo MAI i tuoi dati per addestrare modelli pubblici. La tua proprietà intellettuale resta tua." },
                            { q: "Cosa succede se supero i limiti?", a: "Nessun blocco improvviso. Ti avvisiamo prima e puoi acquistare pacchetti extra di token o interviste con un click, senza dover per forza passare al piano superiore." },
                            { q: "Come funzionano i suggerimenti?", a: "L'AI analizza i buchi nelle tue FAQ, le lamentele ricorrenti nelle interviste e cosa dicono i competitor online. Poi ti propone azioni: 'Aggiungi questa risposta', 'Modifica questo prezzo'. Tu clicchi approva e procedi." },
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

                    <div className="mt-12 text-center">
                        <Link href="/faq">
                            <Button variant="secondary" className="px-8 rounded-full border-stone-200">
                                Leggi tutte le FAQ <Icons.ArrowRight className="ml-2" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section >

            {/* 10. FINAL CTA - Full Orange Gradient */}
            <section className="py-32 bg-gradient-to-br from-amber-500 to-orange-600 text-white relative overflow-hidden">
                {/* Decorative floating elements */}
                <motion.div
                    animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                    className="absolute top-10 left-10 w-60 h-60 bg-white/10 rounded-full blur-[80px]"
                />
                <motion.div
                    animate={{ y: [0, 15, 0], scale: [1, 0.9, 1] }}
                    transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
                    className="absolute bottom-10 right-10 w-80 h-80 bg-orange-300/20 rounded-full blur-[100px]"
                />
                <div className="container mx-auto px-6 max-w-5xl relative z-10">
                    <div className="text-center">
                        <h2 className="text-4xl lg:text-6xl font-black mb-8 tracking-tight">Pronto ad ascoltare <br />il tuo mercato?</h2>
                        <p className="text-xl lg:text-2xl text-amber-50 mb-12 max-w-2xl mx-auto leading-relaxed">
                            Inizia gratis con la Trial. 50 interviste e tutte le funzionalità Pro incluse per 14 giorni.
                            Nessun limite di tempo, nessuna carta richiesta.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Link href="/register">
                                <Button size="lg" className="bg-white text-stone-900 hover:bg-stone-50 border-none px-12 py-7 rounded-full text-lg h-auto shadow-2xl shadow-black/20 hover:scale-105 transition-transform">
                                    Inizia gratis ora <Icons.ArrowRight className="ml-2" />
                                </Button>
                            </Link>
                            <a href="mailto:info@voler.ai" className="text-white font-bold hover:text-amber-100 transition-colors underline underline-offset-4">Prenota una demo personalizzata</a>
                        </div>
                    </div>
                </div>
            </section>
        </div >
    );
}
