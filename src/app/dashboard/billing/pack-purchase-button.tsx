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

            window.location.href = data.checkoutUrl;
        } catch (error) {
            console.error('Pack purchase error:', error);
            alert("Errore durante l'avvio del checkout pack.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handlePurchase}
            disabled={loading}
            className={className}
        >
            {loading ? 'Reindirizzamento...' : children}
        </button>
    );
}
