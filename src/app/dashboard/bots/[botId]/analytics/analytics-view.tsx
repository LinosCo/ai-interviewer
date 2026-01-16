'use client';

import Link from 'next/link';
import { generateBotAnalyticsAction } from '@/app/actions';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, Quote, TrendingUp, Sparkles, MessageSquare, BrainCircuit, ExternalLink, ChevronDown } from 'lucide-react';

export default function AnalyticsView({ bot, themes, insights }: any) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Filter Insights by type
    const strategicInsights = insights.filter((i: any) => !i.type || i.type === 'STRATEGIC');
    const goldenQuotes = insights.filter((i: any) => i.type === 'QUOTE');

    // Sentiment Score from metadata
    const sentimentScore = bot.analyticsMetadata?.sentimentScore || 0;
    const hasMetadata = !!bot.analyticsMetadata;

    // Prepare Chart Data (Last 20 conversations)
    // Create a copy to reverse without mutating original prop if strict mode
    const chartData = [...bot.conversations]
        .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 20)
        .reverse()
        .map((c: any) => ({
            name: `#${c.id.slice(-4)}`,
            messages: c.messages ? c.messages.filter((m: any) => m.role === 'user').length : 0,
            date: new Date(c.startedAt).toLocaleDateString()
        }));

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            await generateBotAnalyticsAction(bot.id);
        } catch (e: any) {
            alert("Analysis failed: " + e.message);
        } finally {
            setIsAnalyzing(false);
            window.location.reload();
        }
    };

    const handleExportCSV = () => {
        const headers = ["ID", "Date", "Status", "User Messages", "Duration (min)", "Transcript"];
        const rows = bot.conversations.map((c: any) => {
            const msgs = c.messages ? c.messages.map((m: any) => `[${m.role}]: ${m.content}`).join(" | ") : "";
            return [
                c.id,
                new Date(c.startedAt).toISOString(),
                c.status,
                c.messages ? c.messages.filter((m: any) => m.role === 'user').length : 0,
                c.durationSeconds ? (c.durationSeconds / 60).toFixed(1) : '0',
                `"${msgs.replace(/"/g, '""')}"` // Escape quotes for CSV
            ].join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${bot.name.replace(/\s+/g, '_')}_transcripts.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8">
            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded shadow gap-4">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-amber-600" />
                        AI Deep Insights
                    </h2>
                    <p className="text-sm text-gray-500">
                        {hasMetadata
                            ? `Last analyzed: ${new Date(bot.analyticsMetadata.lastAnalyzed).toLocaleDateString()}`
                            : "Run analysis to generate themes, sentiment, and quotes."}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportCSV}
                        className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={handleRunAnalysis}
                        disabled={isAnalyzing}
                        className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                        {isAnalyzing ? (
                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Run AI Analysis
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Visual Analytics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Sentiment Score */}
                <div className="bg-white p-6 rounded shadow md:col-span-1 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 absolute top-6 left-6">
                        Overall Sentiment
                    </h3>
                    <div className="mt-8 relative">
                        <svg className="w-32 h-32 transform -rotate-90">
                            <circle
                                cx="64" cy="64" r="56"
                                stroke="#f3f4f6" strokeWidth="12" fill="transparent"
                            />
                            <circle
                                cx="64" cy="64" r="56"
                                stroke={sentimentScore > 70 ? "#10b981" : sentimentScore > 40 ? "#fbbf24" : "#ef4444"}
                                strokeWidth="12" fill="transparent"
                                strokeDasharray={351}
                                strokeDashoffset={351 - (351 * sentimentScore) / 100}
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-3xl font-bold text-gray-800">{sentimentScore}</span>
                            <span className="text-xs text-gray-400 block">/ 100</span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                        {sentimentScore > 70 ? "Excellent user reception" : sentimentScore > 40 ? "Mixed feedback" : "Negative feedback detected"}
                    </p>
                </div>

                {/* Engagement Chart */}
                <div className="bg-white p-6 rounded shadow md:col-span-2 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Engagement (User Messages per Session)
                    </h3>
                    <div className="flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Bar dataKey="messages" name="Messages" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Qualitative Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Golden Quotes - New Feature */}
                <div className="bg-white p-6 rounded shadow lg:col-span-1">
                    <h3 className="font-semibold mb-4 text-amber-600 flex items-center gap-2">
                        <Quote className="w-5 h-5" />
                        Golden Quotes
                    </h3>
                    {goldenQuotes.length === 0 ? (
                        <p className="text-gray-400 text-sm">No quotes extracted yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {goldenQuotes.map((q: any) => {
                                const citation = q.citations?.[0]; // Access first citation
                                return (
                                    <div key={q.id} className="relative italic text-gray-700 bg-amber-50 p-4 rounded-lg border border-amber-100 text-sm group">
                                        <span className="absolute top-2 left-2 text-amber-200 text-2xl font-serif">“</span>
                                        <span className="relative z-10 px-2 block mb-2">{q.content}</span>
                                        {citation?.conversationId && (
                                            <div className="flex justify-end mt-2">
                                                <Link
                                                    href={`/dashboard/bots/${bot.id}/conversations/${citation.conversationId}`}
                                                    className="inline-flex items-center text-xs text-amber-600 hover:text-amber-800 font-medium opacity-80 hover:opacity-100 transition-opacity"
                                                >
                                                    View Context <ExternalLink className="w-3 h-3 ml-1" />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Key Themes */}
                <div className="bg-white p-6 rounded shadow lg:col-span-1">
                    <h3 className="font-semibold mb-4 text-amber-800 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Key Themes
                    </h3>
                    {themes.length === 0 ? (
                        <p className="text-gray-400 text-sm">No themes identified yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {themes.map((theme: any) => (
                                <details key={theme.id} className="border-b last:border-0 border-gray-100 group">
                                    <summary className="cursor-pointer list-none py-3 flex justify-between items-start outline-none">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-gray-800 text-sm">{theme.name}</span>
                                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                                    {theme.occurrences.length}x
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 leading-relaxed">{theme.description}</p>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-gray-400 transform group-open:rotate-180 transition-transform mt-1" />
                                    </summary>

                                    <div className="pl-4 pb-3 space-y-2 mt-1 border-l-2 border-amber-100 bg-gray-50/50 p-3 rounded-r text-xs">
                                        <p className="font-semibold text-gray-500 text-xs uppercase tracking-wide">Evidence:</p>
                                        {theme.occurrences.map((occ: any, idx: number) => (
                                            <div key={idx} className="bg-white p-2 rounded border border-gray-100 shadow-sm relative">
                                                <p className="italic text-gray-600 mb-1">"{occ.snippet}"</p>
                                                {occ.conversationId !== 'unknown' && (
                                                    <Link
                                                        href={`/dashboard/bots/${bot.id}/conversations/${occ.conversationId}`}
                                                        className="text-amber-600 hover:underline inline-flex items-center gap-1 mt-1"
                                                    >
                                                        Review source <ExternalLink className="w-3 h-3" />
                                                    </Link>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}
                </div>

                {/* Strategic Insights */}
                <div className="bg-white p-6 rounded shadow lg:col-span-1">
                    <h3 className="font-semibold mb-4 text-amber-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        Strategic Suggestions
                    </h3>
                    {strategicInsights.length === 0 ? (
                        <p className="text-gray-400 text-sm">No insights generated yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {strategicInsights.map((insight: any) => {
                                const citations = insight.citations as any[];
                                return (
                                    <details key={insight.id} className="text-sm text-gray-700 bg-amber-50 rounded border border-amber-100 group">
                                        <summary className="p-3 cursor-pointer list-none flex justify-between items-start gap-2 outline-none">
                                            <span>{insight.content}</span>
                                            {citations && citations.length > 0 && (
                                                <ChevronDown className="w-4 h-4 text-amber-400 transform group-open:rotate-180 transition-transform flex-shrink-0 mt-0.5" />
                                            )}
                                        </summary>
                                        {citations && citations.length > 0 && (
                                            <div className="px-3 pb-3 pt-0 border-t border-amber-100/50 mt-2">
                                                <p className="font-semibold text-amber-800/60 text-xs uppercase tracking-wide mt-2 mb-1">Basis:</p>
                                                <ul className="space-y-2">
                                                    {citations.map((c: any, idx: number) => (
                                                        <li key={idx} className="text-xs bg-white/60 p-2 rounded">
                                                            <span className="italic">"{c.quote}"</span>
                                                            {c.conversationId && (
                                                                <Link
                                                                    href={`/dashboard/bots/${bot.id}/conversations/${c.conversationId}`}
                                                                    className="block text-amber-600 hover:text-amber-800 mt-1 flex items-center gap-1"
                                                                >
                                                                    View in context <ExternalLink className="w-3 h-3" />
                                                                </Link>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </details>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* Topic Deep Dive - Word Clouds */}
            < div className="bg-white p-6 rounded shadow" >
                <h3 className="font-semibold mb-6 flex items-center gap-2 text-gray-800">
                    <BrainCircuit className="w-5 h-5 text-amber-600" />
                    Topic Analysis & Word Clouds
                </h3>

                {
                    !bot.topics || bot.topics.length === 0 ? (
                        <p className="text-gray-400 text-sm">No topic analysis available.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {bot.topics.map((topic: any) => (
                                <div key={topic.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-medium text-gray-800">{topic.label}</h4>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{topic.description}</p>
                                        </div>
                                        <span className="text-xs font-mono bg-amber-50 text-amber-700 px-2 py-1 rounded">
                                            #{topic.orderIndex + 1}
                                        </span>
                                    </div>

                                    <div className="bg-white rounded border border-gray-100 p-4 min-h-[120px] flex flex-wrap gap-2 items-center content-start">
                                        {topic.keywords && Array.isArray(topic.keywords) && topic.keywords.length > 0 ? (
                                            topic.keywords.map((kw: any, idx: number) => {
                                                // Simple size scaling based on count relative to max count in this set
                                                const maxCount = Math.max(...topic.keywords.map((k: any) => k.count || 1));
                                                const sizeClass =
                                                    kw.count === maxCount ? "text-lg font-bold text-amber-700" :
                                                        kw.count > maxCount * 0.6 ? "text-base font-semibold text-amber-600" :
                                                            "text-xs text-gray-500";

                                                return (
                                                    <span key={idx} className={`${sizeClass} px-2 py-1 bg-gray-50 rounded-full border border-gray-100`}>
                                                        {kw.word}
                                                        <span className="ml-1 text-[10px] opacity-50">{kw.count}</span>
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <p className="text-xs text-gray-400 italic w-full text-center py-4">
                                                No keywords extracted yet. Run analysis to populate.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                }
            </div >

            {/* Recent Sessions & Transcripts */}
            <div className="bg-white p-6 rounded shadow">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                        <MessageSquare className="w-5 h-5 text-amber-600" />
                        Recent Sessions & Transcripts
                    </h3>
                    <Link
                        href={`/dashboard/bots/${bot.id}/profiles`}
                        className="text-sm text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1"
                    >
                        View All Collected Profiles <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Messages</th>
                                <th className="px-4 py-3">Duration</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {bot.conversations && bot.conversations.length > 0 ? (
                                bot.conversations.slice(0, 10).map((c: any) => (
                                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {new Date(c.startedAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${c.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {c.messages?.filter((m: any) => m.role === 'user').length || 0} user msgs
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={`/dashboard/bots/${bot.id}/conversations/${c.id}`}
                                                className="bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 text-xs inline-flex items-center gap-1"
                                            >
                                                View Transcript <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center italic text-gray-400">
                                        No sessions recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
