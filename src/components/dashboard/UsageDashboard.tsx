'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { PLANS } from '@/config/plans';

interface UsageData {
    plan: string;
    responsesUsed: number;
    responsesLimit: number;
    resetDate: string;
}

export function UsageDashboard() {
    const [usage, setUsage] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsage();
    }, []);

    const fetchUsage = async () => {
        try {
            const response = await fetch('/api/user/settings');
            const data = await response.json();

            if (data.memberships?.[0]?.organization) {
                const org = data.memberships[0].organization;
                setUsage({
                    plan: org.plan,
                    responsesUsed: org.responsesUsedThisMonth,
                    responsesLimit: PLANS[org.plan.toLowerCase() as keyof typeof PLANS]?.responsesPerMonth || 0,
                    resetDate: org.monthlyResetDate
                });
            }
        } catch (error) {
            console.error('Failed to fetch usage:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
            </Card>
        );
    }

    if (!usage) {
        return null;
    }

    const percentage = (usage.responsesUsed / usage.responsesLimit) * 100;
    const remaining = usage.responsesLimit - usage.responsesUsed;
    const daysUntilReset = Math.ceil(
        (new Date(usage.resetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const isNearLimit = percentage >= 80;
    const isAtLimit = remaining <= 0;

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Utilizzo Mensile</h2>
                <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                    Piano {usage.plan}
                </span>
            </div>

            <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">Risposte utilizzate</span>
                        <span className="text-gray-600">
                            {usage.responsesUsed} / {usage.responsesLimit}
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${isAtLimit
                                    ? 'bg-red-500'
                                    : isNearLimit
                                        ? 'bg-amber-500'
                                        : 'bg-green-500'
                                }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                        <p className="text-sm text-gray-600">Risposte rimanenti</p>
                        <p className={`text-2xl font-bold ${isAtLimit ? 'text-red-600' : 'text-gray-900'}`}>
                            {Math.max(remaining, 0)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Reset tra</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {daysUntilReset} {daysUntilReset === 1 ? 'giorno' : 'giorni'}
                        </p>
                    </div>
                </div>

                {/* Warning/Upsell */}
                {isNearLimit && (
                    <div className={`p-4 rounded-lg ${isAtLimit ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                        <p className={`text-sm ${isAtLimit ? 'text-red-800' : 'text-amber-800'} mb-3`}>
                            {isAtLimit
                                ? '⚠️ Hai raggiunto il limite mensile. Le interviste sono in pausa.'
                                : '⚠️ Stai per raggiungere il limite mensile.'}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.location.href = '/pricing'}
                            >
                                Fai Upgrade
                            </Button>
                            {isAtLimit && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => window.location.href = '/billing/add-responses'}
                                >
                                    Acquista Risposte Extra
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
