import Link from 'next/link';
import { colors } from '@/lib/design-system';

export function Footer() {
    return (
        <footer style={{
            background: '#FAFAFA',
            borderTop: '1px solid #E5E5E5',
            padding: '4rem 2rem 2rem',
            marginTop: 'auto'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '3rem',
                    marginBottom: '4rem'
                }}>
                    {/* Brand Column */}
                    <div>
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '1.5rem' }}>
                            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                                <defs>
                                    <linearGradient id="logoGradientFooter" x1="0%" y1="100%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#D97706" />
                                        <stop offset="50%" stopColor="#F59E0B" />
                                        <stop offset="100%" stopColor="#FBBF24" />
                                    </linearGradient>
                                </defs>
                                <rect width="48" height="48" rx="14" fill="url(#logoGradientFooter)" />
                                <g fill="white" opacity="0.9">
                                    <rect x="8" y="28" width="5" height="12" rx="2" opacity="0.4" />
                                    <rect x="15" y="24" width="5" height="16" rx="2" opacity="0.55" />
                                    <rect x="22" y="18" width="5" height="22" rx="2" opacity="0.7" />
                                    <rect x="29" y="14" width="5" height="26" rx="2" opacity="0.85" />
                                    <rect x="36" y="20" width="5" height="20" rx="2" opacity="0.7" />
                                </g>
                            </svg>
                            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: colors.text }}>Business Tuner</span>
                        </Link>
                        <p style={{ color: colors.muted, lineHeight: 1.6, maxWidth: '300px' }}>
                            La piattaforma di AI Interviewing per le PMI italiane.
                            Ascolta il mercato, prendi decisioni migliori.
                        </p>
                    </div>

                    {/* Links Columns */}
                    <div>
                        <h4 style={{ fontWeight: 600, marginBottom: '1.5rem', color: colors.text }}>Prodotto</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <li><Link href="/#features" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Features</Link></li>
                            <li><Link href="/#use-cases" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Casi d'uso</Link></li>
                            <li><Link href="/#pricing" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Prezzi</Link></li>
                            <li><Link href="/onboarding/preview" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Simulatore</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 style={{ fontWeight: 600, marginBottom: '1.5rem', color: colors.text }}>Risorse</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <li><Link href="/faq" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>FAQ</Link></li>
                            <li><Link href="/blog" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Blog</Link></li>
                            <li><Link href="/guides" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Guide</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 style={{ fontWeight: 600, marginBottom: '1.5rem', color: colors.text }}>Legale</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <li><Link href="/privacy" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Privacy Policy</Link></li>
                            <li><Link href="/terms" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Termini di Servizio</Link></li>
                            <li><Link href="/cookies" style={{ color: colors.muted, textDecoration: 'none', transition: 'color 0.2s' }}>Cookie Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div style={{
                    borderTop: '1px solid #E5E5E5',
                    paddingTop: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                    textAlign: 'center',
                    color: colors.subtle,
                    fontSize: '0.875rem'
                }}>
                    <p>© {new Date().getFullYear()} Business Tuner. Tutti i diritti riservati.</p>
                </div>
            </div>
        </footer>
    );
}
