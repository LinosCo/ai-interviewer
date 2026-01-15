'use client';

import { useState } from "react";
import { updateInsightStatus } from "./actions";
import { Loader2, CheckCircle, Clock, Archive } from "lucide-react";

interface InsightCardProps {
    insight: any;
}

export default function InsightCard({ insight }: InsightCardProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleStatus = async (status: string) => {
        setIsLoading(true);
        try {
            await updateInsightStatus(insight.id, status);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${insight.priorityScore > 80 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                            {Math.round(insight.priorityScore)} Impact
                        </span>
                        <h3 className="font-semibold text-slate-800 text-lg">{insight.topicName}</h3>
                    </div>
                    <p className="text-sm text-slate-500">
                        Sources: {Array.isArray(insight.sources) ? insight.sources.join(", ") : "Unified"}
                    </p>
                </div>
                {/* Workflow Badge */}
                <span className="text-xs font-mono uppercase text-slate-400 border px-2 py-1 rounded">
                    {insight.status}
                </span>
            </div>

            {/* Suggested Actions */}
            <div className="bg-indigo-50 border border-indigo-100 rounded p-3 text-sm">
                <p className="font-medium text-indigo-900 mb-2">Suggested Actions:</p>
                <ul className="list-disc list-inside space-y-1 text-indigo-800">
                    {Array.isArray(insight.suggestedActions) && insight.suggestedActions.map((act: any, idx: number) => (
                        <li key={idx}>{act.action || act}</li>
                    ))}
                </ul>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4 text-xs text-slate-500 pt-2 border-t border-slate-50">
                {insight.visibilityData && (
                    <div>
                        <span className="block font-medium text-slate-700">Visibility</span>
                        Rank: #{insight.visibilityData?.rank || '-'}
                    </div>
                )}
                {insight.chatbotData && (
                    <div>
                        <span className="block font-medium text-slate-700">Chatbot</span>
                        Unanswered: {insight.chatbotData?.unanswered || 0}
                    </div>
                )}
                {/* Add more metrics as needed */}
            </div>

            {/* Controls */}
            <div className="flex justify-end gap-2 pt-2">
                {insight.status === 'new' && (
                    <button
                        onClick={() => handleStatus('reviewing')}
                        disabled={isLoading}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                    >
                        <Clock className="w-3 h-3" /> Mark Reviewing
                    </button>
                )}
                <button
                    onClick={() => handleStatus('dismissed')}
                    disabled={isLoading}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 text-slate-400 hover:text-slate-600"
                >
                    <Archive className="w-3 h-3" /> Dismiss
                </button>
                <button
                    onClick={() => handleStatus('actioned')}
                    disabled={isLoading}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm"
                >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    Mark Actioned
                </button>
            </div>
        </div>
    );
}
