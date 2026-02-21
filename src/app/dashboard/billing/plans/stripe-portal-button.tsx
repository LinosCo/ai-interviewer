'use client';

import { useState } from 'react';
import { Icons } from '@/components/ui/business-tuner/Icons';

type StripePortalButtonProps = {
    organizationId: string;
};

export default function StripePortalButton({ organizationId }: StripePortalButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleOpenPortal = async () => {
        if (!organizationId || loading) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/stripe/portal?organizationId=${organizationId}`);
            const data = await res.json();
            if (data?.url) {
                window.location.href = data.url;
                return;
            }
            throw new Error(data?.error || 'Impossibile aprire Stripe');
        } catch (error) {
            console.error('Stripe portal open error:', error);
            alert('Impossibile aprire Stripe in questo momento.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleOpenPortal}
            disabled={loading || !organizationId}
            className="bg-white text-stone-900 font-bold px-8 py-3.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-all text-sm shadow-sm flex items-center gap-2 disabled:opacity-60"
        >
            <Icons.Settings2 size={16} /> {loading ? 'Apertura...' : 'Gestisci in Stripe'}
        </button>
    );
}
