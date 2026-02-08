'use client';

/**
 * CreditsWidget
 *
 * Widget compatto per la sidebar che mostra lo stato dei crediti
 * con barra di progresso colorata e CTA per acquisto/upgrade
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Zap, RefreshCcw } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

interface CreditsData {
    monthlyLimit: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    packAvailable: number;
    totalAvailable: number;
    percentageUsed: number;
    resetDate: string | null;
    alertLevel: 'warning' | 'danger' | 'critical' | 'exhausted' | null;
    isUnlimited: boolean;
    formatted: {
        monthlyLimit: string;
        monthlyUsed: string;
        monthlyRemaining: string;
        packAvailable: string;
        totalAvailable: string;
    };
}

export function CreditsWidget() {
    const { currentOrganization } = useOrganization();
    const [credits, setCredits] = useState<CreditsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCredits = useCallback(async () => {
        if (!currentOrganization) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/credits?organizationId=${currentOrganization.id}`);
            if (!res.ok) throw new Error('Errore nel caricamento');
            const data = await res.json();
            setCredits(data);
        } catch (err) {
            setError('Errore');
            console.error('Error fetching credits:', err);
        } finally {
            setLoading(false);
        }
    }, [currentOrganization]);

    useEffect(() => {
        fetchCredits();
    }, [fetchCredits]);

    if (loading) {
        return (
            <div className="p-4 bg-stone-50 rounded-lg animate-pulse">
                <div className="h-4 bg-stone-200 rounded w-1/2 mb-2"></div>
                <div className="h-2 bg-stone-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-stone-200 rounded w-3/4"></div>
            </div>
        );
    }

    if (error || !credits) {
        return (
            <div className="p-4 bg-stone-50 rounded-lg">
                <p className="text-sm text-stone-500">Crediti non disponibili</p>
            </div>
        );
    }

    // Unlimited credits (ADMIN)
    if (credits.isUnlimited) {
        return (
            <div className="p-4 bg-gradient-to-br from-amber-50 to-stone-50 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-stone-900">Crediti AI</span>
                </div>
                <p className="text-lg font-bold text-amber-600">Illimitati</p>
            </div>
        );
    }

    const percentage = credits.percentageUsed;

    // Color based on usage
    const getBarColor = () => {
        if (percentage >= 95) return 'bg-red-500';
        if (percentage >= 85) return 'bg-orange-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const formatResetDate = (dateStr: string | null) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-stone-700">Crediti AI</span>
                </div>
                <span className="text-[10px] font-medium text-stone-500 bg-white px-1.5 py-0.5 rounded border border-stone-100">
                    {credits.formatted.monthlyRemaining}
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden mb-2">
                <div
                    className={`h-full ${getBarColor()} transition-all duration-300`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>

            {/* Pack credits indicator */}
            {credits.packAvailable > 0 && (
                <div className="text-[10px] text-amber-600 mb-1 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-amber-500" />
                    + {credits.formatted.packAvailable} pack extra
                </div>
            )}

            {/* CTA for low credits */}
            {percentage >= 85 ? (
                <div className="flex gap-1.5 mt-2">
                    <Link
                        href="/dashboard/billing?tab=packs"
                        className="flex-1 text-center text-[10px] font-bold py-1.5 px-2 rounded-md bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all shine-effect"
                    >
                        Ricarica
                    </Link>
                    <Link
                        href="/dashboard/billing/plans"
                        className="flex-1 text-center text-[10px] font-bold py-1.5 px-2 rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm"
                    >
                        Upgrade
                    </Link>
                </div>
            ) : (
                <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                    <span>Resettano il {formatResetDate(credits.resetDate)}</span>
                </div>
            )}
        </div>
    );
}

export default CreditsWidget;
