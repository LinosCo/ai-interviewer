'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/business-tuner/Button';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { getTemplateBySlug } from '@/lib/onboarding-templates';
import { colors, gradients } from '@/lib/design-system';

const loadingMessages = [
    { text: 'Sto analizzando il tuo obiettivo...', icon: <Icons.Search size={20} /> },
    { text: 'Definisco le domande giuste...', icon: <Icons.BrainCircuit size={20} /> },
    { text: 'Applico le best practice di ricerca qualitativa...', icon: <Icons.BookOpen size={20} /> },
    { text: 'Ottimizzo il flusso conversazionale...', icon: <Icons.Sparkles size={20} /> },
    { text: 'Preparo la tua intervista...', icon: <Icons.Target size={20} /> },
];

function GenerateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const goal = searchParams.get('goal');
    const templateSlug = searchParams.get('template');

    useEffect(() => {
        const generateInterview = async () => {
            try {
                // Animate through loading messages
                const interval = setInterval(() => {
                    setCurrentStep((prev) => {
                        if (prev < loadingMessages.length - 1) return prev + 1;
                        return prev;
                    });
                }, 1500);

                let configToUse: any;

                if (templateSlug) {
                    // Use template config
                    const template = getTemplateBySlug(templateSlug);
                    if (!template) {
                        throw new Error('Template non trovato');
                    }
                    configToUse = {
                        ...template.defaultConfig,
                        name: template.name,
                        fromTemplate: template.id,
                    };
                } else if (goal) {
                    // Generate via API
                    const response = await fetch('/api/bots/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ goal }),
                    });

                    if (!response.ok) {
                        throw new Error('Errore nella generazione');
                    }

                    configToUse = await response.json();
                } else {
                    throw new Error('Nessun obiettivo specificato');
                }

                clearInterval(interval);

                // Store config in sessionStorage and navigate to preview
                sessionStorage.setItem('generatedConfig', JSON.stringify(configToUse));
                router.push('/onboarding/preview');

            } catch (err: any) {
                setError(err.message || 'Errore sconosciuto');
            }
        };

        generateInterview();
    }, [goal, templateSlug, router]);

    if (error) {
        return (
            <div style={{
                minHeight: '100vh',
                background: `linear-gradient(135deg, #FFFBEB 0%, #FFF 50%, #FEF3C7 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem'
            }}>
                <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>😕</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: colors.text, marginBottom: '1rem' }}>Qualcosa è andato storto</h2>
                    <p style={{ color: colors.muted, marginBottom: '2rem' }}>{error}</p>
                    <Button
                        onClick={() => router.push('/onboarding')}
                        variant="primary"
                    >
                        Riprova
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(135deg, #FFFBEB 0%, #FFF 50%, #FEF3C7 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Ambient Background */}
            <div style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: `
                    radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.peach}40 0%, transparent 50%),
                    radial-gradient(ellipse 60% 40% at 100% 30%, ${colors.rose}25 0%, transparent 40%),
                    radial-gradient(ellipse 50% 30% at 0% 60%, ${colors.lavender}20 0%, transparent 35%)
                `
            }} />

            <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                {/* Business Tuner Logo with Animation */}
                <div style={{ marginBottom: '3rem' }}>
                    <div style={{
                        width: '120px',
                        height: '120px',
                        margin: '0 auto',
                        position: 'relative'
                    }}>
                        {/* Animated Ring */}
                        <div style={{
                            position: 'absolute',
                            inset: '-10px',
                            borderRadius: '50%',
                            background: `conic-gradient(from 0deg, ${colors.amber}, ${colors.gold}, ${colors.amberDark}, ${colors.amber})`,
                            opacity: 0.3,
                            animation: 'spin 3s linear infinite'
                        }} />

                        {/* Logo */}
                        <svg width="120" height="120" viewBox="0 0 48 48" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                            <defs>
                                <linearGradient id="logoGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#D97706" />
                                    <stop offset="50%" stopColor="#F59E0B" />
                                    <stop offset="100%" stopColor="#FBBF24" />
                                </linearGradient>
                            </defs>
                            <rect width="48" height="48" rx="14" fill="url(#logoGradient)" />
                            <g fill="white" opacity="0.9">
                                <rect x="8" y="28" width="5" height="12" rx="2" opacity="0.4" />
                                <rect x="15" y="24" width="5" height="16" rx="2" opacity="0.55" />
                                <rect x="22" y="18" width="5" height="22" rx="2" opacity="0.7" />
                                <rect x="29" y="14" width="5" height="26" rx="2" opacity="0.85" />
                                <rect x="36" y="20" width="5" height="20" rx="2" opacity="0.7" />
                            </g>
                            <path
                                d="M10 34 L17.5 30 L24.5 22 L31.5 16 L38.5 22"
                                stroke="white"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                            <circle cx="31.5" cy="16" r="3" fill="white" />
                        </svg>
                    </div>
                </div>

                {/* Loading Messages */}
                <div style={{ marginBottom: '3rem' }}>
                    {loadingMessages.map((msg, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                marginBottom: '1.5rem',
                                transition: 'all 0.5s ease',
                                opacity: index <= currentStep ? 1 : 0.3,
                                transform: index <= currentStep ? 'translateY(0)' : 'translateY(1rem)'
                            }}
                        >
                            {index < currentStep ? (
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: colors.successLight,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: `1px solid ${colors.success}40`,
                                    flexShrink: 0
                                }}>
                                    <Icons.Check size={16} color={colors.success} />
                                </div>
                            ) : index === currentStep ? (
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: `${colors.amber}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: `1px solid ${colors.amber}40`,
                                    animation: 'pulse 2s infinite',
                                    flexShrink: 0
                                }}>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: colors.amber
                                    }} />
                                </div>
                            ) : (
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    border: `1px solid ${colors.light}`,
                                    flexShrink: 0
                                }} />
                            )}
                            <div style={{
                                textAlign: 'left',
                                flex: 1,
                                color: index <= currentStep ? colors.text : colors.subtle
                            }}>
                                <p style={{ fontWeight: 500, fontSize: '0.9375rem', margin: 0 }}>{msg.text}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Goal Preview */}
                {goal && (
                    <div style={{
                        padding: '1.5rem',
                        background: 'rgba(255,255,255,0.8)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '20px',
                        border: `1px solid ${colors.amber}20`,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.05)'
                    }}>
                        <p style={{
                            fontSize: '0.75rem',
                            color: colors.subtle,
                            marginBottom: '0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontWeight: 600
                        }}>
                            Il tuo obiettivo
                        </p>
                        <p style={{ color: colors.text, fontWeight: 500, margin: 0 }}>{goal}</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                }
            `}</style>
        </div>
    );
}

function LoadingFallback() {
    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(135deg, #FFFBEB 0%, #FFF 50%, #FEF3C7 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{
                width: '96px',
                height: '96px',
                background: `${colors.amber}10`,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 2s infinite'
            }}>
                <Icons.Sparkles size={40} color={colors.amber} />
            </div>
        </div>
    );
}

export default function GeneratePage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <GenerateContent />
        </Suspense>
    );
}
