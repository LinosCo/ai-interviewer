'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';

export default function LandingPage() {
    const [mounted, setMounted] = useState(false);
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        setMounted(true);
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Soft Wave Separator (Redesigned: Noise + Harmonization)
    const SoftWaveSeparator = ({ accentColor = colors.amber, height = 300, id = 'wave1' }) => (
        <div style={{
            width: '100%',
            height: `${height}px`,
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(180deg, ${colors.white} 0%, transparent 100%)`
        }}>
            <svg
                style={{ position: 'absolute', width: '200%', left: '-50%', top: 0, height: '100%' }}
                viewBox={`0 0 2880 ${height}`}
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id={`softFade${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="white" stopOpacity="0" />
                        <stop offset="30%" stopColor="white" stopOpacity="1" />
                        <stop offset="70%" stopColor="white" stopOpacity="1" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                    <mask id={`fadeMask${id}`}>
                        <rect width="100%" height="100%" fill={`url(#softFade${id})`} />
                    </mask>
                </defs>

                <g mask={`url(#fadeMask${id})`}>
                    {/* Line 1: Background Noise (Chaotic, High Frequency) */}
                    <path
                        d={`M0 ${height / 2} C 200 ${height * 0.25} 400 ${height * 0.75} 600 ${height * 0.35} C 800 ${height * 0.65} 1000 ${height * 0.3} 1200 ${height * 0.7} C 1400 ${height * 0.4} 1600 ${height * 0.6} 1800 ${height / 2} C 2000 ${height * 0.35} 2200 ${height * 0.65} 2400 ${height * 0.45} C 2600 ${height * 0.55} 2800 ${height * 0.4} 2880 ${height / 2}`}
                        fill="none" stroke={accentColor} strokeWidth="0.8" opacity="0.25" strokeLinecap="round"
                    >
                        <animate attributeName="d" dur="8s" repeatCount="indefinite" values={`
                            M0 ${height / 2} C 200 ${height * 0.25} 400 ${height * 0.75} 600 ${height * 0.35} C 800 ${height * 0.65} 1000 ${height * 0.3} 1200 ${height * 0.7} C 1400 ${height * 0.4} 1600 ${height * 0.6} 1800 ${height / 2} C 2000 ${height * 0.35} 2200 ${height * 0.65} 2400 ${height * 0.45} C 2600 ${height * 0.55} 2800 ${height * 0.4} 2880 ${height / 2};
                            M0 ${height / 2} C 200 ${height * 0.7} 400 ${height * 0.3} 600 ${height * 0.65} C 800 ${height * 0.35} 1000 ${height * 0.75} 1200 ${height * 0.25} C 1400 ${height * 0.6} 1600 ${height * 0.4} 1800 ${height / 2} C 2000 ${height * 0.7} 2200 ${height * 0.3} 2400 ${height * 0.6} C 2600 ${height * 0.4} 2800 ${height * 0.65} 2880 ${height / 2};
                            M0 ${height / 2} C 200 ${height * 0.25} 400 ${height * 0.75} 600 ${height * 0.35} C 800 ${height * 0.65} 1000 ${height * 0.3} 1200 ${height * 0.7} C 1400 ${height * 0.4} 1600 ${height * 0.6} 1800 ${height / 2} C 2000 ${height * 0.35} 2200 ${height * 0.65} 2400 ${height * 0.45} C 2600 ${height * 0.55} 2800 ${height * 0.4} 2880 ${height / 2}
                        `} />
                    </path>

                    {/* Line 2: Background Noise (Chaotic, Offset, Different Frequency) */}
                    <path
                        d={`M0 ${height / 2 + 20} C 150 ${height * 0.65} 350 ${height * 0.35} 550 ${height * 0.7} C 750 ${height * 0.3} 950 ${height * 0.6} 1150 ${height * 0.4} C 1350 ${height * 0.75} 1550 ${height * 0.25} 1750 ${height / 2 + 20} C 1950 ${height * 0.6} 2150 ${height * 0.4} 2350 ${height * 0.7} C 2550 ${height * 0.3} 2750 ${height * 0.55} 2880 ${height / 2 + 20}`}
                        fill="none" stroke={accentColor} strokeWidth="0.8" opacity="0.18" strokeLinecap="round"
                    >
                        <animate attributeName="d" dur="11s" repeatCount="indefinite" values={`
                            M0 ${height / 2 + 20} C 150 ${height * 0.65} 350 ${height * 0.35} 550 ${height * 0.7} C 750 ${height * 0.3} 950 ${height * 0.6} 1150 ${height * 0.4} C 1350 ${height * 0.75} 1550 ${height * 0.25} 1750 ${height / 2 + 20} C 1950 ${height * 0.6} 2150 ${height * 0.4} 2350 ${height * 0.7} C 2550 ${height * 0.3} 2750 ${height * 0.55} 2880 ${height / 2 + 20};
                            M0 ${height / 2 + 20} C 150 ${height * 0.3} 350 ${height * 0.7} 550 ${height * 0.25} C 750 ${height * 0.75} 950 ${height * 0.35} 1150 ${height * 0.65} C 1350 ${height * 0.3} 1550 ${height * 0.7} 1750 ${height / 2 + 20} C 1950 ${height * 0.35} 2150 ${height * 0.65} 2350 ${height * 0.3} C 2550 ${height * 0.7} 2750 ${height * 0.4} 2880 ${height / 2 + 20};
                            M0 ${height / 2 + 20} C 150 ${height * 0.65} 350 ${height * 0.35} 550 ${height * 0.7} C 750 ${height * 0.3} 950 ${height * 0.6} 1150 ${height * 0.4} C 1350 ${height * 0.75} 1550 ${height * 0.25} 1750 ${height / 2 + 20} C 1950 ${height * 0.6} 2150 ${height * 0.4} 2350 ${height * 0.7} C 2550 ${height * 0.3} 2750 ${height * 0.55} 2880 ${height / 2 + 20}
                        `} />
                    </path>

                    {/* Line 3: Harmonization (Thicker, Smooth, Rhythmic) */}
                    <path
                        d={`M0 ${height / 2} Q 360 ${height * 0.35} 720 ${height / 2} T 1440 ${height / 2} T 2160 ${height / 2} T 2880 ${height / 2}`}
                        fill="none" stroke={accentColor} strokeWidth="3.5" opacity="0.85" strokeLinecap="round"
                    >
                        <animate attributeName="d" dur="10s" repeatCount="indefinite" values={`
                             M0 ${height / 2} Q 360 ${height * 0.35} 720 ${height / 2} T 1440 ${height / 2} T 2160 ${height / 2} T 2880 ${height / 2};
                             M0 ${height / 2} Q 360 ${height * 0.65} 720 ${height / 2} T 1440 ${height / 2} T 2160 ${height / 2} T 2880 ${height / 2};
                             M0 ${height / 2} Q 360 ${height * 0.35} 720 ${height / 2} T 1440 ${height / 2} T 2160 ${height / 2} T 2880 ${height / 2}
                        `} />
                    </path>
                </g>
            </svg>
        </div>
    );

    // Soft Chart Separator
    const SoftChartSeparator = ({ color = colors.amber, height = 280, id = 'chart1' }) => (
        <div style={{
            width: '100%', height: `${height}px`, position: 'relative', overflow: 'hidden',
            background: `linear-gradient(180deg, ${colors.white} 0%, transparent 12%, transparent 88%, ${colors.white} 100%)`
        }}>
            <svg style={{ width: '100%', height: '100%' }} viewBox={`0 0 1440 ${height}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`chartFade${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity="0" />
                        <stop offset="20%" stopColor={color} stopOpacity="1" />
                        <stop offset="80%" stopColor={color} stopOpacity="1" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {Array.from({ length: 55 }).map((_, i) => {
                    const x = i * 26 + 8;
                    const baseH = 60 + Math.sin(i * 0.28) * 35 + Math.cos(i * 0.45) * 25;
                    return (
                        <rect key={i} x={x} y={height / 2 - baseH / 2} width="16" height={baseH} rx="6" fill={`url(#chartFade${id})`} opacity={0.05 + Math.sin(i * 0.18) * 0.025}>
                            <animate attributeName="height" values={`${baseH};${baseH * 0.55};${baseH * 1.15};${baseH}`} dur={`${2.8 + (i % 8) * 0.25}s`} repeatCount="indefinite" />
                        </rect>
                    );
                })}
            </svg>
        </div>
    );

    // Orange Transition Component (Improved Smoothing)
    const OrangeTransition = ({ toOrange = true, height = 300 }) => (
        <div style={{
            width: '100%', height: `${height}px`, position: 'relative', overflow: 'hidden',
            background: toOrange
                ? `linear-gradient(to bottom, 
                    ${colors.white} 0%, 
                    #FFFBF0 20%, 
                    #FFECC0 50%, 
                    #FFDB90 80%,
                    #F59E0B 100%)`
                : `linear-gradient(to bottom, 
                    #F59E0B 0%, 
                    #FFDB90 20%,
                    #FFECC0 50%, 
                    #FFFBF0 80%, 
                    ${colors.white} 100%)`
        }} />
    );

    return (
        <div style={{ minHeight: '100vh', fontFamily: "'Inter', sans-serif", background: colors.white, position: 'relative', overflowX: 'hidden' }}>

            {/* Dynamic Background */}
            <div style={{
                position: 'fixed', inset: 0, pointerEvents: 'none',
                background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.peach}50 0%, transparent 50%),
          radial-gradient(ellipse 60% 40% at 100% 30%, ${colors.rose}30 0%, transparent 40%),
          radial-gradient(ellipse 50% 30% at 0% 60%, ${colors.lavender}25 0%, transparent 35%),
          ${colors.white}
        `
            }} />

            {/* Global Styles for Keyframes */}
            <style jsx global>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.3); } 50% { box-shadow: 0 0 40px rgba(251, 191, 36, 0.5); } }
        @keyframes waveTyping { 0%, 100% { transform: scaleY(0.4); opacity: 0.5; } 50% { transform: scaleY(1); opacity: 1; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>

            {/* Hero Section */}
            <section style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: '80px' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 3rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>

                    {/* Hero Content */}
                    <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(40px)', transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '100px', marginBottom: '1.5rem' }}>
                            <div style={{ width: '8px', height: '8px', background: `linear-gradient(135deg, ${colors.gold}, ${colors.amber})`, borderRadius: '50%', animation: 'glow 2s ease-in-out infinite' }} />
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, background: `linear-gradient(90deg, ${colors.amberDark}, ${colors.amber}, ${colors.amberDark})`, backgroundSize: '200% 100%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'shimmer 3s linear infinite' }}>
                                Interviste qualitative con AI
                            </span>
                        </div>

                        <h1 style={{ fontSize: '4rem', fontWeight: 600, color: colors.text, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '1.5rem' }}>
                            Ascolta il mercato.
                            <br />
                            <span style={{ background: gradients.brand, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                Decidi meglio.
                            </span>
                        </h1>

                        <p style={{ fontSize: '1.25rem', color: colors.muted, lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '480px' }}>
                            Crea interviste intelligenti in 10 minuti. Raccogli feedback veri da clienti, dipendenti e partner.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
                            <Link href="/register">
                                <Button size="lg" withShimmer>
                                    Inizia gratis <Icons.ArrowRight size={18} />
                                </Button>
                            </Link>
                            <Link href="/onboarding/preview">
                                <Button variant="secondary" size="lg">
                                    <Icons.Play size={18} /> Guarda come funziona (2 min)
                                </Button>
                            </Link>
                        </div>

                        {/* Use Case Pills */}
                        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                            {[
                                { label: 'Customer Feedback' },
                                { label: 'Exit Interview' },
                                { label: 'Clima Aziendale' },
                                { label: 'NPS Qualitativo' },
                                { label: 'Win/Loss Analysis' }
                            ].map((uc, i) => (
                                <div key={i} style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '100px', color: colors.subtle, fontSize: '0.8125rem', fontWeight: 500 }}>
                                    {uc.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hero Visual (Floating Card) */}
                    <div style={{ position: 'relative', opacity: mounted ? 1 : 0, transform: mounted ? 'translateX(0)' : 'translateX(50px)', transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s' }}>
                        {/* Abstract Blur blobs */}
                        <div style={{ position: 'absolute', top: '5%', left: '5%', right: '5%', bottom: '5%', background: `radial-gradient(ellipse, ${colors.gold}25 0%, transparent 60%)`, filter: 'blur(40px)' }} />

                        <div style={{ position: 'relative', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderRadius: '28px', boxShadow: `0 30px 60px -10px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.8)`, overflow: 'hidden', animation: 'float 6s ease-in-out infinite' }}>
                            {/* Chat Header */}
                            <div style={{ background: `linear-gradient(135deg, ${colors.gold} 0%, ${colors.amber} 50%, ${colors.coral}90 100%)`, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                                <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icons.Chat size={22} color="white" />
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: 600, fontSize: '1rem' }}>Feedback Clienti Q4</div>
                                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>12 risposte · 3 in corso</div>
                                </div>
                            </div>

                            {/* Chat Body */}
                            <div style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                    <div style={{ width: '36px', height: '36px', background: `linear-gradient(135deg, ${colors.peach}, ${colors.apricot})`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icons.Logo size={20} /></div>
                                    <div style={{ background: 'rgba(255,255,255,0.9)', padding: '0.875rem 1rem', borderRadius: '18px', borderTopLeftRadius: '6px', maxWidth: '85%' }}>
                                        <p style={{ fontSize: '0.9375rem', color: colors.text, margin: 0 }}>Cosa ti ha portato a scegliere il nostro servizio?</p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
                                    <div style={{ background: gradients.primary, padding: '0.875rem 1rem', borderRadius: '18px', borderTopRightRadius: '6px', maxWidth: '85%', boxShadow: `0 4px 15px ${colors.amber}30` }}>
                                        <p style={{ fontSize: '0.9375rem', color: 'white', margin: 0 }}>Cercavo più flessibilità. I competitor avevano contratti rigidi...</p>
                                    </div>
                                </div>

                                {/* Typing Indicator */}
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ width: '36px', height: '36px', background: `linear-gradient(135deg, ${colors.peach}, ${colors.apricot})`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icons.Logo size={20} /></div>
                                    <div style={{ background: 'rgba(255,255,255,0.9)', padding: '0.875rem 1rem', borderRadius: '18px', borderTopLeftRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        {[0, 1, 2, 3, 4].map(i => (
                                            <div key={i} style={{ width: '3px', height: '14px', background: `linear-gradient(to top, ${colors.amber}, ${colors.gold})`, borderRadius: '2px', animation: 'waveTyping 0.8s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Insights */}
                        <div style={{ position: 'absolute', bottom: '-30px', left: '-50px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', borderRadius: '18px', padding: '1rem 1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', maxWidth: '200px', transform: `translateY(${scrollY * 0.015}px)` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <div style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}><Icons.Zap size={14} /></div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.text }}>Tema emergente</span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: colors.muted, margin: 0 }}>"Flessibilità" citata dal <strong style={{ color: colors.amber }}>67%</strong></p>
                        </div>
                    </div>
                </div>
            </section>

            <SoftWaveSeparator accentColor={colors.amber} height={320} id="sep1" />

            {/* Stats Section */}
            <section style={{ position: 'relative', zIndex: 10, padding: '3rem 2rem' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'center', gap: '6rem' }}>
                    {[{ value: '70%+', label: 'Completion rate medio' }, { value: '10 min', label: "Per creare un'intervista" }, { value: '1/10', label: 'Del costo ricerca tradizionale' }].map((stat, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', fontWeight: 600, background: `linear-gradient(135deg, ${colors.amberDark}, ${colors.gold})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stat.value}</div>
                            <div style={{ fontSize: '0.9375rem', color: colors.subtle }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            <SoftChartSeparator color={colors.amber} height={300} id="sep2" />

            {/* How it works */}
            <section id="how-it-works" style={{ position: 'relative', zIndex: 10, padding: '3rem 2rem 4rem' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, color: colors.amberDark, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(251,191,36,0.1)', padding: '0.5rem 1rem', borderRadius: '100px', marginBottom: '1.5rem' }}>Come funziona</span>
                    <h2 style={{ fontSize: '3rem', fontWeight: 600, color: colors.text, letterSpacing: '-0.02em', marginBottom: '4rem' }}>
                        Da zero a insight in <span style={{ color: colors.amber }}>4 passi</span>
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
                        {[{ num: '01', title: 'Descrivi cosa vuoi sapere', desc: 'Scrivi il tuo obiettivo in linguaggio naturale.' }, { num: '02', title: 'L\'AI costruisce l\'intervista', desc: 'Domande e flusso generati in secondi.' }, { num: '03', title: 'Condividi e raccogli', desc: 'Un link. Risposte da mobile o desktop.' }, { num: '04', title: 'Leggi gli insight', desc: 'Temi, sentiment e citazioni estratti automaticamente.' }].map((step, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(15px)', borderRadius: '24px', padding: '2rem 1.5rem', boxShadow: '0 15px 40px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.8)' }}>
                                <div style={{ width: '56px', height: '56px', background: `linear-gradient(135deg, ${colors.peach}, ${colors.apricot})`, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.125rem', fontWeight: 700, color: colors.amberDark }}>{step.num}</div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: colors.text, marginBottom: '0.5rem' }}>{step.title}</h3>
                                <p style={{ fontSize: '0.875rem', color: colors.muted, lineHeight: 1.5, margin: 0 }}>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <SoftWaveSeparator accentColor={colors.amber} height={200} id="sep3" />

            {/* Use Cases Section */}
            <section id="use-cases" style={{ position: 'relative', zIndex: 10, padding: '4rem 2rem 6rem' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, color: colors.amberDark, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(251,191,36,0.1)', padding: '0.5rem 1rem', borderRadius: '100px', marginBottom: '1.5rem' }}>Casi d'uso</span>
                        <h2 style={{ fontSize: '3rem', fontWeight: 600, color: colors.text, marginBottom: '1.5rem' }}>Per chi è Business Tuner?</h2>
                        <p style={{ fontSize: '1.125rem', color: colors.muted, maxWidth: '600px', margin: '0 auto' }}>
                            La flessibilità dell'AI conversazionale si adatta a ogni esigenza di ricerca.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
                        {[
                            { icon: Icons.Building, title: 'B2B & SaaS', desc: 'Capisci perché i clienti non rinnovano, valida nuove feature e analizza il churn con interviste profonde.', color: colors.amber },
                            { icon: Icons.Cart, title: 'B2C & E-commerce', desc: 'Testa nuovi packaging, prezzi o campagne. Raccogli feedback "a caldo" dopo l\'acquisto.', color: colors.apricot },
                            { icon: Icons.Users, title: 'HR & People', desc: 'Exit interview automatizzate, survey sul clima aziendale e feedback sui processi interni.', color: colors.peach },
                            { icon: Icons.Settings, title: 'Operations', desc: 'Feedback fornitori, audit interni, raccolta segnalazioni.', color: colors.lavender }
                        ].map((uc, i) => (
                            <div key={i} style={{ background: 'white', borderRadius: '24px', padding: '2.5rem', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.03)', transition: 'transform 0.3s ease' }}>
                                <div style={{ width: '48px', height: '48px', background: `linear-gradient(135deg, ${uc.color}, ${colors.white})`, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: colors.text }}>
                                    <uc.icon size={24} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: colors.text, marginBottom: '0.75rem' }}>{uc.title}</h3>
                                <p style={{ fontSize: '0.9375rem', color: colors.muted, lineHeight: 1.6 }}>{uc.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <SoftWaveSeparator accentColor={colors.amber} height={200} id="sep4" />

            {/* Why it Works Section */}
            <section id="why-it-works" style={{ position: 'relative', zIndex: 10, padding: '4rem 2rem 6rem' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, color: colors.amberDark, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(251,191,36,0.1)', padding: '0.5rem 1rem', borderRadius: '100px', marginBottom: '1.5rem' }}>Perché funziona</span>
                        <h2 style={{ fontSize: '3rem', fontWeight: 600, color: colors.text, marginBottom: '1.5rem' }}>Perché funziona meglio di un form</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
                        {[
                            { title: 'Conversazione, non caselle', desc: 'Le persone rispondono meglio a domande che si adattano a quello che dicono.' },
                            { title: '70% di completamento', desc: 'I form si abbandonano. Le conversazioni si finiscono.' },
                            { title: 'Pronto in 10 minuti', desc: 'Niente settimane di progettazione. Descrivi l\'obiettivo, il resto lo fa l\'AI.' },
                            { title: '1/10 del costo', desc: 'Niente consulenti, niente software enterprise. Solo risposte.' }
                        ].map((item, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(15px)', borderRadius: '24px', padding: '2rem 1.5rem', boxShadow: '0 15px 40px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.8)' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: colors.text, marginBottom: '0.75rem' }}>{item.title}</h3>
                                <p style={{ fontSize: '0.9375rem', color: colors.muted, lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <OrangeTransition toOrange={true} height={200} />

            {/* Pricing Section */}
            <section id="pricing" style={{ position: 'relative', zIndex: 10, background: '#F59E0B', padding: '4rem 2rem 6rem', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 120% 60% at 50% -10%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(ellipse 100% 40% at 50% 110%, rgba(255,255,255,0.2) 0%, transparent 40%)` }} />

                <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 5 }}>
                    <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', padding: '0.5rem 1rem', borderRadius: '100px', marginBottom: '1.5rem' }}>Prezzi semplici</span>
                        <h2 style={{ fontSize: '3rem', fontWeight: 600, color: 'white', letterSpacing: '-0.02em', marginBottom: '1rem', textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>Scegli il piano giusto per te</h2>
                        <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.9)', maxWidth: '500px', margin: '0 auto' }}>Inizia gratis, scala quando serve. Nessun vincolo.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
                        {/* Starter */}
                        <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', borderRadius: '28px', padding: '2.5rem 2rem', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '2rem' }}><h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>Starter</h3><p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>Per il professionista</p></div>
                            <div style={{ marginBottom: '2rem' }}><span style={{ fontSize: '3rem', fontWeight: 700, color: 'white' }}>€39</span><span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.8)' }}>/mese</span></div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1 }}>{['3 interviste attive', '100 risposte/mese', 'Analytics completi', 'Export PDF'].map((f, i) => (<li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', color: 'white', fontSize: '0.9375rem' }}><Icons.Check size={18} />{f}</li>))}</ul>
                            <Link href="/register?plan=STARTER" className="w-full">
                                <Button fullWidth style={{ background: 'white', color: colors.amberDark, fontWeight: 600, border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                                    Prova 14 giorni gratis
                                </Button>
                            </Link>
                        </div>

                        {/* Professional */}
                        <div style={{ background: 'white', borderRadius: '28px', padding: '2.5rem 2rem', boxShadow: '0 30px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', transform: 'scale(1.05)', position: 'relative', zIndex: 2 }}>
                            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#78350F', padding: '0.375rem 1rem', borderRadius: '100px', fontSize: '0.6875rem', fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Più popolare</div>
                            <div style={{ marginBottom: '2rem' }}><h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: colors.text, marginBottom: '0.5rem' }}>Pro</h3><p style={{ fontSize: '0.875rem', color: colors.muted, margin: 0 }}>Per la PMI</p></div>
                            <div style={{ marginBottom: '2rem' }}><span style={{ fontSize: '3rem', fontWeight: 700, color: colors.text }}>€99</span><span style={{ fontSize: '1rem', color: colors.muted }}>/mese</span></div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1 }}>{['10 interviste attive', '300 risposte/mese', 'Knowledge Base AI', 'Logica condizionale', 'Trend & Confronti', 'Export CSV + Webhook'].map((f, i) => (<li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', color: colors.text, fontSize: '0.9375rem' }}><div style={{ color: colors.amber }}><Icons.Check size={18} /></div>{f}</li>))}</ul>
                            <Link href="/register?plan=PRO" className="w-full">
                                <Button fullWidth variant="primary" style={{ boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.4)' }}>Prova 14 giorni gratis →</Button>
                            </Link>
                        </div>

                        {/* Business */}
                        <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', borderRadius: '28px', padding: '2.5rem 2rem', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ marginBottom: '2rem' }}><h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>Business</h3><p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>Per l'azienda strutturata</p></div>
                            <div style={{ marginBottom: '2rem' }}><span style={{ fontSize: '3rem', fontWeight: 700, color: 'white' }}>€249</span><span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.8)' }}>/mese</span></div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1 }}>{['Interviste illimitate', '1.000 risposte/mese', 'White label completo', 'Dominio personalizzato', 'API REST + Zapier', 'Onboarding dedicato'].map((f, i) => (<li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', color: 'white', fontSize: '0.9375rem' }}><Icons.Check size={18} />{f}</li>))}</ul>
                            <Link href="mailto:sales@businesstuner.it" className="w-full">
                                <Button fullWidth style={{ background: 'white', color: colors.amberDark, fontWeight: 600, border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                                    Contattaci
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <OrangeTransition toOrange={false} height={200} />

            {/* Final CTA Section */}
            <section id="final-cta" style={{ position: 'relative', zIndex: 10, padding: '6rem 2rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '3.5rem', fontWeight: 600, color: colors.text, letterSpacing: '-0.02em', marginBottom: '1.5rem' }}>
                        Inizia ad ascoltare. <span style={{ background: gradients.brand, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>È gratis.</span>
                    </h2>
                    <p style={{ fontSize: '1.25rem', color: colors.muted, marginBottom: '3rem', lineHeight: 1.7 }}>
                        Crea la tua prima intervista in 10 minuti. Nessuna carta di credito richiesta.
                    </p>
                    <Link href="/register">
                        <Button size="lg" withShimmer style={{ fontSize: '1.125rem', padding: '1.25rem 3rem' }}>
                            Inizia ora <Icons.ArrowRight size={20} />
                        </Button>
                    </Link>
                </div>
            </section>

            <SoftChartSeparator color={colors.amber} height={280} id="sep5" />

            {/* Testimonials */}
            <section style={{ position: 'relative', zIndex: 10, padding: '3rem 2rem 4rem' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderRadius: '32px', padding: '3rem', boxShadow: '0 25px 60px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.9)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginBottom: '1.5rem' }}>{[0, 1, 2, 3, 4].map(i => <div key={i} style={{ color: colors.gold }}><Icons.Star size={20} /></div>)}</div>
                        <p style={{ fontSize: '1.375rem', color: colors.text, lineHeight: 1.7, marginBottom: '1.5rem', fontStyle: 'italic' }}>"Abbiamo raccolto più insight in una settimana che in sei mesi di survey tradizionali. I clienti rispondono perché sembra una conversazione vera."</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                            <div style={{ width: '48px', height: '48px', background: `linear-gradient(135deg, ${colors.peach}, ${colors.apricot})`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', fontWeight: 600, color: colors.amberDark }}>MR</div>
                            <div style={{ textAlign: 'left' }}><div style={{ fontWeight: 600, color: colors.text }}>Marco Rossi</div><div style={{ fontSize: '0.875rem', color: colors.subtle }}>Head of CX, TechCorp Italia</div></div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
