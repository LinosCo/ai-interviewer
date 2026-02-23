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

    const handlePurchase = async () => {
        if (loading) return;
        setLoading(true);

        try {
            const res = await fetch('/api/credits/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    packType,
                    organizationId
                })
            });

            const data = await res.json();
            if (!res.ok || !data?.checkoutUrl) {
                throw new Error(data?.error || 'Impossibile avviare checkout');
            }

            // Redirect to Stripe — keep loading=true so the button stays
            // disabled and shows "Reindirizzamento..." until the page unloads.
            // We only reset on error.
            window.location.href = data.checkoutUrl;
            return;
        } catch (error) {
            console.error('Pack purchase error:', error);
            alert("Errore durante l'avvio del checkout pack.");
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handlePurchase}
            disabled={loading}
            className={className}
        >
            {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Apertura...
                </span>
            ) : children}
        </button>
    );
}
