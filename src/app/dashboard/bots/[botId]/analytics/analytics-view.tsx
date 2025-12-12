'use client';

import { generateBotAnalyticsAction } from '@/app/actions';
import { useState } from 'react';

export default function AnalyticsView({ bot, themes, insights }: any) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            await generateBotAnalyticsAction(bot.id);
        } catch (e: any) {
            alert("Analysis failed: " + e.message);
        } finally {
            setIsAnalyzing(false);
            // In a real app we'd trigger a refresh or use optimistic updates. 
            // For now, reload to see new data.
            window.location.reload();
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-white p-6 rounded shadow">
                <div>
                    <h2 className="text-lg font-bold">Deep Insights</h2>
                    <p className="text-sm text-gray-500">AI-powered analysis of all completed conversations.</p>
                </div>
                <button
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzing}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {isAnalyzing ? (
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                        <span>✨ Run AI Analysis</span>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Themes */}
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="font-semibold mb-4 text-purple-800">Key Themes & Keywords</h3>
                    {themes.length === 0 ? (
                        <p className="text-gray-400 text-sm">No themes identified yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {themes.map((theme: any) => (
                                <div key={theme.id} className="border-b pb-3 last:border-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-medium text-gray-800">{theme.name}</span>
                                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                                            {theme.occurrences.length} occurrences
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600">{theme.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Insights / Suggestions */}
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="font-semibold mb-4 text-blue-800">Strategic Insights</h3>
                    {insights.length === 0 ? (
                        <p className="text-gray-400 text-sm">No insights generated yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {insights.map((insight: any) => (
                                <li key={insight.id} className="flex gap-3 text-sm text-gray-700 p-3 bg-blue-50 rounded">
                                    <span className="text-blue-500">💡</span>
                                    {insight.content}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
