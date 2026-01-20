'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Sparkles,
    RefreshCw,
    Mic,
    MessageSquare,
    Eye,
    ArrowRight,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Info,
    TrendingUp,
    TrendingDown,
    Globe,
    Zap,
    Search
} from "lucide-react";
import { showToast } from "@/components/toast";

interface Action {
    type: string;
    target: string;
    title?: string;
    body: string;
    reasoning: string;
    status: 'pending' | 'approved' | 'rejected';
}

interface Insight {
    id: string;
    topicName: string;
    priorityScore: number;
    crossChannelScore: number;
    suggestedActions: Action[];
    visibilityData?: any;
    status: string;
}

export default function InsightHubPage() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [healthReport, setHealthReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchInsights = async () => {
        try {
            const res = await fetch('/api/insights/sync');
            if (res.ok) {
                const data = await res.json();
                setInsights(data.insights);

                // Find health report record
                const hr = data.insights.find((i: any) => i.topicName === "Health Report: Brand & Sito");
                if (hr && hr.visibilityData?.report) {
                    setHealthReport(hr.visibilityData.report);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/insights/sync', { method: 'POST' });
            if (res.ok) {
                showToast("Insights sincronizzati con successo!");
                fetchInsights();
            } else {
                showToast("Errore durante la sincronizzazione", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Errore di rete", "error");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        Unified Analytics & Insights
                    </h2>
                    <p className="text-muted-foreground font-medium">
                        Analisi cross-channel del brand, del sito e della soddisfazione utenti.
                    </p>
                </div>
                <Button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-8 shadow-lg shadow-amber-200 transition-all hover:scale-105 active:scale-95"
                >
                    {syncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {syncing ? 'Analisi in corso...' : 'Aggiorna Analisi'}
                </Button>
            </div>

            {/* Health Assessment Section */}
            {healthReport && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-gradient-to-br from-white to-green-50/30 border-green-100 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center text-green-700">
                                <MessageSquare className="w-5 h-5" />
                                <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
                                    {healthReport.chatbotSatisfaction.trend === 'improving' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                    {healthReport.chatbotSatisfaction.trend}
                                </Badge>
                            </div>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 pt-2">Soddisfazione Chatbot</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">{healthReport.chatbotSatisfaction.score}%</div>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{healthReport.chatbotSatisfaction.summary}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-white to-blue-50/30 border-blue-100 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center text-blue-700">
                                <Globe className="w-5 h-5" />
                                <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Sito Web</Badge>
                            </div>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 pt-2">Efficacia Contenuti</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">{healthReport.websiteEffectiveness.score}%</div>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{healthReport.websiteEffectiveness.feedbackSummary}</p>
                            <div className="mt-3 flex flex-wrap gap-1">
                                {healthReport.websiteEffectiveness.contentGaps.slice(0, 2).map((gap: string, i: number) => (
                                    <Badge key={i} className="text-[9px] bg-red-50 text-red-600 border-red-100 font-bold uppercase">Manca: {gap}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-white to-amber-50/30 border-amber-100 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center text-amber-700">
                                <Search className="w-5 h-5" />
                                <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">Visibility</Badge>
                            </div>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 pt-2">Presenza Online (LLM)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">{healthReport.brandVisibility.score}%</div>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{healthReport.brandVisibility.competitorInsights}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="space-y-6">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-600 fill-amber-600" />
                    <h3 className="text-xl font-bold text-slate-900">Suggerimenti e Ottimizzazioni</h3>
                </div>

                {loading ? (
                    <div className="grid gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
                        ))}
                    </div>
                ) : insights.filter(i => i.topicName !== "Health Report: Brand & Sito").length === 0 ? (
                    <Card className="border-dashed border-2 bg-slate-50">
                        <CardContent className="flex flex-col items-center py-16 text-center">
                            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 rotate-3">
                                <Info className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Prospettive unificate in arrivo</h3>
                            <p className="text-sm text-slate-500 max-w-sm mt-2">
                                Stiamo correlando i dati dei tuoi canali. Clicca su "Aggiorna Analisi" per generare i primi suggerimenti.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6">
                        {insights.filter(i => i.topicName !== "Health Report: Brand & Sito").map((insight) => (
                            <Card key={insight.id} className="overflow-hidden border-slate-200 hover:border-amber-200 transition-all group hover:shadow-xl hover:shadow-slate-200/50">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-xl font-extrabold text-slate-900 leading-tight">
                                                    {insight.topicName}
                                                </CardTitle>
                                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 font-bold">
                                                    CC Score: {insight.crossChannelScore}%
                                                </Badge>
                                            </div>
                                            <CardDescription className="flex items-center gap-4 pt-2">
                                                <span className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">
                                                    <Mic className="w-3 h-3" /> Interviews
                                                </span>
                                                <span className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">
                                                    <MessageSquare className="w-3 h-3" /> Chatbot
                                                </span>
                                                <span className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">
                                                    <Eye className="w-3 h-3" /> Visibility
                                                </span>
                                            </CardDescription>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-black text-slate-900">
                                                {insight.priorityScore}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Priority
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            Azioni Suggerite
                                        </h4>
                                        <div className="grid gap-4">
                                            {insight.suggestedActions.map((action, idx) => (
                                                <div key={idx} className="flex flex-col md:flex-row md:items-start justify-between gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 group/action hover:bg-white hover:border-amber-200 hover:shadow-lg transition-all duration-300">
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={`${action.target === 'website' ? 'bg-blue-100 text-blue-700' :
                                                                    action.target === 'chatbot' ? 'bg-purple-100 text-purple-700' :
                                                                        'bg-amber-100 text-amber-700'
                                                                } hover:bg-opacity-80 border-none px-2.5 py-0.5 font-bold uppercase text-[9px]`}>
                                                                {action.target}
                                                            </Badge>
                                                            <Badge variant="outline" title={action.type} className="text-[9px] uppercase font-bold border-slate-200">
                                                                {action.type.replace('_', ' ')}
                                                            </Badge>
                                                            <span className="text-sm font-extrabold text-slate-800 ml-1">
                                                                {action.title || action.type}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                                            {action.body}
                                                        </p>
                                                        <div className="pt-2 flex items-start gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5" />
                                                            <p className="text-xs text-slate-400 font-semibold italic">
                                                                "Perché: {action.reasoning}"
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 md:pt-1">
                                                        <Button variant="outline" size="sm" className="h-9 px-4 rounded-full font-bold text-xs gap-2 border-slate-200 hover:border-amber-500 hover:text-amber-600 hover:bg-amber-50 group/btn transition-all">
                                                            Applica <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
