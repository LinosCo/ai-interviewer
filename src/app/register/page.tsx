'use client';

import { useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { registerUser } from './actions';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { Input } from '@/components/ui/business-tuner/Input';
import { Card } from '@/components/ui/business-tuner/Card';

function RegisterForm() {
    const searchParams = useSearchParams();
    const plan = searchParams.get('plan');
    const [errorMessage, dispatch, isPending] = useActionState(registerUser, undefined);

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
            <div style={{ position: 'absolute', top: '5%', left: '5%', width: '350px', height: '350px', background: `radial-gradient(circle, ${colors.amberLight} 0%, transparent 60%)`, opacity: 0.5, filter: 'blur(50px)' }} />
            <div style={{ position: 'absolute', bottom: '5%', right: '5%', width: '450px', height: '450px', background: `radial-gradient(circle, ${colors.rose} 0%, transparent 60%)`, opacity: 0.4, filter: 'blur(60px)' }} />

            <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '1.5rem' }}>
                        <Icons.Logo size={40} />
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: colors.text, marginBottom: '0.5rem' }}>Crea il tuo account</h1>
                    <p style={{ color: colors.muted }}>Inizia la tua prova gratuita di 14 giorni</p>

                    {plan && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', background: 'rgba(251, 191, 36, 0.1)', color: colors.amberDark, padding: '0.375rem 0.75rem', borderRadius: '100px', fontSize: '0.8125rem', fontWeight: 600 }}>
                            <Icons.Check size={14} /> Piano selezionato: {plan}
                        </div>
                    )}
                </div>

                <Card variant="glass" padding="2.5rem">
                    <form action={dispatch}>
                        <input type="hidden" name="plan" value={plan || ''} />

                        <div style={{ marginBottom: '1rem' }}>
                            <Input
                                label="Nome completo"
                                type="text"
                                name="name"
                                required
                                placeholder="Mario Rossi"
                                disabled={isPending}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <Input
                                label="Email aziendale"
                                type="email"
                                name="email"
                                required
                                placeholder="nome@azienda.com"
                                disabled={isPending}
                                icon={<Icons.Building size={18} />}
                            />
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <Input
                                label="Password"
                                type="password"
                                name="password"
                                required
                                placeholder="Creane una sicura"
                                minLength={6}
                                disabled={isPending}
                                icon={<div style={{ width: '18px' }}>🔒</div>}
                            />
                        </div>

                        {errorMessage && (
                            <div style={{ padding: '0.75rem', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                {errorMessage}
                            </div>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            disabled={isPending}
                            withShimmer={!isPending}
                        >
                            {isPending ? 'Creazione account...' : 'Inizia prova gratuita'}
                        </Button>

                        <p style={{ fontSize: '0.75rem', color: colors.subtle, textAlign: 'center', marginTop: '1rem', lineHeight: 1.5 }}>
                            Cliccando su "Inizia prova gratuita", accetti i nostri <Link href="#" style={{ color: colors.text, textDecoration: 'underline' }}>Termini di Servizio</Link> e la <Link href="#" style={{ color: colors.text, textDecoration: 'underline' }}>Privacy Policy</Link>.
                        </p>
                    </form>
                </Card>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', color: colors.muted }}>
                        Hai già un account?{' '}
                        <Link href="/login" style={{ color: colors.amber, fontWeight: 600, textDecoration: 'none' }}>
                            Accedi
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradients.mesh }}>Caricamento...</div>}>
            <RegisterForm />
        </Suspense>
    );
}
