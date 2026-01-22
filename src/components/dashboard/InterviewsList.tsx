'use client';

import Link from 'next/link';
import { MessageSquare, Plus, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { BotListItem } from '@/components/dashboard/BotListItem';
import { useProjectData } from '@/hooks/useProjectData';
import { useProject } from '@/contexts/ProjectContext';

interface Conversation {
    id: string;
    status: string;
    completedAt: string | null;
}

interface Interview {
    id: string;
    name: string;
    status: string;
    updatedAt: string;
    botType: string;
    conversations: Conversation[];
    project?: { id: string; name: string } | null;
}

export function InterviewsList() {
    const { selectedProject, isAllProjectsSelected } = useProject();
    const { data: interviews, loading, error } = useProjectData<Interview[]>({
        endpoint: 'bots',
        queryParams: { type: 'interview' }
    });

    if (loading) {
        return (
            <div className="space-y-4">
                {/* Stats Cards Skeleton */}
                <div className="grid md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-200 rounded-lg w-9 h-9" />
                                <div>
                                    <div className="h-6 w-12 bg-gray-200 rounded mb-1" />
                                    <div className="h-4 w-24 bg-gray-100 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {/* List Skeleton */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="h-5 w-32 bg-gray-200 rounded" />
                    </div>
                    <div className="divide-y divide-gray-100">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-4 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                                    <div className="flex-1">
                                        <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
                                        <div className="h-3 w-32 bg-gray-100 rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600">Errore nel caricamento delle interviste: {error}</p>
            </div>
        );
    }

    const allBots = interviews || [];

    // Calculate stats
    const totalInterviews = allBots.length;
    const totalResponses = allBots.reduce((sum, bot) => sum + bot.conversations.length, 0);
    const completedResponses = allBots.reduce((sum, bot) =>
        sum + bot.conversations.filter((c) => c.status === 'COMPLETED').length, 0
    );

    return (
        <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalInterviews}</p>
                            <p className="text-sm text-gray-500">Interviste attive</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalResponses}</p>
                            <p className="text-sm text-gray-500">Risposte totali</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{completedResponses}</p>
                            <p className="text-sm text-gray-500">Completate</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interviews List */}
            {allBots.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {isAllProjectsSelected
                            ? 'Nessuna intervista in nessun progetto'
                            : 'Nessuna intervista in questo progetto'
                        }
                    </h3>
                    <p className="text-gray-500 mb-6">Crea la tua prima intervista in meno di 5 minuti</p>
                    <Link
                        href="/onboarding"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Crea la tua prima intervista
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="font-semibold text-gray-900">
                            {isAllProjectsSelected ? 'Tutte le interviste' : `Interviste del progetto`}
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {allBots.map((bot) => (
                            <BotListItem
                                key={bot.id}
                                bot={{
                                    ...bot,
                                    conversations: bot.conversations.map((c) => ({
                                        ...c,
                                        completedAt: c.completedAt || null
                                    }))
                                }}
                                showProject={isAllProjectsSelected}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
