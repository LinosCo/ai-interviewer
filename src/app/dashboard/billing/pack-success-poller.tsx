'use client';

/**
 * PackSuccessPoller
 *
 * Shown after a successful pack purchase (?pack_success=true).
 * Polls /api/credits every 2s until packAvailable > 0 (webhook processed),
 * then triggers a router.refresh() to update the Server Component.
 * Max 10 attempts (~20 seconds), then shows a "reload manually" fallback.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';
import { CheckCircle, Loader2, RefreshCcw } from 'lucide-react';

interface PackSuccessPollerProps {
    /** packAvailable at SSR time — if already > 0 webhook was fast, skip polling */
    initialPackAvailable: number;
    organizationId: string;
}

export default function PackSuccessPoller({
    initialPackAvailable,
    organizationId,
}: PackSuccessPollerProps) {
    const router = useRouter();
    const [status, setStatus] = useState<'waiting' | 'done' | 'timeout'>(
        initialPackAvailable > 0 ? 'done' : 'waiting'
    );

    useEffect(() => {
        if (initialPackAvailable > 0) return; // already credited at SSR time

        let attempts = 0;
        const MAX_ATTEMPTS = 10;

        const poll = async () => {
            attempts++;
            try {
                const res = await fetch(`/api/credits?organizationId=${organizationId}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.packAvailable > 0) {
                    setStatus('done');
                    router.refresh();
                    return;
                }
            } catch {
                // ignore transient errors
            }

            if (attempts >= MAX_ATTEMPTS) {
                setStatus('timeout');
                return;
            }
            setTimeout(poll, 2000);
        };

        const timerId = setTimeout(poll, 2000);
        return () => clearTimeout(timerId);
    }, [initialPackAvailable, organizationId, router]);

    if (status === 'done') {
        return (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Acquisto completato! I crediti pack sono stati aggiunti al tuo saldo.</span>
            </div>
        );
    }

    if (status === 'timeout') {
        return (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
                <span>Il pagamento è stato registrato. I crediti potrebbero impiegare qualche secondo ad apparire.</span>
                <button
                    onClick={() => router.refresh()}
                    className="flex items-center gap-1.5 shrink-0 text-xs font-bold bg-amber-100 hover:bg-amber-200 transition-colors px-2 py-1 rounded-lg"
                >
                    <RefreshCcw className="w-3 h-3" /> Ricarica
                </button>
            </div>
        );
    }

    // waiting
    return (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            <span>Pagamento confermato, sto aggiornando i tuoi crediti...</span>
        </div>
    );
}
