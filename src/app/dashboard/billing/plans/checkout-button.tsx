'use client';

import { useState } from 'react';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { showToast } from '@/components/toast';

interface CheckoutButtonProps {
    tier: string;
    billingPeriod: 'monthly' | 'yearly';
    organizationId?: string;
    className?: string;
}

export default function CheckoutButton({
    tier,
    billingPeriod,
    organizationId,
    className
}: CheckoutButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleCheckout = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tier,
                    billingPeriod,
                    organizationId
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                showToast(data?.error || 'Impossibile avviare il checkout Stripe', 'error');
                return;
            }

            if (data?.url) {
                window.location.href = data.url;
                return;
            }

            showToast('Checkout non disponibile al momento', 'error');
        } catch (error) {
            console.error('Checkout button error:', error);
            showToast('Errore di rete durante il checkout', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleCheckout}
            disabled={isLoading}
            className={className}
        >
            {isLoading ? 'Caricamento...' : (
                <>
                    Seleziona piano <Icons.ArrowRight size={18} />
                </>
            )}
        </button>
    );
}
