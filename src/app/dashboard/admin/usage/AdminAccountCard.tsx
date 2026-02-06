'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { showToast } from '@/components/toast';
import { PLANS, PlanType } from '@/config/plans';
import {
    ChevronDown, ChevronUp, AlertTriangle, User, Link2, FolderKanban, Zap, Building2,
    Bot, Eye, Users, Edit2, X, Save
} from 'lucide-react';
import type { AccountData } from './page';

// Interface moved to page.tsx to avoid duplication

interface AdminAccountCardProps {
    account: AccountData;
}

function UsageBar({ used, limit, extra = 0, label, color }: {
    used: number;
    limit: number;
    extra?: number;
    label: string;
    color: string;
}) {
    const totalLimit = limit === -1 ? -1 : limit + extra;
    const percentage = totalLimit === -1 ? 0 : Math.min(100, Math.round((used / totalLimit) * 100));
    const isOverLimit = totalLimit !== -1 && used > totalLimit;
    const isNearLimit = percentage >= 80;

    const formatNumber = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toString();
    };

    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{label}</span>
                <span className={`font-semibold ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-gray-900'}`}>
                    {formatNumber(used)} / {totalLimit === -1 ? '∞' : formatNumber(totalLimit)}
                    {extra > 0 && <span className="text-xs text-green-600 ml-1">(+{formatNumber(extra)})</span>}
                </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : color}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
            {isOverLimit && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    Limite superato!
                </div>
            )}
        </div>
    );
}

