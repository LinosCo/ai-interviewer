'use client';

import { useState } from 'react';
import { Icons } from '@/components/ui/business-tuner/Icons';

export default function BillingClient() {
    const [isLoading, setIsLoading] = useState(false);

    const handleManageBilling = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/stripe/portal');
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('Error opening portal:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handleManageBilling}
                disabled={isLoading}
                className="flex-1 bg-stone-900 text-white font-bold py-4 px-6 rounded-xl hover:bg-stone-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {isLoading ? (
                    'Caricamento...'
                ) : (
                    <>
                        <Icons.Settings2 size={18} /> Gestisci abbonamento
                    </>
                )}
            </button>
            <button
                onClick={() => window.location.href = '/dashboard/billing/plans'}
                className="flex-1 bg-white text-stone-900 font-bold py-4 px-6 rounded-xl border border-stone-200 hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
            >
                Cambia piano
            </button>
        </>
    );
}
