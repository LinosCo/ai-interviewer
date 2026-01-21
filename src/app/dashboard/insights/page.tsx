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
    Search,
    Phone,
    Lightbulb,
    Save
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

// Helper: determine if action is strategic (needs consultation) vs operational (can be auto-applied)
const isStrategicAction = (type: string, target: string): boolean => {
    const strategicTypes = ['create_content', 'modify_content', 'respond_to_press', 'monitor_competitor', 'strategic_recommendation', 'pricing_change', 'product_improvement', 'marketing_campaign'];
    const strategicTargets = ['website', 'pr', 'serp', 'strategy', 'product', 'marketing'];
    return strategicTypes.includes(type) || strategicTargets.includes(target);
};

// Helper: get human-readable action type label in Italian
const getActionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        'add_faq': 'Aggiungi FAQ',
        'add_interview_topic': 'Nuovo tema intervista',
        'add_visibility_prompt': 'Monitor nuova query',
        'create_content': 'Crea contenuto',
        'modify_content': 'Modifica contenuto',
        'respond_to_press': 'Risposta PR',
        'monitor_competitor': 'Monitor competitor',
        'strategic_recommendation': 'Suggerimento strategico',
        'pricing_change': 'Revisione prezzi',
        'product_improvement': 'Miglioramento prodotto',
        'marketing_campaign': 'Campagna marketing'
    };
    return labels[type] || type.replace(/_/g, ' ');
};

// Helper: get human-readable target label in Italian
const getTargetLabel = (target: string): string => {
    const labels: Record<string, string> = {
        'chatbot': 'Assistente',
        'interview': 'Interviste',
        'visibility': 'Visibilità',
        'website': 'Sito Web',
        'pr': 'PR & Media',
        'serp': 'Google',
        'strategy': 'Strategia',
        'product': 'Prodotto',
        'marketing': 'Marketing'
    };
    return labels[target] || target;
};

