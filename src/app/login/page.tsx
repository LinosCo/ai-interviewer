'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authenticate } from './actions';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { Input } from '@/components/ui/business-tuner/Input';
import { Card } from '@/components/ui/business-tuner/Card';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const nextPathRaw = searchParams.get('next');
    const nextPath = nextPathRaw && nextPathRaw.startsWith('/') ? nextPathRaw : null;
    const verificationState = searchParams.get('verification');
    const verifiedState = searchParams.get('verified');
    const verificationReason = searchParams.get('reason');

    // Combined loading state: pending action OR navigating to dashboard
    const isLoading = isPending || (hasSubmitted && errorMessage === null);

    useEffect(() => {
        if (!isPending && errorMessage === null && hasSubmitted) {
            // Login successful, start navigation and refresh session
            router.refresh();
            router.replace(nextPath || '/dashboard');
        }
    }, [errorMessage, isPending, router, hasSubmitted, nextPath]);

    const handleSubmit = () => {
        setHasSubmitted(true);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: gradients.mesh,
            fontFamily: "'Inter', sans-serif",
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Decorative Elements */}
            <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: `radial-gradient(circle, ${colors.amberLight} 0%, transparent 70%)`, opacity: 0.4, filter: 'blur(40px)' }} />
            <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '400px', height: '400px', background: `radial-gradient(circle, ${colors.peach} 0%, transparent 70%)`, opacity: 0.5, filter: 'blur(60px)' }} />

            <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '1.5rem' }}>
                        <Icons.Logo size={40} />
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: colors.text, marginBottom: '0.5rem' }}>Bentornato</h1>
                    <p style={{ color: colors.muted }}>Accedi per gestire le tue interviste</p>
                </div>

                <Card variant="glass" padding="2.5rem">
                    <form action={dispatch} onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <Input
                                label="Email"
                                type="email"
                                name="email"
                                required
                                placeholder="nome@azienda.com"
                                disabled={isLoading}
                                icon={<Icons.Users size={18} />}
                            />
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <Input
                                label="Password"
                                type="password"
                                name="password"
                                required
                                placeholder="••••••••"
                                disabled={isLoading}
                                icon={<div style={{ width: '18px' }}>🔒</div>} // Placeholder icon if Lock not available
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                            <Link href="/forgot-password" style={{ fontSize: '0.875rem', color: colors.amber, textDecoration: 'none', fontWeight: 500 }}>
                                Password dimenticata?
                            </Link>
                        </div>

                        {errorMessage && (
                            <div style={{ padding: '0.75rem', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                {errorMessage}
                            </div>
                        )}

                        {!errorMessage && verificationState === 'sent' && (
                            <div style={{ padding: '0.75rem', background: '#DBEAFE', border: '1px solid #93C5FD', borderRadius: '8px', color: '#1D4ED8', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                Ti abbiamo inviato una email di conferma. Apri il link per attivare l&apos;account.
                            </div>
                        )}

                        {!errorMessage && verifiedState === '1' && (
                            <div style={{ padding: '0.75rem', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '8px', color: '#166534', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                Email confermata con successo. Ora puoi accedere.
                            </div>
                        )}

                        {!errorMessage && verifiedState === '0' && (
                            <div style={{ padding: '0.75rem', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', color: '#92400E', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                {verificationReason === 'expired_token'
                                    ? 'Il link di conferma è scaduto. Richiedi un nuovo link dal supporto.'
                                    : 'Il link di conferma non è valido.'}
                            </div>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            disabled={isLoading}
                            withShimmer={!isLoading}
                        >
                            {isLoading ? 'Accesso in corso...' : 'Accedi'}
                        </Button>
                    </form>
                </Card>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', color: colors.muted }}>
                        Non hai un account?{' '}
                        <Link href="/register" style={{ color: colors.amber, fontWeight: 600, textDecoration: 'none' }}>
                            Inizia la prova gratuita
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
