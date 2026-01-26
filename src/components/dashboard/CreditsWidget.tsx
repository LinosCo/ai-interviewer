'use client';

/**
 * CreditsWidget
 *
 * Widget compatto per la sidebar che mostra lo stato dei crediti
 * con barra di progresso colorata e CTA per acquisto/upgrade
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, RefreshCcw } from 'lucide-react';

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
    const [credits, setCredits] = useState<CreditsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchCredits();
    }, []);

    const fetchCredits = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/credits');
            if (!res.ok) throw new Error('Errore nel caricamento');
            const data = await res.json();
            setCredits(data);
        } catch (err) {
            setError('Errore');
            console.error('Error fetching credits:', err);
        } finally {
            setLoading(false);
        }
    };

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
        <div className="p-4 bg-stone-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-stone-900">Crediti AI</span>
                </div>
                <span className="text-xs text-stone-500">
                    {credits.formatted.totalAvailable}
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-stone-200 rounded-full overflow-hidden mb-2">
                <div
                    className={`h-full ${getBarColor()} transition-all duration-300`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>

            {/* Stats */}
            <div className="flex justify-between text-xs text-stone-500 mb-2">
                <span>{credits.formatted.monthlyUsed} usati</span>
                <span className="flex items-center gap-1">
                    <RefreshCcw className="w-3 h-3" />
                    {formatResetDate(credits.resetDate)}
                </span>
            </div>

            {/* Pack credits indicator */}
            {credits.packAvailable > 0 && (
                <div className="text-xs text-amber-600 mb-2">
                    + {credits.formatted.packAvailable} pack
                </div>
            )}

            {/* CTA for low credits */}
            {percentage >= 85 && (
                <div className="flex gap-2 mt-3">
                    <Link
                        href="/dashboard/billing?tab=packs"
                        className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-all"
                    >
                        Acquista pack
                    </Link>
                    <Link
                        href="/dashboard/billing/plans"
                        className="flex-1 text-center text-xs font-medium py-2 px-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-all"
                    >
                        Upgrade
                    </Link>
                </div>
            )}
        </div>
    );
}

export default CreditsWidget;
