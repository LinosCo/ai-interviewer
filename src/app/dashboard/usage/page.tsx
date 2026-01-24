'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    Zap,
    MessageSquare,
    Eye,
    Lightbulb,
    CreditCard,
    AlertCircle,
    TrendingUp,
    History,
    Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function UsagePage() {
    const [usage, setUsage] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUsage() {
            try {
                const res = await fetch('/api/usage');
                const data = await res.json();
                setUsage(data);
            } catch (err) {
                console.error('Error fetching usage:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchUsage();
    }, []);

    if (loading) return <div className="p-8">Caricamento usage...</div>;
    if (!usage) return <div className="p-8">Errore nel caricamento dei dati.</div>;

    const ResourceCard = ({ title, icon: Icon, data, color }: any) => {
        const isInf = data.limit === -1 || data.total === -1;

        return (
            <Card className="overflow-hidden border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-${color}-50 text-${color}-600`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        {title}
                    </CardTitle>
                    <Badge variant="outline" className={`${isInf ? 'bg-green-50 text-green-700' : ''}`}>
                        {isInf ? 'Illimitato' : `${data.used} / ${data.total}`}
                    </Badge>
                </CardHeader>
                <CardContent>
                    <div className="mt-2 space-y-3">
                        {!isInf && (
                            <>
                                <Progress value={data.percentage} className={`h-2 bg-${color}-100`} />
                                <div className="flex justify-between text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                                    <span>Utilizzato: {data.used}</span>
                                    <span>{data.percentage}%</span>
                                </div>
                            </>
                        )}
                        {isInf && (
                            <div className="text-xs text-slate-500">
                                Pieno accesso alle risorse per questo periodo.
                            </div>
                        )}
                        {data.extra > 0 && (
                            <div className="pt-2 flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50 rounded-md px-2 py-1">
                                <Zap className="w-3 h-3" />
                                <span>INCLUDE {data.extra} EXTRA DA ADD-ON</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                            Usage & Billing
                        </h1>
                        <Badge className="bg-blue-600 font-bold px-3 py-1">
                            Piano {usage.tier}
                        </Badge>
                    </div>
                    <p className="text-slate-500 font-medium">
                        Monitora le tue risorse e gestisci il tuo abbonamento.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Link href="/dashboard/settings/billing" className="inline-flex items-center justify-center rounded-xl font-bold border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                        <CreditCard className="w-4 h-4 mr-2" /> Gestisci Billing
                    </Link>
                    <Link href="/dashboard/billing/plans" className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-white px-4 py-2 transition-colors">
                        Upgrade Piano
                    </Link>
                </div>
            </div>

            {/* Grid Risorse */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ResourceCard
                    title="Interviste"
                    icon={TrendingUp}
                    data={usage.interviews}
                    color="blue"
                />
                <ResourceCard
                    title="Chatbot Sessions"
                    icon={MessageSquare}
                    data={usage.chatbotSessions}
                    color="purple"
                />
                <ResourceCard
                    title="Brand Monitor"
                    icon={Eye}
                    data={usage.visibilityQueries}
                    color="cyan"
                />
                <ResourceCard
                    title="AI Suggestions"
                    icon={Lightbulb}
                    data={usage.aiSuggestions}
                    color="amber"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Token Budget */}
                <Card className="lg:col-span-2 border-slate-100 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold">Budget Token AI</CardTitle>
                                <CardDescription>Consumo combinato di tutti i modelli AI utilizzati</CardDescription>
                            </div>
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Zap className="w-6 h-6" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-bold">
                                <span>{usage.tokens.percentage}% Utilizzato</span>
                                <span>{usage.tokens.used.toLocaleString()} / {usage.tokens.limit === -1 ? '∞' : usage.tokens.total.toLocaleString()}</span>
                            </div>
                            <Progress value={usage.tokens.percentage} className="h-4 bg-indigo-50" />
                        </div>

                        {/* Breakdown */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                            {[
                                { label: 'Interviste', value: usage.tokens.breakdown.interview, color: 'bg-blue-500' },
                                { label: 'Chatbot', value: usage.tokens.breakdown.chatbot, color: 'bg-purple-500' },
                                { label: 'Visibility', value: usage.tokens.breakdown.visibility, color: 'bg-cyan-500' },
                                { label: 'AI Tips', value: usage.tokens.breakdown.suggestion, color: 'bg-amber-500' },
                                { label: 'Sistema', value: usage.tokens.breakdown.system, color: 'bg-slate-500' },
                            ].map((item, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{item.label}</span>
                                    </div>
                                    <div className="text-xs font-black text-slate-900">
                                        {(item.value / 1000).toFixed(1)}k
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Info Periodo */}
                <Card className="border-slate-100 shadow-sm bg-slate-50/50">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <History className="w-5 h-5 text-slate-400" />
                            Periodo di Fatturazione
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Inizio</p>
                            <p className="text-sm font-bold">{new Date(usage.period.start).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Prossimo Rinnovo</p>
                            <p className="text-sm font-bold text-indigo-600">{new Date(usage.period.end).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-blue-100">
                                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-slate-600 leading-relaxed italic">
                                    I contatori delle risorse (esclusi gli add-on) vengono resettati automaticamente ad ogni rinnovo del periodo.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Add-ons Attivi */}
            {usage.addOns.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                        Add-ons Attivi
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {usage.addOns.map((addon: any) => (
                            <Card key={addon.id} className="border-amber-100 bg-amber-50/20">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">{addon.type.replace('_', ' ')}</p>
                                        <p className="text-lg font-black text-slate-900">{addon.remaining.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-500">Residui da acquisto</p>
                                    </div>
                                    <Badge className="bg-amber-100 text-amber-700 border-none">Attivo</Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Warning se quasi esauriti */}
            {(usage.tokens.percentage > 85 || usage.interviews.percentage > 85) && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-4">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-red-900">Risorse quasi esaurite</h3>
                        <p className="text-sm text-red-700">Hai utilizzato oltre l'85% di alcune risorse incluse nel tuo piano. Considera un upgrade o l'acquisto di un add-on per evitare interruzioni.</p>
                        <Link href="/dashboard/billing/plans" className="text-red-600 font-bold text-sm mt-1 hover:underline">
                            Vedi opzioni upgrade →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
