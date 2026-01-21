'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { PLANS, PlanType } from '@/config/plans';
import { Progress } from "@/components/ui/progress";
import { Info, AlertCircle, ShoppingCart } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface UsageData {
    plan: PlanType;
    responsesUsed: number;
    responsesLimit: number;
    activeBots: number;
    botsLimit: number;
    chatbots: {
        conversationsUsed: number; // Placeholder, need real data source in verify
        conversationsLimit: number;
    };
    visibility: {
        scansUsed: number;
        scansLimit: number; // Weekly
        competitorsUsed: number;
        competitorsLimit: number;
        promptsUsed: number;
        promptsLimit: number;
    };
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
                const planKey = org.plan as PlanType;
                const planConfig = PLANS[planKey] || PLANS[PlanType.TRIAL]; // Default or fallback

                // Calculate Visibility Usage
                const visibilityConfig = org.visibilityConfig;
                const scansUsed = visibilityConfig?.scans?.length || 0;
                const competitorsUsed = visibilityConfig?.competitors?.length || 0;
                const promptsUsed = visibilityConfig?.prompts?.length || 0;

                // Count bots from projects
                const botsCount = org.projects?.reduce((sum: number, p: any) => sum + (p.bots?.length || 0), 0) || 0;

                setUsage({
                    plan: planKey,
                    responsesUsed: org.responsesUsedThisMonth,
                    responsesLimit: planConfig.responsesPerMonth,
                    activeBots: botsCount, // Count bots from all projects
                    botsLimit: planConfig.limits.maxActiveChatbots,
                    chatbots: {
                        // TODO: Fetch real conversation usage from tokenUsage or specific conversational log
                        conversationsUsed: 0,
                        conversationsLimit: planKey === PlanType.STARTER ? 2000 : planKey === PlanType.PRO ? 10000 : planKey === PlanType.BUSINESS ? 30000 : 0
                    },
                    visibility: {
                        scansUsed: scansUsed,
                        scansLimit: planConfig.limits.visibilityScansPerWeek,
                        competitorsUsed: competitorsUsed,
                        competitorsLimit: planConfig.limits.maxCompetitorsTracked,
                        promptsUsed: promptsUsed,
                        promptsLimit: planConfig.limits.maxVisibilityPrompts
                    },
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
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-20 bg-gray-200 rounded w-full"></div>
                    <div className="h-20 bg-gray-200 rounded w-full"></div>
                    <div className="h-20 bg-gray-200 rounded w-full"></div>
                </div>
            </Card>
        );
    }

    if (!usage) return null;

    const daysUntilReset = Math.ceil(
        (new Date(usage.resetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const renderUsageRow = (label: string, used: number, limit: number, unit: string, canBuyExtra: boolean = false, extraLink: string = "#") => {
        const percentage = limit > 0 ? (used / limit) * 100 : 0;
        const isNearLimit = percentage >= 80;
        const isAtLimit = used >= limit && limit !== -1; // -1 for infinite (handled via large numbers usually but sticking to explicit checks)
        const displayLimit = limit === -1 ? '∞' : limit;

        return (
            <div className="mb-6 last:mb-0">
                <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        {isNearLimit && <AlertCircle className={`w-4 h-4 ${isAtLimit ? 'text-red-500' : 'text-amber-500'}`} />}
                    </div>
                    <div className="text-sm font-medium">
                        {used} <span className="text-gray-400">/ {displayLimit} {unit}</span>
                    </div>
                </div>
                <Progress value={Math.min(percentage, 100)} className={`h-2 ${isAtLimit ? 'bg-red-100' : ''}`} indicatorClassName={isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-primary'} />
                {canBuyExtra && (isNearLimit || isAtLimit) && (
                    <div className="mt-2 text-right">
                        <Button variant="link" size="sm" className="text-primary p-0 h-auto" onClick={() => window.location.href = extraLink}>
                            Acquista pacchetto extra (+{unit})
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h2 className="text-xl font-semibold">Stato Abbonamento</h2>
                    <p className="text-sm text-gray-500">Rinnovo tra {daysUntilReset} giorni</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold uppercase tracking-wide">
                        {usage.plan}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/pricing'}>
                        Cambia Piano
                    </Button>
                </div>
            </div>

            <div className="space-y-8">
                {/* Interviste */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        Interviste & Progetti
                    </h3>
                    {renderUsageRow("Interviste Mensili", usage.responsesUsed, usage.responsesLimit, 'interviste', true, '/billing/add-interviews')}
                    {renderUsageRow("Progetti Attivi", usage.activeBots, usage.botsLimit, 'progetti', false)}
                </div>

                {/* Chatbots */}
                {usage.plan !== PlanType.TRIAL && ( // Hide for basic trial if needed, but showing 0 is fine
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                            Chatbot AI
                        </h3>
                        {/* Conversazioni Mensili - Mocked for now until backend hookup */}
                        {renderUsageRow("Conversazioni Chatbot", usage.chatbots.conversationsUsed, usage.chatbots.conversationsLimit, 'msg', true, '/billing/add-conversations')}
                    </div>
                )}

                {/* Visibility */}
                {usage.responsesLimit > 300 && ( // Show only for PRO/BUSINESS roughly
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                                Visibility Tracking
                            </h3>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="w-4 h-4 text-gray-400" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Monitoraggio della brand reputation su Web e AI</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {renderUsageRow("Scan Settimanali", usage.visibility.scansUsed, usage.visibility.scansLimit, 'scan')}
                            {renderUsageRow("Competitor Monitorati", usage.visibility.competitorsUsed, usage.visibility.competitorsLimit, 'competitor')}
                            {renderUsageRow("Prompt Custom", usage.visibility.promptsUsed, usage.visibility.promptsLimit, 'prompt')}
                        </div>
                    </div>
                )}
            </div>

            {/* Add-ons Section */}
            <div className="pt-6 border-t bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-xl">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Hai bisogno di più risorse?
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button variant="outline" className="justify-start bg-white" onClick={() => window.location.href = 'https://buy.stripe.com/test_pack_500'}>
                        +500 Interviste (€10)
                    </Button>
                    <Button variant="outline" className="justify-start bg-white" onClick={() => window.location.href = 'https://buy.stripe.com/test_pack_1000msg'}>
                        +1.000 Messaggi Bot (€25)
                    </Button>
                </div>
            </div>
        </Card>
    );
}
