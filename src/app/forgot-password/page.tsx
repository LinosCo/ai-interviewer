'use client';

import { useState } from 'react';
import Link from 'next/link';
import { colors, gradients } from '@/lib/design-system';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { Button } from '@/components/ui/business-tuner/Button';
import { Input } from '@/components/ui/business-tuner/Input';
import { Card } from '@/components/ui/business-tuner/Card';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({
                    type: 'success',
                    text: 'Se l\'email esiste nel nostro sistema, riceverai le istruzioni per reimpostare la password.',
                });
                setEmail('');
            } else {
                setMessage({
                    type: 'error',
                    text: data.error || 'Si è verificato un errore. Riprova più tardi.',
                });
            }
        } catch (error) {
            setMessage({
                type: 'error',
                text: 'Si è verificato un errore. Riprova più tardi.',
            });
        } finally {
            setIsLoading(false);
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
            {/* Decorative Elements */}
            <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: `radial-gradient(circle, ${colors.amberLight} 0%, transparent 70%)`, opacity: 0.4, filter: 'blur(40px)' }} />
            <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: '400px', height: '400px', background: `radial-gradient(circle, ${colors.peach} 0%, transparent 70%)`, opacity: 0.5, filter: 'blur(60px)' }} />

            <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '1.5rem' }}>
                        <Icons.Logo size={40} />
                    </Link>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: colors.text, marginBottom: '0.5rem' }}>Password dimenticata?</h1>
                    <p style={{ color: colors.muted }}>Inserisci la tua email per ricevere le istruzioni</p>
                </div>

                <Card variant="glass" padding="2.5rem">
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <Input
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="nome@azienda.com"
                                disabled={isLoading}
                                icon={<Icons.Users size={18} />}
                            />
                        </div>

                        {message && (
                            <div style={{
                                padding: '0.75rem',
                                background: message.type === 'success' ? '#D1FAE5' : '#FEE2E2',
                                border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                                borderRadius: '8px',
                                color: message.type === 'success' ? '#065F46' : '#DC2626',
                                fontSize: '0.875rem',
                                marginBottom: '1.5rem',
                                textAlign: 'center'
                            }}>
                                {message.text}
                            </div>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            disabled={isLoading}
                            withShimmer={!isLoading}
                        >
                            {isLoading ? 'Invio in corso...' : 'Invia istruzioni'}
                        </Button>
                    </form>
                </Card>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', color: colors.muted }}>
                        Ricordi la password?{' '}
                        <Link href="/login" style={{ color: colors.amber, fontWeight: 600, textDecoration: 'none' }}>
                            Accedi
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
