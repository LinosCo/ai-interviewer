'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';

interface UpgradePromptProps {
    reason: string;
    currentTier: string;
    dismissable?: boolean;
}

export default function UpgradePrompt({ reason, currentTier, dismissable = true }: UpgradePromptProps) {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;

    return (
        <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-5 text-white">
            {dismissable && (
                <button
                    onClick={() => setDismissed(true)}
                    className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
            <div className="flex items-start gap-4">
                <div className="p-2 bg-white/20 rounded-lg">
                    <Sparkles className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold mb-1">Limite raggiunto</h3>
                    <p className="text-sm text-purple-100 mb-3">{reason}</p>
                    <Link
                        href="/pricing"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors"
                    >
                        Effettua l'upgrade
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

// Banner version for inline use
export function UpgradeBanner({ message }: { message: string }) {
    return (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-orange-100 rounded-lg">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-sm text-orange-800">{message}</p>
            </div>
            <Link
                href="/pricing"
                className="text-sm font-medium text-orange-700 hover:text-orange-800 flex items-center gap-1"
            >
                Upgrade
                <ArrowRight className="w-3 h-3" />
            </Link>
        </div>
    );
}