export default function InsightHubPage() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [healthReport, setHealthReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [strategicVision, setStrategicVision] = useState('');
    const [valueProposition, setValueProposition] = useState('');
    const [isSavingStrategy, setIsSavingStrategy] = useState(false);
    const [showStrategyEdit, setShowStrategyEdit] = useState(false);

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

    const fetchStrategy = async () => {
        try {
            const res = await fetch('/api/organization/settings');
            if (res.ok) {
                const data = await res.json();
                setStrategicVision(data.strategicVision || '');
                setValueProposition(data.valueProposition || '');
            }
        } catch (err) {
            console.error('Fetch strategy error:', err);
        }
    };

    useEffect(() => {
        fetchInsights();
        fetchStrategy();
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

    const handleSaveStrategy = async () => {
        setIsSavingStrategy(true);
        try {
            const res = await fetch('/api/organization/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategicVision, valueProposition })
            });
            if (res.ok) {
                showToast("Strategia salvata! Verrà usata per la prossima analisi.");
                setShowStrategyEdit(false);
            } else {
                showToast("Errore durante il salvataggio", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Errore di rete", "error");
        } finally {
            setIsSavingStrategy(false);
        }
    };

    const handleConsultation = (action: Action) => {
        // Open mailto with pre-filled subject
        const subject = encodeURIComponent(`Richiesta consulenza: ${action.title || action.type}`);
        const body = encodeURIComponent(`Ciao,\n\nVorrei richiedere una consulenza riguardo a:\n\n${action.body}\n\nMotivazione: ${action.reasoning}\n\nGrazie`);
        window.open(`mailto:consulenza@businesstuner.com?subject=${subject}&body=${body}`);
        showToast("Email di richiesta consulenza aperta");
    };

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        AI Tips
                    </h2>
                    <p className="text-muted-foreground font-medium">
                        Unisci l'ascolto dei clienti con la tua visione strategica.
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

            {/* Strategic Context Section */}
            <Card className="border-amber-100 bg-amber-50/20">
                <CardHeader className="pb-3 border-b border-amber-100/50 bg-white/50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                                <Lightbulb className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold">Visione Strategica & Value Prop</CardTitle>
                                <CardDescription className="text-xs">Definisci i binari su cui l'AI genererà i suggerimenti.</CardDescription>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowStrategyEdit(!showStrategyEdit)}
                            className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                        >
                            {showStrategyEdit ? 'Annulla' : (strategicVision || valueProposition ? 'Modifica' : 'Imposta Strategia')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {showStrategyEdit ? (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 ml-1">Visione Strategica</label>
                                    <textarea
                                        value={strategicVision}
                                        onChange={(e) => setStrategicVision(e.target.value)}
                                        placeholder="Esempio: Diventare il punto di riferimento per l'automazione HR in Italia entro il 2026..."
                                        className="w-full h-32 p-4 text-sm rounded-2xl border border-amber-100 bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:italic"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 ml-1">Value Proposition</label>
                                    <textarea
                                        value={valueProposition}
                                        onChange={(e) => setValueProposition(e.target.value)}
                                        placeholder="Esempio: Aiutiamo le aziende a scalare riducendo i costi di recruiting del 40% tramite intelligenza artificiale."
                                        className="w-full h-32 p-4 text-sm rounded-2xl border border-amber-100 bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all placeholder:italic"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    onClick={handleSaveStrategy}
                                    disabled={isSavingStrategy}
                                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-8 shadow-md"
                                >
                                    {isSavingStrategy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salva Strategia
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="relative p-6 bg-white rounded-[2rem] border border-amber-50 shadow-sm group hover:shadow-md transition-all">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <TrendingUp className="w-12 h-12 text-amber-900" />
                                </div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Visione Attuale</h4>
                                <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                    {strategicVision || "Non ancora definita. Clicca su 'Imposta Strategia' per aiutare l'AI a darti suggerimenti più mirati."}
                                </p>
                            </div>
                            <div className="relative p-6 bg-white rounded-[2rem] border border-amber-50 shadow-sm group hover:shadow-md transition-all">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Zap className="w-12 h-12 text-amber-900" />
                                </div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Value Proposition</h4>
                                <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                    {valueProposition || "Non ancora definita. Definisci il tuo valore unico per ottenere analisi migliori."}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

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
                                <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">Reputazione</Badge>
                            </div>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 pt-2">Reputazione Online</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black text-slate-900">{healthReport.brandVisibility.score}%</div>
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{healthReport.brandVisibility.competitorInsights}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-600 fill-amber-600" />
                        <h3 className="text-xl font-bold text-slate-900">Cosa Migliorare</h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-slate-500 font-medium">Automatico</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-slate-500 font-medium">Richiede consulenza</span>
                        </div>
                    </div>
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
                                <Lightbulb className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Suggerimenti in arrivo</h3>
                            <p className="text-sm text-slate-500 max-w-sm mt-2">
                                Stiamo analizzando feedback, domande dei clienti e reputazione online. Clicca su "Aggiorna Analisi" per generare i primi suggerimenti.
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
                                                    <Mic className="w-3 h-3" /> Feedback
                                                </span>
                                                <span className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">
                                                    <MessageSquare className="w-3 h-3" /> Domande clienti
                                                </span>
                                                <span className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-full">
                                                    <Eye className="w-3 h-3" /> Reputazione
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
                                            {insight.suggestedActions.map((action, idx) => {
                                                const strategic = isStrategicAction(action.type, action.target);
                                                return (
                                                    <div key={idx} className={`flex flex-col md:flex-row md:items-start justify-between gap-4 p-5 rounded-2xl border group/action hover:shadow-lg transition-all duration-300 ${strategic ? 'bg-purple-50/50 border-purple-100 hover:bg-white hover:border-purple-300' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-green-300'}`}>
                                                        <div className="flex-1 space-y-2">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {/* Action type indicator */}
                                                                <div className={`w-2 h-2 rounded-full ${strategic ? 'bg-purple-500' : 'bg-green-500'}`} title={strategic ? 'Richiede consulenza' : 'Applicabile automaticamente'} />
                                                                <Badge className={`${action.target === 'website' || action.target === 'strategy' ? 'bg-blue-100 text-blue-700' :
                                                                    action.target === 'chatbot' || action.target === 'interview' ? 'bg-green-100 text-green-700' :
                                                                        action.target === 'product' ? 'bg-indigo-100 text-indigo-700' :
                                                                            action.target === 'marketing' || action.target === 'pr' ? 'bg-pink-100 text-pink-700' :
                                                                                'bg-amber-100 text-amber-700'
                                                                    } hover:bg-opacity-80 border-none px-2.5 py-0.5 font-bold uppercase text-[9px]`}>
                                                                    {getTargetLabel(action.target)}
                                                                </Badge>
                                                                <Badge variant="outline" className={`text-[9px] uppercase font-bold ${strategic ? 'border-purple-200 bg-purple-50' : 'border-green-200 bg-green-50'}`}>
                                                                    {getActionTypeLabel(action.type)}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-sm font-extrabold text-slate-800">
                                                                {action.title || getActionTypeLabel(action.type)}
                                                            </p>
                                                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                                                {action.body}
                                                            </p>
                                                            <div className="pt-2 flex items-start gap-2">
                                                                <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                                                <p className="text-xs text-slate-500 font-medium">
                                                                    {action.reasoning}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 md:pt-1">
                                                            {strategic ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleConsultation(action)}
                                                                    className="h-9 px-4 rounded-full font-bold text-xs gap-2 border-purple-200 text-purple-700 hover:border-purple-500 hover:bg-purple-50 group/btn transition-all"
                                                                >
                                                                    <Phone className="h-3.5 w-3.5" /> Richiedi consulenza
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-9 px-4 rounded-full font-bold text-xs gap-2 border-green-200 text-green-700 hover:border-green-500 hover:bg-green-50 group/btn transition-all"
                                                                >
                                                                    Applica <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