export function AdminAccountCard({ account }: AdminAccountCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const sub = account.subscription;
    const planConfig = PLANS[(sub?.tier || 'FREE') as PlanType] || PLANS[PlanType.FREE];
    const creditsLimit = Number(account.monthlyCreditsLimit);
    const copilotAndTipsCredits = account.creditUsageByTool.copilot + account.creditUsageByTool.ai_tips;

    const [editLimits, setEditLimits] = useState({
        extraTokens: sub?.extraTokens || 0,
        extraInterviews: sub?.extraInterviews || 0,
        extraChatbotSessions: sub?.extraChatbotSessions || 0,
        plan: sub?.tier || account.plan,
        monthlyCreditsLimit: Number(account.monthlyCreditsLimit)
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/organizations/${account.id}/limits`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editLimits)
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

    const formatNumber = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toString();
    };

    const planColors: Record<string, string> = {
        'BUSINESS': 'bg-purple-100 text-purple-800',
        'PRO': 'bg-blue-100 text-blue-800',
        'STARTER': 'bg-green-100 text-green-800',
        'FREE': 'bg-gray-100 text-gray-800',
        'TRIAL': 'bg-amber-100 text-amber-800',
        'PARTNER': 'bg-pink-100 text-pink-800',
        'ADMIN': 'bg-red-100 text-red-800'
    };

    const statusColors: Record<string, string> = {
        'ACTIVE': 'text-green-600',
        'TRIALING': 'text-amber-600',
        'PAST_DUE': 'text-red-600',
        'CANCELED': 'text-gray-500'
    };

    return (
        <Card className="p-6">
            {/* Organization Info */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900">{account.name}</h3>
                    </div>
                    {account.owner && (
                        <div className="space-y-1">
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                <User className="w-3 h-3" /> Owner: {account.owner.name || 'Senza nome'} ({account.owner.email})
                            </p>
                        </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                        ID: <span className="font-mono">{account.id}</span>
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isEditing ? (
                        <select
                            value={editLimits.plan}
                            onChange={(e) => {
                                const nextPlan = e.target.value as PlanType;
                                const planConfig = PLANS[nextPlan] || PLANS[PlanType.FREE];
                                setEditLimits(prev => ({
                                    ...prev,
                                    plan: nextPlan,
                                    monthlyCreditsLimit: planConfig.monthlyCredits
                                }));
                            }}
                            className="px-2 py-1 rounded text-xs font-bold border border-gray-300"
                        >
                            <option value="FREE">FREE</option>
                            <option value="TRIAL">TRIAL</option>
                            <option value="STARTER">STARTER</option>
                            <option value="PRO">PRO</option>
                            <option value="BUSINESS">BUSINESS</option>
                            <option value="PARTNER">PARTNER</option>
                        </select>
                    ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${planColors[sub?.tier || account.plan] || 'bg-gray-100 text-gray-800'}`}>
                            {sub?.tier || account.plan}
                        </span>
                    )}
                    <span className={`text-xs font-medium ${statusColors[sub?.status || ''] || 'text-gray-500'}`}>
                        {sub?.status || 'NO_SUBSCRIPTION'}
                    </span>
                </div>
            </div>

            {/* Credit Status (New System) */}
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-violet-600" />
                    <span className="font-semibold text-violet-900">Crediti Organizzazione</span>
                </div>
                <UsageBar
                    used={Number(account.monthlyCreditsUsed)}
                    limit={Number(account.monthlyCreditsLimit)}
                    label="Crediti Mensili"
                    color="bg-violet-500"
                />
                {account.packCreditsAvailable > BigInt(0) && (
                    <p className="text-xs text-violet-600 mt-2">
                        + {formatNumber(Number(account.packCreditsAvailable))} crediti da pack
                    </p>
                )}
                {account.creditsResetDate && (
                    <p className="text-xs text-gray-500 mt-1">
                        Reset: {new Date(account.creditsResetDate).toLocaleDateString('it-IT')}
                    </p>
                )}
            </div>

            {/* Usage Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <UsageBar
                    used={account.creditUsageByTool.interview}
                    limit={creditsLimit}
                    label="Interviste AI (crediti)"
                    color="bg-violet-500"
                />
                <UsageBar
                    used={account.creditUsageByTool.chatbot}
                    limit={creditsLimit}
                    label="Chatbot (crediti)"
                    color="bg-amber-500"
                />
                <UsageBar
                    used={account.creditUsageByTool.visibility}
                    limit={creditsLimit}
                    label="Visibility (crediti)"
                    color="bg-blue-500"
                />
                <UsageBar
                    used={copilotAndTipsCredits}
                    limit={creditsLimit}
                    label="Copilot + AI Tips (crediti)"
                    color="bg-emerald-500"
                />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-5 gap-3 text-sm mb-4">
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <FolderKanban className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{account._count.projects}</p>
                    <p className="text-xs text-gray-500">Progetti</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <Bot className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{account.botCount}</p>
                    <p className="text-xs text-gray-500">Bot</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <Eye className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{account.visibilityCount}</p>
                    <p className="text-xs text-gray-500">Brand</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <Link2 className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{account.hasCMS ? '1' : '0'}</p>
                    <p className="text-xs text-gray-500">CMS</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <Users className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{account._count.members}</p>
                    <p className="text-xs text-gray-500">Membri</p>
                </div>
            </div>

            {/* Projects List */}
            {account.projects.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">Progetti ({account.projects.length})</p>
                    <div className="space-y-2">
                        {account.projects.map(project => (
                            <div key={project.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <FolderKanban className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium">{project.name}</span>
                                    {project.isPersonal && (
                                        <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Personale</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {project.owner?.name || project.owner?.email || 'N/A'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Bot className="w-3 h-3" />
                                        {project._count.bots} bot
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Token Breakdown (mini) */}
            {account.creditUsageByTool.total > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">Breakdown Crediti (mese corrente)</p>
                    <div className="flex gap-2 text-xs flex-wrap">
                        {account.creditUsageByTool.interview > 0 ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">
                                Interviste: {formatNumber(account.creditUsageByTool.interview)}
                            </span>
                        ) : null}
                        {account.creditUsageByTool.chatbot > 0 ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                Chatbot: {formatNumber(account.creditUsageByTool.chatbot)}
                            </span>
                        ) : null}
                        {account.creditUsageByTool.visibility > 0 ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                                Visibility: {formatNumber(account.creditUsageByTool.visibility)}
                            </span>
                        ) : null}
                        {account.creditUsageByTool.ai_tips > 0 ? (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                                AI Tips: {formatNumber(account.creditUsageByTool.ai_tips)}
                            </span>
                        ) : null}
                        {account.creditUsageByTool.copilot > 0 ? (
                            <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded">
                                Copilot: {formatNumber(account.creditUsageByTool.copilot)}
                            </span>
                        ) : null}
                        {account.creditUsageByTool.export > 0 ? (
                            <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded">
                                Export: {formatNumber(account.creditUsageByTool.export)}
                            </span>
                        ) : null}
                        {account.creditUsageByTool.other > 0 ? (
                            <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded">
                                Altro: {formatNumber(account.creditUsageByTool.other)}
                            </span>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Expandable Section */}
            <div className="pt-4 border-t">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isExpanded ? 'Nascondi editor' : 'Modifica limiti e extra'}
                </button>

                {isExpanded && (
                    <div className="mt-4 space-y-4">
                        {/* Limits Editor */}
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-medium text-gray-900">Risorse Extra</h4>
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

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Limite Crediti Mensili</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={editLimits.monthlyCreditsLimit}
                                            onChange={(e) => setEditLimits(prev => ({
                                                ...prev,
                                                monthlyCreditsLimit: parseInt(e.target.value) || 0
                                            }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            placeholder="-1 per illimitato"
                                        />
                                    ) : (
                                        <p className="text-lg font-semibold">
                                            {account.monthlyCreditsLimit === BigInt(-1) ? '∞' : formatNumber(Number(account.monthlyCreditsLimit))}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Extra Token</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={editLimits.extraTokens}
                                            onChange={(e) => setEditLimits(prev => ({ ...prev, extraTokens: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    ) : (
                                        <p className="text-lg font-semibold">
                                            {editLimits.extraTokens ? formatNumber(editLimits.extraTokens) : <span className="text-gray-400">0</span>}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Extra Interviste</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={editLimits.extraInterviews}
                                            onChange={(e) => setEditLimits(prev => ({ ...prev, extraInterviews: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    ) : (
                                        <p className="text-lg font-semibold">
                                            {editLimits.extraInterviews || <span className="text-gray-400">0</span>}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Extra Sessioni Chatbot</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={editLimits.extraChatbotSessions}
                                            onChange={(e) => setEditLimits(prev => ({ ...prev, extraChatbotSessions: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    ) : (
                                        <p className="text-lg font-semibold">
                                            {editLimits.extraChatbotSessions || <span className="text-gray-400">0</span>}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Plan Limits Info */}
                        <div className="bg-blue-50 rounded-lg p-4">
                            <h4 className="font-medium text-blue-900 mb-2">Riferimenti Crediti {sub?.tier || 'FREE'}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-blue-600">Default Piano</p>
                                    <p className="font-bold text-blue-900">
                                        {planConfig.monthlyCredits === -1 ? '∞' : formatNumber(planConfig.monthlyCredits)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600">Limite Organizzazione</p>
                                    <p className="font-bold text-blue-900">
                                        {creditsLimit === -1 ? '∞' : formatNumber(creditsLimit)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-blue-600">Usato Organizzazione</p>
                                    <p className="font-bold text-blue-900">
                                        {formatNumber(Number(account.monthlyCreditsUsed))}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
