'use client';

/**
 * CreditsExhaustedModal
 *
 * Modal bloccante che appare quando i crediti sono completamente esauriti.
 * Offre opzioni per acquistare pack, upgrade, o continuare senza AI.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { XCircle, Zap, ArrowRight, RefreshCcw } from 'lucide-react';

interface CreditsData {
    percentageUsed: number;
    alertLevel: 'warning' | 'danger' | 'critical' | 'exhausted' | null;
    isUnlimited: boolean;
    resetDate: string | null;
}

interface CreditsExhaustedModalProps {
    onContinueWithoutAI?: () => void;
}

export function CreditsExhaustedModal({ onContinueWithoutAI }: CreditsExhaustedModalProps) {
    const [credits, setCredits] = useState<CreditsData | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCredits();
    }, []);

    const fetchCredits = async () => {
        try {
            const res = await fetch('/api/credits');
            if (!res.ok) throw new Error('Error fetching credits');
            const data = await res.json();
            setCredits(data);
            setIsOpen(data.alertLevel === 'exhausted' && !data.isUnlimited);
        } catch (err) {
            console.error('Error fetching credits for modal:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleContinueWithoutAI = () => {
        setIsOpen(false);
        onContinueWithoutAI?.();
    };

    const formatResetDate = (dateStr: string | null) => {
        if (!dateStr) return 'il prossimo mese';
        const date = new Date(dateStr);
        return `il ${date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;
    };

    if (loading || !isOpen || !credits) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-200">
                {/* Icon */}
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <XCircle className="w-8 h-8 text-red-500" />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-stone-900 text-center mb-2">
                    Crediti esauriti
                </h2>

                {/* Description */}
                <p className="text-stone-600 text-center mb-6">
                    Hai esaurito i crediti mensili del tuo piano. Per continuare a usare
                    le funzionalità AI, acquista un pack o passa a un piano superiore.
                </p>

                {/* Reset info */}
                <div className="flex items-center justify-center gap-2 text-sm text-stone-500 mb-8 bg-stone-50 rounded-lg p-3">
                    <RefreshCcw className="w-4 h-4" />
                    <span>I crediti si rinnoveranno automaticamente {formatResetDate(credits.resetDate)}</span>
                </div>

                {/* Blocked features */}
                <div className="mb-6">
                    <p className="text-sm font-medium text-stone-700 mb-3">Funzionalità sospese:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-stone-500">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>Nuove interviste</span>
                        </div>
                        <div className="flex items-center gap-2 text-stone-500">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>Sessioni chatbot</span>
                        </div>
                        <div className="flex items-center gap-2 text-stone-500">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>Visibility Tracker</span>
                        </div>
                        <div className="flex items-center gap-2 text-stone-500">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>AI Tips & Copilot</span>
                        </div>
                    </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-3">
                    <Link
                        href="/dashboard/billing?tab=packs"
                        className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white font-bold py-4 px-6 rounded-xl hover:bg-amber-600 transition-all"
                    >
                        <Zap className="w-5 h-5" />
                        Acquista pack crediti
                    </Link>
                    <Link
                        href="/dashboard/billing/plans"
                        className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white font-bold py-4 px-6 rounded-xl hover:bg-stone-800 transition-all"
                    >
                        Upgrade piano
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <button
                        onClick={handleContinueWithoutAI}
                        className="w-full text-sm text-stone-500 hover:text-stone-700 transition-colors py-2"
                    >
                        Continua senza funzionalità AI
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreditsExhaustedModal;
