'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TEMPLATES, Template } from '@/lib/onboarding-templates';
import { Sparkles, ArrowRight, LayoutTemplate } from 'lucide-react';
import { colors, gradients } from '@/lib/design-system';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Icons } from '@/components/ui/business-tuner/Icons';

const examplePrompts = [
    'B2B: Vorrei capire perché i miei clienti SaaS non rinnovano il contratto dopo il primo anno',
    'B2C: Voglio analizzare le reazioni dei consumatori al nuovo packaging sostenibile',
    'HR: Devo scoprire le vere cause del turnover nel reparto vendite',
    'Ops: Voglio capire i problemi di comunicazione tra reparto logistica e produzione',
];

export default function OnboardingPage() {
    const router = useRouter();
    const [goal, setGoal] = useState('');
    const [showTemplates, setShowTemplates] = useState(false);

    const handleGenerate = () => {
        if (!goal.trim()) return;
        const encoded = encodeURIComponent(goal);
        router.push(`/onboarding/generate?goal=${encoded}`);
    };

    const handleTemplateSelect = (template: Template) => {
        const encoded = encodeURIComponent(template.id);
        router.push(`/onboarding/generate?template=${encoded}`);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(135deg, #FFFBEB 0%, #FFF 50%, #FEF3C7 100%)`,
            fontFamily: "'Inter', sans-serif",
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Decorative Background Elements */}
            <div style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                background: `
                    radial-gradient(ellipse 80% 50% at 50% -20%, ${colors.peach}40 0%, transparent 50%),
                    radial-gradient(ellipse 60% 40% at 100% 30%, ${colors.rose}25 0%, transparent 40%),
                    radial-gradient(ellipse 50% 30% at 0% 60%, ${colors.lavender}20 0%, transparent 35%)
                `
            }} />

            {/* Dashboard-style Header */}
            <header style={{
                padding: '1rem 2rem',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                zIndex: 20
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        background: gradients.primary,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <Icons.Logo size={20} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '1.125rem', color: colors.text }}>Business Tuner</span>
                </div>
                <button
                    onClick={() => router.push('/dashboard')}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        background: 'white',
                        border: '1px solid rgba(0,0,0,0.1)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: colors.text,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                    <LayoutTemplate size={16} /> Dashboard
                </button>
            </header>

            {/* Main Content */}
            <main style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1.5rem',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{ maxWidth: '800px', width: '100%' }}>
                    {!showTemplates ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* Title */}
                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                <h2 style={{
                                    fontSize: '3.5rem',
                                    fontWeight: 700,
                                    color: colors.text,
                                    marginBottom: '1rem',
                                    letterSpacing: '-0.02em'
                                }}>
                                    Cosa vuoi capire?
                                </h2>
                                <p style={{ fontSize: '1.25rem', color: colors.muted, lineHeight: 1.6 }}>
                                    Descrivi il tuo obiettivo di ricerca e genereremo l'intervista perfetta per te
                                </p>
                            </div>

                            {/* Goal Input */}
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    position: 'absolute',
                                    inset: '-2px',
                                    background: gradients.primary,
                                    borderRadius: '24px',
                                    opacity: 0.1,
                                    filter: 'blur(8px)'
                                }} />
                                <textarea
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="Es: Voglio capire perché i miei clienti non completano l'acquisto..."
                                    style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: '180px',
                                        padding: '1.5rem',
                                        fontSize: '1.125rem',
                                        background: 'rgba(255,255,255,0.9)',
                                        backdropFilter: 'blur(20px)',
                                        border: '1px solid rgba(245, 158, 11, 0.2)',
                                        borderRadius: '20px',
                                        color: colors.text,
                                        resize: 'none',
                                        outline: 'none',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = colors.amber;
                                        e.target.style.boxShadow = `0 0 0 3px ${colors.amber}20, 0 10px 40px rgba(0,0,0,0.08)`;
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                                        e.target.style.boxShadow = '0 10px 40px rgba(0,0,0,0.05)';
                                    }}
                                />
                                <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            // Mock AI Refine
                                            alert("L'AI ti aiuterà a raffinare questo obiettivo in una versione più specifica (mock).");
                                        }}
                                        style={{
                                            background: 'rgba(245, 158, 11, 0.1)',
                                            color: colors.amberDark,
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '0.5rem 0.75rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        <Sparkles size={14} /> Refine with AI
                                    </button>
                                </div>
                            </div>

                            {/* Example Chips */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <p style={{ fontSize: '0.875rem', color: colors.subtle, textAlign: 'center', fontWeight: 500 }}>Prova con:</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
                                    {examplePrompts.map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setGoal(prompt)}
                                            style={{
                                                padding: '0.625rem 1rem',
                                                fontSize: '0.875rem',
                                                background: 'rgba(255,255,255,0.8)',
                                                backdropFilter: 'blur(10px)',
                                                border: '1px solid rgba(245, 158, 11, 0.15)',
                                                borderRadius: '100px',
                                                color: colors.text,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                fontWeight: 500
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                                                e.currentTarget.style.borderColor = colors.amber;
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                                                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.15)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem', alignItems: 'center' }}>
                                <button
                                    onClick={handleGenerate}
                                    disabled={!goal.trim()}
                                    style={{
                                        padding: '1rem 2.5rem',
                                        background: goal.trim() ? gradients.primary : colors.muted,
                                        color: 'white',
                                        fontWeight: 600,
                                        fontSize: '1.0625rem',
                                        borderRadius: '14px',
                                        border: 'none',
                                        cursor: goal.trim() ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.3s ease',
                                        boxShadow: goal.trim() ? '0 10px 25px rgba(245, 158, 11, 0.3)' : 'none',
                                        opacity: goal.trim() ? 1 : 0.5
                                    }}
                                    onMouseEnter={(e) => {
                                        if (goal.trim()) {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 15px 35px rgba(245, 158, 11, 0.4)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = goal.trim() ? '0 10px 25px rgba(245, 158, 11, 0.3)' : 'none';
                                    }}
                                >
                                    Genera la mia intervista
                                    <ArrowRight style={{ width: '20px', height: '20px' }} />
                                </button>
                                <button
                                    onClick={() => setShowTemplates(true)}
                                    style={{
                                        padding: '1rem 2.5rem',
                                        background: 'rgba(255,255,255,0.8)',
                                        backdropFilter: 'blur(10px)',
                                        color: colors.text,
                                        fontWeight: 600,
                                        fontSize: '1.0625rem',
                                        borderRadius: '14px',
                                        border: `1px solid ${colors.amber}40`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                                        e.currentTarget.style.borderColor = colors.amber;
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                                        e.currentTarget.style.borderColor = `${colors.amber}40`;
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <LayoutTemplate style={{ width: '20px', height: '20px' }} />
                                    Usa un template
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Template Selection */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: colors.text }}>
                                    Scegli un template
                                </h2>
                                <button
                                    onClick={() => setShowTemplates(false)}
                                    style={{
                                        color: colors.subtle,
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '1rem',
                                        fontWeight: 500,
                                        transition: 'color 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = colors.text}
                                    onMouseLeave={(e) => e.currentTarget.style.color = colors.subtle}
                                >
                                    ← Torna indietro
                                </button>
                            </div>

                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {TEMPLATES.map((template) => {
                                    const Icon = Icons[template.icon as keyof typeof Icons] || Icons.FileText;
                                    return (
                                        <button
                                            key={template.id}
                                            onClick={() => handleTemplateSelect(template)}
                                            style={{
                                                padding: '1.5rem',
                                                background: 'rgba(255,255,255,0.8)',
                                                backdropFilter: 'blur(20px)',
                                                border: '1px solid rgba(245, 158, 11, 0.15)',
                                                borderRadius: '20px',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 4px 15px rgba(0,0,0,0.04)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
                                                e.currentTarget.style.borderColor = colors.amber;
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.15)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.8)';
                                                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.15)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.04)';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                                                <div style={{
                                                    padding: '0.75rem',
                                                    background: 'rgba(245, 158, 11, 0.1)',
                                                    borderRadius: '12px',
                                                    color: colors.amber,
                                                    flexShrink: 0
                                                }}>
                                                    <Icon size={24} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: colors.text, marginBottom: '0.5rem' }}>
                                                        {template.name}
                                                    </h3>
                                                    <p style={{ color: colors.muted, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
                                                        {template.description}
                                                    </p>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '0.25rem 0.75rem',
                                                        fontSize: '0.75rem',
                                                        background: 'rgba(245, 158, 11, 0.1)',
                                                        borderRadius: '100px',
                                                        color: colors.amberDark,
                                                        fontWeight: 600,
                                                        textTransform: 'capitalize'
                                                    }}>
                                                        {template.category}
                                                    </span>
                                                </div>
                                                <ArrowRight style={{ width: '20px', height: '20px', color: colors.amber, flexShrink: 0 }} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
