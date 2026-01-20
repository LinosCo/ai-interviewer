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
    Info
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
    status: string;
}

export default function InsightHubPage() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchInsights = async () => {
        try {
            const res = await fetch('/api/insights/sync');
            if (res.ok) {
                const data = await res.json();
                setInsights(data.insights);
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
        <div className="space-y-8 p-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        Insight Hub
                    </h2>
                    <p className="text-muted-foreground">
                        Correlazioni intelligenti tra Interviste, Chatbot e Visibility.
                    </p>
                </div>
                <Button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 transition-all transform hover:scale-105"
                >
                    {syncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Sincronizza Canali
                </Button>
            </div>

            {loading ? (
                <div className="grid gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : insights.length === 0 ? (
                <Card className="border-dashed border-2 bg-slate-50">
                    <CardContent className="flex flex-col items-center py-12 text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <Info className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Nessun insight generato</h3>
                        <p className="text-sm text-slate-500 max-w-xs mt-1">
                            Clicca su "Sincronizza Canali" per analizzare i dati e trovare suggerimenti.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {insights.map((insight) => (
                        <Card key={insight.id} className="overflow-hidden border-slate-200 hover:border-indigo-200 transition-all group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-xl font-bold text-slate-900 leading-tight">
                                                {insight.topicName}
                                            </CardTitle>
                                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100">
                                                CC Score: {insight.crossChannelScore}%
                                            </Badge>
                                        </div>
                                        <CardDescription className="flex items-center gap-4 pt-2">
                                            <span className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-xs font-medium">
                                                <Mic className="w-3 h-3" /> Interviews
                                            </span>
                                            <span className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-xs font-medium">
                                                <MessageSquare className="w-3 h-3" /> Chatbot
                                            </span>
                                            <span className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-xs font-medium">
                                                <Eye className="w-3 h-3" /> Visibility
                                            </span>
                                        </CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-slate-900">
                                            {insight.priorityScore}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Priority
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <ArrowRight className="w-3 h-3" /> Azioni Suggerite
                                    </h4>
                                    <div className="grid gap-3">
                                        {insight.suggestedActions.map((action, idx) => (
                                            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 group/action hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none px-2 py-0">
                                                            {action.target}
                                                        </Badge>
                                                        <span className="text-sm font-bold text-slate-800">
                                                            {action.title || action.type}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 line-clamp-2">
                                                        {action.body}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-medium italic">
                                                        "Perché: {action.reasoning}"
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover/action:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-green-50 hover:text-green-600">
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:text-red-600">
                                                        <XCircle className="h-5 w-5" />
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                                                        Apri <ChevronRight className="h-3 w-3" />
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
    );
}
