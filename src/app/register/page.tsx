'use client';

import { useActionState, Suspense, useRef, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerUser } from './actions';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { Input } from '@/components/ui/business-tuner/Input';
import { Card } from '@/components/ui/business-tuner/Card';
import { registerClientSchema, type RegisterClientInput } from '@/lib/validation/schemas';
import { PasswordStrength } from '@/components/ui/PasswordStrength';

const errorStyle: React.CSSProperties = {
    color: '#EF4444',
    fontSize: '0.75rem',
    marginTop: '4px',
    display: 'block',
};

function RegisterForm() {
    const searchParams = useSearchParams();
    const plan = searchParams.get('plan');
    const billing = searchParams.get('billing') || 'monthly';

    const [serverError, dispatch, isPending] = useActionState(registerUser, undefined);
    const [, startTransition] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitSuccessful },
    } = useForm<RegisterClientInput>({
        resolver: zodResolver(registerClientSchema),
    });

    const passwordValue = watch('password', '');
    const isLoading = isPending || (isSubmitSuccessful && serverError === null);

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
                    <form ref={formRef} onSubmit={handleSubmit(onSubmit)}>
                        <input type="hidden" name="plan" value={plan || ''} />
                        <input type="hidden" name="billing" value={billing} />

                        <div style={{ marginBottom: '1rem' }}>
                            <Input
                                label="Nome completo"
                                type="text"
                                {...register('name')}
                                placeholder="Mario Rossi"
                                disabled={isLoading}
                            />
                            {errors.name && <span style={errorStyle}>{errors.name.message}</span>}
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <Input
                                label="Email aziendale"
                                type="email"
                                {...register('email')}
                                placeholder="nome@azienda.com"
                                disabled={isLoading}
                                icon={<Icons.Building size={18} />}
                            />
                            {errors.email && <span style={errorStyle}>{errors.email.message}</span>}
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <Input
                                label="Ragione Sociale / Nome Azienda"
                                type="text"
                                {...register('companyName')}
                                placeholder="Azienda S.r.l."
                                disabled={isLoading}
                                icon={<Icons.Building size={18} />}
                            />
                            {errors.companyName && <span style={errorStyle}>{errors.companyName.message}</span>}
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <Input
                                label="Partita IVA (Opzionale)"
                                type="text"
                                name="vatId"
                                placeholder="IT01234567890"
                                disabled={isLoading}
                                icon={<div style={{ fontSize: '14px', fontWeight: 'bold', color: colors.muted }}>%</div>}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <Input
                                label="Password"
                                type="password"
                                {...register('password')}
                                placeholder="Almeno 8 caratteri, 1 maiuscola, 1 numero"
                                disabled={isLoading}
                                icon={<Icons.Check size={18} />}
                            />
                            {errors.password && <span style={errorStyle}>{errors.password.message}</span>}
                            <PasswordStrength password={passwordValue} />
                        </div>

                        {serverError && (
                            <div style={{ padding: '0.75rem', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                                {serverError}
                            </div>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            disabled={isLoading}
                            withShimmer={!isLoading}
                        >
                            {isLoading ? 'Creazione account...' : 'Inizia prova gratuita'}
                        </Button>

                        <p style={{ fontSize: '0.75rem', color: colors.subtle, textAlign: 'center', marginTop: '1rem', lineHeight: 1.5 }}>
                            Cliccando su &quot;Inizia prova gratuita&quot;, accetti i nostri <Link href="/terms" style={{ color: colors.text, textDecoration: 'underline' }}>Termini di Servizio</Link> e la <Link href="/privacy" style={{ color: colors.text, textDecoration: 'underline' }}>Privacy Policy</Link>.
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
