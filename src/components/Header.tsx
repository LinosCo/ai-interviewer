import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';

export function Header() {
    return (
        <header style={{
            padding: '1rem 2rem',
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Logo */}
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
                    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
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
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: colors.text }}>Business Tuner</span>
                </Link>

                {/* Navigation */}
                <nav style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <Link href="/#how-it-works" style={{ color: colors.muted, textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500, transition: 'color 0.2s' }}>
                        Come funziona
                    </Link>
                    <Link href="/#use-cases" style={{ color: colors.muted, textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500, transition: 'color 0.2s' }}>
                        Casi d'uso
                    </Link>
                    <Link href="/#pricing" style={{ color: colors.muted, textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500, transition: 'color 0.2s' }}>
                        Prezzi
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                        <Link href="/login" style={{ color: colors.text, textDecoration: 'none', fontSize: '0.9375rem', fontWeight: 500 }}>
                            Accedi
                        </Link>
                        <Link href="/onboarding/preview" style={{ textDecoration: 'none' }}>
                            <button style={{
                                padding: '0.625rem 1.25rem',
                                background: gradients.primary,
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '0.9375rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
                            }}>
                                Guarda Demo
                            </button>
                        </Link>
                    </div>
                </nav>
            </div>
        </header>
    );
}
