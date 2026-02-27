'use client';

import { useState } from 'react';

type PackPurchaseButtonProps = {
    packType: string;
    organizationId: string;
    className?: string;
    children: React.ReactNode;
};

export default function PackPurchaseButton({
    packType,
    organizationId,
    className,
    children
}: PackPurchaseButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePurchase = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/credits/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packType, organizationId })
            });

            const data = await res.json();
            if (!res.ok || !data?.checkoutUrl) {
                throw new Error(data?.error || 'Impossibile avviare checkout');
            }

            // External Stripe URL: keep loading=true during redirect (page is navigating away)
            window.location.href = data.checkoutUrl;
        } catch (err) {
            console.error('Pack purchase error:', err);
            setError(err instanceof Error ? err.message : "Errore durante l'avvio del checkout.");
            setLoading(false); // Only reset on error, not on success
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <button
                onClick={handlePurchase}
                disabled={loading}
                className={className}
            >
                {loading ? 'Apertura checkout...' : children}
            </button>
            {error && (
                <p className="text-xs text-red-500 text-center mt-1">{error}</p>
            )}
        </div>
    );
}
