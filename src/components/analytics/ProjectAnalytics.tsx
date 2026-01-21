'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/business-tuner/Card';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    ArrowRight, Sparkles, MessageSquare, Users, Zap,
    Lightbulb, TrendingUp, AlertTriangle, Megaphone, FileText, Bot, Check,
    Mic, Clock, UserPlus, HelpCircle, Hash
} from 'lucide-react';
import { UnifiedInsight, UnifiedStats } from '@/lib/analytics/AnalyticsEngine';

interface ProjectAnalyticsProps {
    projectId: string;
    availableBots: { id: string; name: string; botType: string | null }[];
}

export default function ProjectAnalytics({ projectId, availableBots }: ProjectAnalyticsProps) {
    const [insights, setInsights] = useState<UnifiedInsight[]>([]);
    const [stats, setStats] = useState<UnifiedStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                const queryParams = new URLSearchParams();
                if (selectedBotIds.length > 0) {
                    queryParams.append('botIds', selectedBotIds.join(','));
                }

                const res = await fetch(`/api/projects/${projectId}/analytics?${queryParams.toString()}`);
                if (!res.ok) throw new Error('Failed to fetch analytics');
                const data = await res.json();
                setInsights(data.insights);
                setStats(data.stats);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [projectId, selectedBotIds]);

    const toggleBotFilter = (botId: string) => {
        setSelectedBotIds(prev =>
            prev.includes(botId)
                ? prev.filter(id => id !== botId)
                : [...prev, botId]
        );
    };

    const clearFilters = () => setSelectedBotIds([]);

    if (loading && !stats) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>;
    }

    const {
        avgSentiment, totalMessages, completionRate, trends,
        interviewCount, chatbotCount, avgNpsScore, topThemes, knowledgeGaps, leadsCaptured, avgResponseLength
    } = stats || {
        avgSentiment: 0, totalMessages: 0, completionRate: 0, trends: [],
        interviewCount: 0, chatbotCount: 0, avgNpsScore: null, topThemes: [], knowledgeGaps: [], leadsCaptured: 0, avgResponseLength: 0
    };

    return (
        <div className="space-y-8 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Virtuous Cycle Analytics</h2>
                    <p className="text-gray-500 mt-1">
                        Come le conversazioni (Chatbot) e le interviste (AI Interviewer) si influenzano a vicenda.
                    </p>
                </div>

                {/* Filter Controls */}
                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 font-medium text-gray-700"
                    >
                        <Bot className="w-4 h-4" />
                        Filtra Fonti ({selectedBotIds.length > 0 ? selectedBotIds.length : 'Tutte'})
                        <ArrowRight className={`w-3 h-3 transition-transform ${isFilterOpen ? 'rotate-90' : ''}`} />
                    </button>

                    {isFilterOpen && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-semibold text-sm">Seleziona Fonti</span>
                                {selectedBotIds.length > 0 && (
                                    <button onClick={clearFilters} className="text-xs text-red-600 hover:underline">Reset</button>
                                )}
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {availableBots.map(bot => (
                                    <label key={bot.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedBotIds.includes(bot.id) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                            {selectedBotIds.includes(bot.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedBotIds.includes(bot.id)}
                                            onChange={() => toggleBotFilter(bot.id)}
                                        />
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-medium text-sm truncate">{bot.name}</div>
                                            <div className="text-xs text-gray-500 capitalize">{bot.botType || 'Interview'}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-lg" padding="1.5rem">
                    <div className="flex flex-col gap-2">
                        <div className="text-lg font-medium opacity-90 flex items-center gap-2">
                            <Sparkles className="w-5 h-5" /> Brand Reputation
                        </div>
                        <div className="text-4xl font-bold">{avgSentiment.toFixed(0)}/100</div>
                        <div className="text-sm opacity-80">Sentiment Medio</div>
                    </div>
                </Card>

                <Card padding="1.5rem">
                    <CardHeader
                        title={(
                            <span className="flex items-center gap-2 text-lg">
                                <MessageSquare className="w-5 h-5 text-blue-500" /> Messaggi Totali
                            </span>
                        )}
                        style={{ marginBottom: '0.5rem' }}
                    />
                    <div>
                        <div className="text-3xl font-bold text-gray-900">{totalMessages.toLocaleString()}</div>
                        <div className="text-sm text-gray-500 mt-1">Volume Conversazioni</div>
                    </div>
                </Card>

                <Card padding="1.5rem">
                    <CardHeader
                        title={(
                            <span className="flex items-center gap-2 text-lg">
                                <Users className="w-5 h-5 text-green-500" /> Tasso Completamento
                            </span>
                        )}
                        style={{ marginBottom: '0.5rem' }}
                    />
                    <div>
                        <div className="text-3xl font-bold text-gray-900">{completionRate.toFixed(1)}%</div>
                        <div className="text-sm text-gray-500 mt-1">Engagement Utenti</div>
                    </div>
                </Card>
            </div>

            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="1rem" className="bg-blue-50 border-blue-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Mic className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-blue-900">{interviewCount}</div>
                            <div className="text-xs text-blue-600">Interviste</div>
                        </div>
                    </div>
                </Card>

                <Card padding="1rem" className="bg-green-50 border-green-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-900">{chatbotCount}</div>
                            <div className="text-xs text-green-600">Chat Assistente</div>
                        </div>
                    </div>
                </Card>

                <Card padding="1rem" className="bg-amber-50 border-amber-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <UserPlus className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-amber-900">{leadsCaptured}</div>
                            <div className="text-xs text-amber-600">Lead Acquisiti</div>
                        </div>
                    </div>
                </Card>

                <Card padding="1rem" className="bg-purple-50 border-purple-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Hash className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-purple-900">
                                {avgNpsScore !== null ? avgNpsScore.toFixed(0) : 'N/A'}
                            </div>
                            <div className="text-xs text-purple-600">NPS Medio</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Top Themes & Knowledge Gaps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {topThemes.length > 0 && (
                    <Card padding="1.5rem">
                        <CardHeader
                            title={(
                                <span className="flex items-center gap-2 text-lg">
                                    <TrendingUp className="w-5 h-5 text-purple-500" /> Temi Principali
                                </span>
                            )}
                            style={{ marginBottom: '1rem' }}
                        />
                        <div className="space-y-3">
                            {topThemes.map((theme, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-400">#{idx + 1}</span>
                                        <span className="font-medium text-gray-900">{theme.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500">{theme.count} menzioni</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${theme.sentiment > 0 ? 'bg-green-100 text-green-700' : theme.sentiment < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {theme.sentiment > 0 ? '+' : ''}{(theme.sentiment * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {knowledgeGaps.length > 0 && (
                    <Card padding="1.5rem">
                        <CardHeader
                            title={(
                                <span className="flex items-center gap-2 text-lg">
                                    <HelpCircle className="w-5 h-5 text-orange-500" /> Knowledge Gaps
                                </span>
                            )}
                            subtitle="Domande frequenti senza risposta adeguata"
                            style={{ marginBottom: '1rem' }}
                        />
                        <div className="space-y-2">
                            {knowledgeGaps.map((gap, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-sm text-orange-900">{gap}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </div>

            {/* Response Quality Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card padding="1.5rem" className="bg-gradient-to-br from-slate-50 to-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Lunghezza Media Risposta</div>
                            <div className="text-3xl font-bold text-slate-900">{Math.round(avgResponseLength)}</div>
                            <div className="text-xs text-slate-500">caratteri per messaggio utente</div>
                        </div>
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <Clock className="w-8 h-8 text-slate-400" />
                        </div>
                    </div>
                </Card>

                <Card padding="1.5rem" className="bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-emerald-600 mb-1">Engagement Score</div>
                            <div className="text-3xl font-bold text-emerald-900">
                                {((completionRate * 0.4) + (avgSentiment * 0.4) + (avgResponseLength > 100 ? 20 : avgResponseLength / 5)).toFixed(0)}
                            </div>
                            <div className="text-xs text-emerald-600">indice combinato qualità interazioni</div>
                        </div>
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <Zap className="w-8 h-8 text-emerald-400" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Actionable Insights Section */}
            <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Lightbulb className="w-6 h-6 text-yellow-500" /> Suggerimenti Strategici (AI)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {insights.map((insight, index) => {
                        let Icon = Sparkles;
                        let colorClass = "bg-purple-100 text-purple-700";

                        if (insight.type === 'INTERVIEW_QUESTION') {
                            Icon = MessageSquare;
                            colorClass = "bg-blue-100 text-blue-700";
                        } else if (insight.type === 'KB_UPDATE') {
                            Icon = AlertTriangle;
                            colorClass = "bg-orange-100 text-orange-700";
                        } else if (insight.type === 'AD_CAMPAIGN') {
                            Icon = Megaphone;
                            colorClass = "bg-green-100 text-green-700";
                        } else if (insight.type === 'CONTENT_SUGGESTION') {
                            Icon = FileText;
                            colorClass = "bg-pink-100 text-pink-700";
                        }

                        return (
                            <Card key={index} className="hover:shadow-lg transition-all border-l-4 border-l-purple-500" padding="1.5rem">
                                <div>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-2 rounded-lg ${colorClass}`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                            {insight.source === 'CHATBOT' ? 'Da Chatbot' : 'Da Interviste'}
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-lg mb-2">{insight.title}</h4>
                                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                                        {insight.description}
                                    </p>
                                    <div className="mt-auto pt-4 border-t border-gray-100">
                                        <div className="flex items-center text-xs text-gray-500">
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                            {insight.reasoning}
                                        </div>
                                        <button className="mt-3 w-full py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors flex items-center justify-center gap-1">
                                            Applica Suggerimento <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card padding="1.5rem">
                    <CardHeader
                        title="Trend Sentiment Unificato"
                        subtitle="Andamento della reputazione combinando chat e interviste"
                    />
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="sentiment"
                                    name="Sentiment Score"
                                    stroke="#7C3AED"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#7C3AED" }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card padding="1.5rem">
                    <CardHeader
                        title="Volume Interazioni"
                        subtitle="Traffico gestito giornalmente"
                    />
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="volume" name="Conversazioni" fill="#9333ea" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
}
