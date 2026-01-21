'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { showToast } from '@/components/toast';
import {
    Edit2, Save, X, Users, Briefcase, MessageSquare, Bot, Eye,
    ChevronDown, ChevronUp
} from 'lucide-react';

interface OrganizationData {
    id: string;
    name: string;
    plan: string;
    subscription: {
        status: string;
        interviewsUsedThisMonth: number;
    } | null;
    _count: {
        members: number;
        projects: number;
    };
    botCount: number;
    visibilityCount: number;
    customLimits?: {
        maxInterviews?: number;
        maxChatbots?: number;
        maxProjects?: number;
    };
}

interface AdminOrgCardProps {
    org: OrganizationData;
}

export function AdminOrgCard({ org }: AdminOrgCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [limits, setLimits] = useState({
        maxInterviews: org.customLimits?.maxInterviews || 0,
        maxChatbots: org.customLimits?.maxChatbots || 0,
        maxProjects: org.customLimits?.maxProjects || 0,
        plan: org.plan
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/organizations/${org.id}/limits`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(limits)
            });

            if (res.ok) {
                showToast('Limiti aggiornati con successo');
                setIsEditing(false);
            } else {
                const data = await res.json();
                showToast(data.error || 'Errore durante il salvataggio', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Errore di rete', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const planColors: Record<string, string> = {
        'BUSINESS': 'bg-purple-100 text-purple-800',
        'PRO': 'bg-blue-100 text-blue-800',
        'STARTER': 'bg-green-100 text-green-800',
        'FREE': 'bg-gray-100 text-gray-800',
        'TRIAL': 'bg-amber-100 text-amber-800',
        'PARTNER': 'bg-pink-100 text-pink-800'
    };

    return (
        <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-semibold">{org.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{org.id}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isEditing ? (
                        <select
                            value={limits.plan}
                            onChange={(e) => setLimits(prev => ({ ...prev, plan: e.target.value }))}
                            className="px-2 py-1 rounded text-xs font-bold border border-gray-300"
                        >
                            <option value="FREE">FREE</option>
                            <option value="STARTER">STARTER</option>
                            <option value="PRO">PRO</option>
                            <option value="BUSINESS">BUSINESS</option>
                            <option value="PARTNER">PARTNER</option>
                        </select>
                    ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${planColors[org.plan] || 'bg-gray-100 text-gray-800'}`}>
                            {org.plan}
                        </span>
                    )}
                    <span className={`text-xs ${org.subscription?.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                        {org.subscription?.status || 'N/A'}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs">Interviste</span>
                    </div>
                    <p className="font-bold text-lg text-blue-900">{org.subscription?.interviewsUsedThisMonth || 0}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                        <Bot className="w-4 h-4" />
                        <span className="text-xs">Bot</span>
                    </div>
                    <p className="font-bold text-lg text-green-900">{org.botCount}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-600 mb-1">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs">Visibility</span>
                    </div>
                    <p className="font-bold text-lg text-purple-900">{org.visibilityCount}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-600 mb-1">
                        <Users className="w-4 h-4" />
                        <span className="text-xs">Utenti</span>
                    </div>
                    <p className="font-bold text-lg text-amber-900">{org._count.members}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 text-slate-600 mb-1">
                        <Briefcase className="w-4 h-4" />
                        <span className="text-xs">Progetti</span>
                    </div>
                    <p className="font-bold text-lg text-slate-900">{org._count.projects}</p>
                </div>
            </div>

            {/* Expandable Section */}
            <div className="mt-4 pt-4 border-t">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isExpanded ? 'Nascondi dettagli' : 'Mostra dettagli e modifica limiti'}
                </button>

                {isExpanded && (
                    <div className="mt-4 space-y-4">
                        {/* Custom Limits Editor */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-medium text-gray-900">Limiti Personalizzati</h4>
                                {!isEditing ? (
                                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                        <Edit2 className="w-4 h-4 mr-1" /> Modifica
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsEditing(false)}
                                            disabled={isSaving}
                                        >
                                            <X className="w-4 h-4 mr-1" /> Annulla
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSave}
                                            disabled={isSaving}
                                        >
                                            <Save className="w-4 h-4 mr-1" />
                                            {isSaving ? 'Salvataggio...' : 'Salva'}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Max Interviste/Mese</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={limits.maxInterviews}
                                            onChange={(e) => setLimits(prev => ({ ...prev, maxInterviews: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            placeholder="0 = usa default piano"
                                        />
                                    ) : (
                                        <p className="text-lg font-semibold">
                                            {limits.maxInterviews || <span className="text-gray-400">Default</span>}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Max Chatbot</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={limits.maxChatbots}
                                            onChange={(e) => setLimits(prev => ({ ...prev, maxChatbots: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            placeholder="0 = usa default piano"
                                        />
                                    ) : (
                                        <p className="text-lg font-semibold">
                                            {limits.maxChatbots || <span className="text-gray-400">Default</span>}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Max Progetti</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={limits.maxProjects}
                                            onChange={(e) => setLimits(prev => ({ ...prev, maxProjects: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            placeholder="0 = usa default piano"
                                        />
                                    ) : (
                                        <p className="text-lg font-semibold">
                                            {limits.maxProjects || <span className="text-gray-400">Default</span>}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-3">
                                I limiti personalizzati sovrascrivono quelli del piano. Imposta 0 per usare i valori di default.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
