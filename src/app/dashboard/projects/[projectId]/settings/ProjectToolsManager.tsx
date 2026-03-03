'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, MessageSquare, Settings, Loader2, ArrowRight, Trash2, Pencil, Eye, FolderCog, PlusCircle } from "lucide-react";
import Link from 'next/link';
import { showToast } from '@/components/toast';

interface ToolItem {
    id: string;
    name: string;
    type: 'bot' | 'tracker';
    botType: string | null;
    projectId: string;
    projectName: string | null;
    orgName?: string | null;
}

interface ProjectToolsManagerProps {
    projectId: string;
    projectName: string;
}

export function ProjectToolsManager({ projectId, projectName }: ProjectToolsManagerProps) {
    const [linkedTools, setLinkedTools] = useState<ToolItem[]>([]);
    const [availableTools, setAvailableTools] = useState<ToolItem[]>([]);
    const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [editingBotId, setEditingBotId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        fetchBots();
    }, [projectId]);

    const fetchBots = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/bots?includeAll=true`);
            if (res.ok) {
                const data = await res.json();
                setLinkedTools(data.linkedTools || []);
                setAvailableTools(data.availableTools || []);
                setDefaultProjectId(data.defaultProjectId || null);
            }
        } catch (err) {
            console.error('Error fetching bots:', err);
        } finally {
            setLoading(false);
        }
    };

    const renameTool = async (tool: ToolItem) => {
        if (!editName.trim()) return;
        setActionLoading(tool.id);
        try {
            const url = tool.type === 'bot'
                ? `/api/bots/${tool.id}`
                : `/api/visibility/create`;

            const body = tool.type === 'bot'
                ? { name: editName }
                : { id: tool.id, brandName: editName };

            const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                showToast(tool.type === 'bot' ? 'Bot rinominato' : 'Monitor rinominato');
                setEditingBotId(null);
                fetchBots();
            } else {
                showToast('Errore nel rinominare il tool', 'error');
            }
        } catch (err) {
            showToast('Errore di rete', 'error');
        } finally {
            setActionLoading(null);
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

    const deleteBot = async (tool: ToolItem) => {
        const confirmed = window.confirm(
            `Eliminare definitivamente "${tool.name}"?\n\nQuesta azione cancellerà il bot e tutti i suoi dati (conversazioni, risposte, insight). Non è reversibile.`
        );
        if (!confirmed) return;

        setActionLoading(tool.id);
        try {
            const res = await fetch(`/api/bots/${tool.id}`, { method: 'DELETE' });

            if (res.ok) {
                showToast('Bot eliminato definitivamente');
                fetchBots();
            } else {
                const data = await res.json().catch(() => ({}));
                showToast(data.error || 'Errore durante l\'eliminazione', 'error');
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
        <Card className="border-slate-200">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FolderCog className="w-5 h-5 text-amber-600" />
                            Gestione Tool
                        </CardTitle>
                        <CardDescription>
                            Associa o rimuovi bot e monitor dal progetto corrente
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm font-semibold">
                        {linkedTools.length} tool associati
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tool nel progetto</p>
                        <p className="text-xl font-black text-slate-900">{linkedTools.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tool disponibili</p>
                        <p className="text-xl font-black text-slate-900">{availableTools.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Progetto fallback</p>
                        <p className="text-sm font-semibold text-slate-900">{defaultProjectId ? 'Configurato' : 'Non trovato'}</p>
                    </div>
                </div>

                {/* Linked Bots */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Tool in {projectName}
                    </h4>
                    {linkedTools.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
                            <Bot className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                                Nessun tool associato a questo progetto
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {linkedTools.map(tool => (
                                <div
                                    key={tool.id}
                                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${tool.type === 'tracker' ? 'bg-purple-100 text-purple-600' : tool.botType === 'chatbot' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {tool.type === 'tracker' ? <Eye className="w-4 h-4" /> : getBotIcon(tool.botType)}
                                        </div>
                                        <div>
                                            {editingBotId === tool.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="px-2 py-1 text-sm border rounded"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') renameTool(tool);
                                                            if (e.key === 'Escape') setEditingBotId(null);
                                                        }}
                                                    />
                                                    <Button size="sm" onClick={() => renameTool(tool)} disabled={actionLoading === tool.id}>
                                                        Salva
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="font-medium text-gray-900 line-clamp-1">{tool.name}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight flex items-center gap-1">
                                                        {tool.type === 'tracker' ? 'Monitor Visibilità' : getBotTypeLabel(tool.botType)}
                                                        <span className="text-gray-400">• attivo in questo progetto</span>
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingBotId(tool.id);
                                                setEditName(tool.name);
                                            }}
                                            title="Rinomina"
                                        >
                                            <Pencil size={14} className="text-slate-500" />
                                        </Button>
                                        <Link href={tool.type === 'bot' ? `/dashboard/bots/${tool.id}` : `/dashboard/visibility`}>
                                            <Button variant="ghost" size="sm" title="Impostazioni">
                                                <Settings className="w-4 h-4 text-slate-500" />
                                            </Button>
                                        </Link>
                                        {defaultProjectId && defaultProjectId !== projectId && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => transferBot(tool.id, defaultProjectId)}
                                                disabled={actionLoading === tool.id}
                                                title="Rimuovi dal progetto (sposta nel progetto di default dell'organizzazione)"
                                                className="text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                                            >
                                                {actionLoading === tool.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <ArrowRight className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                        {tool.type === 'bot' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteBot(tool)}
                                                disabled={actionLoading === tool.id}
                                                title="Elimina definitivamente il bot e tutti i suoi dati"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                            >
                                                {actionLoading === tool.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Available Tools (from other projects) */}
                {availableTools.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Altri tool disponibili
                        </h4>
                        <div className="space-y-2">
                            {availableTools.map(tool => (
                                <div
                                    key={tool.id}
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${tool.type === 'tracker' ? 'bg-purple-50 text-purple-400' : tool.botType === 'chatbot' ? 'bg-blue-50 text-blue-400' : 'bg-amber-50 text-amber-400'}`}>
                                            {tool.type === 'tracker' ? <Eye className="w-4 h-4" /> : getBotIcon(tool.botType)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{tool.name}</p>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">
                                                {tool.type === 'tracker' ? 'Monitor Visibilità' : getBotTypeLabel(tool.botType)} •
                                                <span className="text-gray-400 ml-1 font-normal lowercase">
                                                    {tool.orgName || 'Nessun Team'} / {tool.projectName || 'Nessun progetto'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => transferBot(tool.id, projectId)}
                                        disabled={actionLoading === tool.id}
                                        className="gap-1 border-slate-200 bg-white text-xs py-1 h-8 rounded-lg"
                                    >
                                        {actionLoading === tool.id ? (
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
                        <Button variant="outline" className="w-full gap-2 border-amber-200 text-amber-700 hover:bg-amber-50">
                            <PlusCircle className="w-4 h-4" />
                            Nuovo Chatbot
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
