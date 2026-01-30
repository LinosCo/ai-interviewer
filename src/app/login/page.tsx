'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authenticate } from './actions';
import Link from 'next/link';
import { colors, gradients, shadows } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { Input } from '@/components/ui/business-tuner/Input';
import { Card } from '@/components/ui/business-tuner/Card';

export default function LoginPage() {
    const router = useRouter();
    const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined);
    const [isNavigating, setIsNavigating] = useState(false);

    // Combined loading state: pending action OR navigating to dashboard
    const isLoading = isPending || isNavigating;

    useEffect(() => {
        if (!isPending && errorMessage === null && !isNavigating) {
            // Login successful, start navigation
            setIsNavigating(true);
            router.push('/dashboard');
            // Note: isNavigating stays true - page will unmount during navigation
        }
    }, [errorMessage, isPending, router, isNavigating]);

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
                    <form action={dispatch}>
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
