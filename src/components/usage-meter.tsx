'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

interface UsageMeterProps {
    label: string;
    used: number;
    limit: number;
    href?: string;
}

export default function UsageMeter({ label, used, limit, href }: UsageMeterProps) {
    const isUnlimited = limit === -1;
    const percentage = isUnlimited ? 10 : Math.min(Math.round((used / limit) * 100), 100);
    const isWarning = percentage >= 80 && !isUnlimited;
    const isCritical = percentage >= 100 && !isUnlimited;

    const content = (
        <div className={`p-3 rounded-lg transition-colors ${href ? 'hover:bg-gray-800 cursor-pointer' : ''
            }`}>
            <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400">{label}</span>
                <span className={`font-medium ${isCritical ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-gray-300'
                    }`}>
                    {used}/{isUnlimited ? '∞' : limit}
                </span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-purple-500'
                        }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
}

// Compact version for sidebar
export function UsageMeterCompact({
    interviewsUsed,
    interviewsLimit,
    botsUsed,
    botsLimit
}: {
    interviewsUsed: number;
    interviewsLimit: number;
    botsUsed: number;
    botsLimit: number;
}) {
    const interviewsPct = interviewsLimit > 0 ? Math.round((interviewsUsed / interviewsLimit) * 100) : 0;
    const isWarning = interviewsPct >= 80;

    return (
        <Link
            href="/dashboard/billing"
            className="block p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
            <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400">Utilizzo</span>
            </div>
            <div className="space-y-2">
                <div>
                    <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-500">Risposte</span>
                        <span className={isWarning ? 'text-orange-400' : 'text-gray-400'}>
                            {interviewsUsed}/{interviewsLimit === -1 ? '∞' : interviewsLimit}
                        </span>
                    </div>
                    <div className="h-1 bg-gray-700 rounded-full">
                        <div
                            className={`h-full rounded-full ${isWarning ? 'bg-orange-500' : 'bg-purple-500'}`}
                            style={{ width: `${Math.min(interviewsPct, 100)}%` }}
                        />
                    </div>
                </div>
            </div>
        </Link>
    );
}
