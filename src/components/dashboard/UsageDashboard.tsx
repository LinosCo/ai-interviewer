'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { Progress } from "@/components/ui/progress";
import { Info, AlertCircle, ShoppingCart, Lightbulb, MessageSquare, Bot, Sparkles } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import Link from 'next/link';

export function UsageDashboard() {
    const [usage, setUsage] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const response = await fetch('/api/usage');
                const data = await response.json();
                setUsage(data);
            } catch (error) {
                console.error('Failed to fetch usage:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchUsage();
    }, []);

    if (loading) {
        return (
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-20 bg-gray-200 rounded w-full"></div>
                </div>
            </Card>
        );
    }

    if (!usage) return null;

    const renderUsageRow = (label: string, icon: any, data: any, unit: string) => {
        const Icon = icon;
        const percentage = data.percentage || 0;
        const used = data.used || 0;
        const limit = data.limit === -1 ? '∞' : data.limit || 0;

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{label}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                        {used.toLocaleString()} <span className="text-slate-400 font-medium">/ {limit.toLocaleString()} {unit}</span>
                    </span>
                </div>
                <Progress value={Math.min(percentage, 100)} className="h-1.5" />
            </div>
        );
    };

    return (
        <Card className="p-6 space-y-6 border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Utilizzo Risorse</h2>
                    <p className="text-xs text-slate-500 font-medium">Prossimo reset: {new Date(usage.period.end).toLocaleDateString()}</p>
                </div>
                <Link href="/dashboard/settings/billing">
                    <Button variant="outline" size="sm" className="rounded-lg font-bold text-xs h-8">Gestisci</Button>
                </Link>
            </div>

            <div className="space-y-6">
                {renderUsageRow("Token AI", Sparkles, usage.tokens, "token")}
                {renderUsageRow("Interviste", MessageSquare, usage.interviews, "interviste")}
                {renderUsageRow("Chatbot Sessions", Bot, usage.chatbotSessions, "sessioni")}
            </div>

            <div className="pt-4 border-t border-slate-50">
                <div className="bg-indigo-50/50 rounded-xl p-4 flex items-start gap-3 border border-indigo-100/50">
                    <Info className="w-4 h-4 text-indigo-500 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-indigo-900">Hai bisogno di più budget?</p>
                        <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                            Puoi acquistare pacchetti di token o interviste extra senza cambiare piano.
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
}
