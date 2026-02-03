'use client';

import { ArrowUpRight, Zap } from 'lucide-react';
import { useState } from 'react';

interface TokenUsageCardProps {
    usage: {
        used: number;
        limit: number;
        purchased: number;
        monthlyBudget: number;
        percentage: number;
    };
    onTopUp?: () => void;
}

export function TokenUsageCard({ usage, onTopUp }: TokenUsageCardProps) {
    const isUnlimited = usage.limit === -1;
    const isWarning = usage.percentage >= 80 && !isUnlimited;
    const isCritical = usage.percentage >= 95 && !isUnlimited;

    // Formatting helpers
    const formatNumber = (num: number) => new Intl.NumberFormat('it-IT').format(num);

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        Utilizzo Chatbot (Token)
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Consumo mensile dei token da parte dei tuoi chatbot attivi.
                    </p>
                </div>
                {onTopUp && (
                    <button
                        onClick={onTopUp}
                        className="text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center gap-1"
                    >
                        Acquista Extra
                        <ArrowUpRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="p-6 space-y-6">
                {/* Main Progress Bar */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Budget Mensile</span>
                        <span className={isCritical ? 'text-red-600 font-bold' : isWarning ? 'text-orange-600 font-bold' : 'text-gray-900 font-medium'}>
                            {formatNumber(usage.used)} / {isUnlimited ? '∞' : formatNumber(usage.limit)}
                        </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-gradient-to-r from-yellow-400 to-orange-500'
                                }`}
                            style={{ width: isUnlimited ? '5%' : `${Math.min(usage.percentage, 100)}%` }}
                        />
                    </div>
                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                        <span>
                            Include {formatNumber(usage.monthlyBudget)} mensili
                            {usage.purchased > 0 && ` + ${formatNumber(usage.purchased)} acquistati`}
                        </span>
                        <span>{usage.percentage}% utilizzato</span>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                    <p>
                        I token vengono consumati per ogni risposta generata dall'AI.
                        Se esaurisci il budget, i tuoi chatbot smetteranno di rispondere fino al rinnovo o all&apos;acquisto di un pacchetto extra.
                    </p>
                </div>
            </div>
        </div>
    );
}
