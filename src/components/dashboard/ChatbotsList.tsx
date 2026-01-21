'use client';

import Link from 'next/link';
import { Bot, Plus, ArrowRight, Code } from 'lucide-react';
import { BotStatusToggle } from '@/components/dashboard/BotStatusToggle';
import { useProjectData } from '@/hooks/useProjectData';
import { useProject } from '@/contexts/ProjectContext';

interface Conversation {
    id: string;
    status: string;
    completedAt: string | null;
    candidateProfile: any;
}

interface ChatBot {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    conversations: Conversation[];
}

export function ChatbotsList() {
    const { selectedProject } = useProject();
    const { data: bots, loading, error } = useProjectData<ChatBot[]>({
        endpoint: 'bots',
        queryParams: { type: 'chatbot' }
    });

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                            <div>
                                <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                                <div className="h-3 w-24 bg-gray-100 rounded" />
                            </div>
                        </div>
                        <div className="h-10 bg-gray-100 rounded mb-4" />
                        <div className="h-8 bg-gray-50 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600">Errore nel caricamento dei chatbot: {error}</p>
            </div>
        );
    }

    if (!bots || bots.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun chatbot in questo progetto</h3>
                <p className="text-gray-500 mb-6">Crea il tuo primo assistente AI da integrare nel tuo sito</p>
                <Link
                    href="/dashboard/bots/create-chatbot"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Crea Chatbot
                </Link>
            </div>
        );
    }

    return (
        <div className="grid md:grid-cols-2 gap-4">
            {bots.map((bot) => {
                const totalConversations = bot.conversations.length;

                return (
                    <div
                        key={bot.id}
                        className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow relative"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                                    style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #C026D3 100%)' }}
                                >
                                    <Bot className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{bot.name}</h3>
                                    <p className="text-xs text-gray-500">
                                        Creato il {new Date(bot.createdAt).toLocaleDateString('it-IT')}
                                    </p>
                                </div>
                            </div>
                            <BotStatusToggle botId={bot.id} initialStatus={bot.status} />
                        </div>

                        <p className="text-sm text-gray-600 mb-6 line-clamp-2 min-h-[40px]">
                            {bot.description || "Assistente AI configurato per rispondere alle domande sul tuo sito."}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <div className="flex gap-4 text-sm text-gray-500">
                                <span><strong>{totalConversations}</strong> conversazioni</span>
                            </div>

                            <div className="flex gap-2">
                                <Link
                                    href={`/dashboard/bots/${bot.id}/embed`}
                                    className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    title="Codice Embed"
                                >
                                    <Code className="w-4 h-4" />
                                </Link>
                                <Link
                                    href={`/dashboard/bots/${bot.id}`}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    Gestisci
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
