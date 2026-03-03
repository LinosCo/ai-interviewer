'use client';

import { Suspense, useActionState, useEffect, useRef, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authenticate } from './actions';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { Input } from '@/components/ui/business-tuner/Input';
import { Card } from '@/components/ui/business-tuner/Card';
import { loginSchema, type LoginInput } from '@/lib/validation/schemas';

const errorStyle: React.CSSProperties = {
    color: '#EF4444',
    fontSize: '0.75rem',
    marginTop: '4px',
    display: 'block',
};

function LoginForm() {
    const searchParams = useSearchParams();
    const [serverError, dispatch, isPending] = useActionState(authenticate, undefined);
    const [, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);

    const nextPathRaw = searchParams.get('next');
    const nextPath = nextPathRaw && nextPathRaw.startsWith('/') ? nextPathRaw : null;
    const verificationState = searchParams.get('verification');
    const verifiedState = searchParams.get('verified');
    const verificationReason = searchParams.get('reason');

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitSuccessful },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
    });

    const isLoading = isPending || (isSubmitSuccessful && serverError === null);

    useEffect(() => {
        if (!isPending && serverError === null && isSubmitSuccessful) {
            const target = nextPath || '/dashboard';
            window.location.replace(target);
        }
    }, [serverError, isPending, isSubmitSuccessful, nextPath]);

    const onSubmit = () => {
        if (formRef.current) {
            const formData = new FormData(formRef.current);
            startTransition(() => { dispatch(formData); });
        }
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
                    <form ref={formRef} onSubmit={handleSubmit(onSubmit)}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <Input
                                label="Email"
                                type="email"
                                {...register('email')}
                                placeholder="nome@azienda.com"
                                disabled={isLoading}
                                icon={<Icons.Users size={18} />}
                            />
                            {errors.email && <span style={errorStyle}>{errors.email.message}</span>}
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <Input
                                label="Password"
                                type="password"
                                {...register('password')}
                                placeholder="••••••••"
                                disabled={isLoading}
                                icon={<div style={{ width: '18px' }}>🔒</div>}
                            />
                            {errors.password && <span style={errorStyle}>{errors.password.message}</span>}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem', marginTop: '0.75rem' }}>
                            <Link href="/forgot-password" style={{ fontSize: '0.875rem', color: colors.amber, textDecoration: 'none', fontWeight: 500 }}>
                                Password dimenticata?
                            </Link>
                        </div>

                        {serverError && (
                            <div style={{ padding: '0.75rem', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                {serverError}
                            </div>
                        )}

                        {!serverError && verificationState === 'sent' && (
                            <div style={{ padding: '0.75rem', background: '#DBEAFE', border: '1px solid #93C5FD', borderRadius: '8px', color: '#1D4ED8', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                Ti abbiamo inviato una email di conferma. Apri il link per attivare l&apos;account.
                            </div>
                        )}

                        {!serverError && verifiedState === '1' && (
                            <div style={{ padding: '0.75rem', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '8px', color: '#166534', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                Email confermata con successo. Ora puoi accedere.
                            </div>
                        )}

                        {!serverError && verifiedState === '0' && (
                            <div style={{ padding: '0.75rem', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', color: '#92400E', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                {verificationReason === 'expired_token'
                                    ? 'Il link di conferma è scaduto. Richiedi un nuovo link dal supporto.'
                                    : 'Il link di conferma non è valido.'}
                            </div>
                        )}

                        <Button type="submit" fullWidth disabled={isLoading} withShimmer={!isLoading}>
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

export default function LoginPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradients.mesh }}>Caricamento...</div>}>
            <LoginForm />
        </Suspense>
    );
}
