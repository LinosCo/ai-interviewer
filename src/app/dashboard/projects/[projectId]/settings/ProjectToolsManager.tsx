'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare, Settings, Loader2, ArrowRight } from "lucide-react";
import Link from 'next/link';
import { showToast } from '@/components/toast';

interface BotItem {
    id: string;
    name: string;
    botType: string | null;
    projectId: string;
    projectName: string | null;
}

interface ProjectToolsManagerProps {
    projectId: string;
    projectName: string;
}

export function ProjectToolsManager({ projectId, projectName }: ProjectToolsManagerProps) {
    const [linkedBots, setLinkedBots] = useState<BotItem[]>([]);
    const [availableBots, setAvailableBots] = useState<BotItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchBots();
    }, [projectId]);

    const fetchBots = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/bots?includeAll=true`);
            if (res.ok) {
                const data = await res.json();
                setLinkedBots(data.linkedBots || []);
                setAvailableBots(data.availableBots || []);
            }
        } catch (err) {
            console.error('Error fetching bots:', err);
        } finally {
            setLoading(false);
        }
    };

    const transferBot = async (botId: string, toProjectId: string) => {
        setActionLoading(botId);
        try {
            const res = await fetch(`/api/projects/${projectId}/bots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ botId, targetProjectId: toProjectId })
            });

            if (res.ok) {
                showToast(toProjectId === projectId ? 'Bot associato al progetto' : 'Bot rimosso dal progetto');
                fetchBots();
            } else {
                const data = await res.json();
                showToast(data.error || 'Errore nel trasferimento', 'error');
            }
        } catch (err) {
            showToast('Errore di rete', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Caricamento tool...
                    </div>
                </CardContent>
            </Card>
        );
    }

    const getBotIcon = (botType: string | null) => {
        if (botType === 'chatbot') return <Bot className="w-4 h-4" />;
        return <MessageSquare className="w-4 h-4" />;
    };

    const getBotTypeLabel = (botType: string | null) => {
        if (botType === 'chatbot') return 'Chatbot';
        return 'Intervista';
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-blue-600" />
                            Gestione Tool
                        </CardTitle>
                        <CardDescription>
                            Associa o rimuovi interviste e chatbot da questo progetto
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm">
                        {linkedBots.length} tool associati
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Linked Bots */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Tool in {projectName}
                    </h4>
                    {linkedBots.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
                            <Bot className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                                Nessun tool associato a questo progetto
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {linkedBots.map(bot => (
                                <div
                                    key={bot.id}
                                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${bot.botType === 'chatbot' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {getBotIcon(bot.botType)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{bot.name}</p>
                                            <p className="text-xs text-gray-500">{getBotTypeLabel(bot.botType)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link href={`/dashboard/bots/${bot.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <Settings className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Available Bots (from other projects) */}
                {availableBots.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Altri tool disponibili
                        </h4>
                        <div className="space-y-2">
                            {availableBots.map(bot => (
                                <div
                                    key={bot.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${bot.botType === 'chatbot' ? 'bg-blue-50 text-blue-400' : 'bg-amber-50 text-amber-400'}`}>
                                            {getBotIcon(bot.botType)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{bot.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {getBotTypeLabel(bot.botType)} •
                                                <span className="text-gray-400 ml-1">
                                                    in: {bot.projectName || 'Progetto personale'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => transferBot(bot.id, projectId)}
                                        disabled={actionLoading === bot.id}
                                        className="gap-1"
                                    >
                                        {actionLoading === bot.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <ArrowRight className="w-4 h-4" />
                                                Sposta qui
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Create new chatbot */}
                <div className="pt-4 border-t">
                    <Link href={`/dashboard/bots/create-chatbot?projectId=${projectId}`}>
                        <Button variant="outline" className="w-full gap-2">
                            <Bot className="w-4 h-4" />
                            Nuovo Chatbot
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
