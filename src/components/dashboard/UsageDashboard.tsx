'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { PLANS, PlanType } from '@/config/plans';
import { Progress } from "@/components/ui/progress";
import { Info, AlertCircle, ShoppingCart, Lightbulb, MessageSquare, Bot, Eye } from 'lucide-react';
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
        scansLimit: number; // Weekly auto
        manualScansToday: number;
        manualScansLimit: number; // Per day
        brandsUsed: number;
        brandsLimit: number;
        competitorsUsed: number;
        competitorsLimit: number;
        promptsUsed: number;
        promptsLimit: number;
    };
    aiTipsEnabled: boolean;
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
                const visibilityConfigs = org.visibilityConfigs || [];
                const brandsUsed = visibilityConfigs.length;
                const scansUsed = visibilityConfigs.reduce((sum: number, vc: any) => sum + (vc.scans?.length || 0), 0);
                const competitorsUsed = visibilityConfigs.reduce((sum: number, vc: any) => sum + (vc.competitors?.filter((c: any) => c.enabled)?.length || 0), 0);
                const promptsUsed = visibilityConfigs.reduce((sum: number, vc: any) => sum + (vc.prompts?.filter((p: any) => p.enabled)?.length || 0), 0);

                // Count today's manual scans
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const manualScansToday = visibilityConfigs.reduce((sum: number, vc: any) => {
                    return sum + (vc.scans?.filter((s: any) => {
                        const scanDate = new Date(s.startedAt);
                        return scanDate >= today && s.scanType === 'manual';
                    })?.length || 0);
                }, 0);

                // Count bots from projects
                const botsCount = org.projects?.reduce((sum: number, p: any) => sum + (p.bots?.length || 0), 0) || 0;

                setUsage({
                    plan: planKey,
                    responsesUsed: org.responsesUsedThisMonth || 0,
                    responsesLimit: planConfig.responsesPerMonth,
                    activeBots: botsCount,
                    botsLimit: planConfig.limits.maxActiveBots,
                    chatbots: {
                        conversationsUsed: org.tokenUsage?.chatbotConversations || 0,
                        conversationsLimit: planKey === PlanType.STARTER ? 2000 : planKey === PlanType.PRO ? 10000 : planKey === PlanType.BUSINESS ? 30000 : 0
                    },
                    visibility: {
                        scansUsed: scansUsed,
                        scansLimit: planConfig.limits.visibilityScansPerWeek,
                        manualScansToday: manualScansToday,
                        manualScansLimit: planConfig.limits.maxManualScansPerDay,
                        brandsUsed: brandsUsed,
                        brandsLimit: planConfig.limits.maxBrandsTracked,
                        competitorsUsed: competitorsUsed,
                        competitorsLimit: planConfig.limits.maxCompetitorsTracked,
                        promptsUsed: promptsUsed,
                        promptsLimit: planConfig.limits.maxVisibilityPrompts
                    },
                    aiTipsEnabled: planConfig.limits.aiTipsEnabled,
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
                {usage.visibility.brandsLimit > 0 && (
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
                            {renderUsageRow("Brand Monitorati", usage.visibility.brandsUsed, usage.visibility.brandsLimit, 'brand')}
                            {renderUsageRow("Competitor Totali", usage.visibility.competitorsUsed, usage.visibility.competitorsLimit, 'competitor')}
                            {renderUsageRow("Prompt Custom", usage.visibility.promptsUsed, usage.visibility.promptsLimit, 'prompt')}
                            {renderUsageRow("Scan Manuali Oggi", usage.visibility.manualScansToday, usage.visibility.manualScansLimit, 'scan/giorno')}
                        </div>
                    </div>
                )}

                {/* AI Tips Status */}
                <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${usage.aiTipsEnabled ? 'bg-amber-100' : 'bg-gray-100'}`}>
                            <Lightbulb className={`w-5 h-5 ${usage.aiTipsEnabled ? 'text-amber-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">AI Tips</p>
                            <p className="text-xs text-gray-500">Suggerimenti strategici basati sui tuoi dati</p>
                        </div>
                    </div>
                    {usage.aiTipsEnabled ? (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">ATTIVO</span>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => window.location.href = '/pricing'}>
                            Passa a PRO
                        </Button>
                    )}
                </div>
            </div>

            {/* Add-ons Section */}
            <div className="pt-6 border-t bg-gradient-to-br from-gray-50 to-purple-50/30 -mx-6 -mb-6 p-6 rounded-b-xl">
                <h4 className="font-semibold mb-4 flex items-center gap-2 text-gray-900">
                    <ShoppingCart className="w-5 h-5 text-purple-600" />
                    Pacchetti Extra
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Interview Pack */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">+500 Interviste</p>
                                <p className="text-xs text-gray-500">Una tantum</p>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-2xl font-bold text-gray-900">€29</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => window.open(process.env.NEXT_PUBLIC_STRIPE_ADDON_INTERVIEWS || '#', '_blank')}
                        >
                            Acquista
                        </Button>
                    </div>

                    {/* Chatbot Messages Pack */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Bot className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">+5.000 Messaggi</p>
                                <p className="text-xs text-gray-500">Chatbot AI</p>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-2xl font-bold text-gray-900">€49</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => window.open(process.env.NEXT_PUBLIC_STRIPE_ADDON_CHATBOT || '#', '_blank')}
                        >
                            Acquista
                        </Button>
                    </div>

                    {/* Visibility Scans Pack */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Eye className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">+20 Scan</p>
                                <p className="text-xs text-gray-500">Visibility Tracking</p>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-2xl font-bold text-gray-900">€39</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => window.open(process.env.NEXT_PUBLIC_STRIPE_ADDON_VISIBILITY || '#', '_blank')}
                        >
                            Acquista
                        </Button>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-4 text-center">
                    I pacchetti extra non scadono e si sommano al tuo piano mensile.
                </p>
            </div>
        </Card>
    );
}
