'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/business-tuner/Card';
import { Button } from '@/components/ui/business-tuner/Button';
import { showToast } from '@/components/toast';
import { PLANS, PlanType } from '@/config/plans';
import {
    Edit2, Save, X, Users, Bot, Eye, Sparkles,
    ChevronDown, ChevronUp, AlertTriangle, User, Building2, FolderKanban, Shield, Zap
} from 'lucide-react';
import type { UserData } from './page';

interface AdminUserCardProps {
    user: UserData;
}

function UsageBar({ used, limit, label, color }: {
    used: number;
    limit: number;
    label: string;
    color: string;
}) {
    const isUnlimited = limit === -1;
    const percentage = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
    const isOverLimit = !isUnlimited && used > limit;
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
                    {formatNumber(used)} / {isUnlimited ? '∞' : formatNumber(limit)}
                </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                {isUnlimited ? (
                    <div className="h-full w-full bg-gradient-to-r from-green-400 to-green-500 opacity-30" />
                ) : (
                    <div
                        className={`h-full rounded-full transition-all ${isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : color}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                )}
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

export function AdminUserCard({ user }: AdminUserCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const planConfig = PLANS[user.plan as PlanType] || PLANS[PlanType.FREE];
    const monthlyLimit = Number(user.monthlyCreditsLimit);
    const monthlyUsed = Number(user.monthlyCreditsUsed);
    const packCredits = Number(user.packCreditsAvailable);
    const totalAvailable = (monthlyLimit === -1 ? Infinity : monthlyLimit - monthlyUsed) + packCredits;

    const [editData, setEditData] = useState({
        plan: user.plan,
        monthlyCreditsLimit: monthlyLimit
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/users/${user.id}/limits`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData)
            });

            if (res.ok) {
                showToast('Utente aggiornato con successo');
                setIsEditing(false);
                window.location.reload();
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

    const roleColors: Record<string, string> = {
        'ADMIN': 'text-red-600',
        'MEMBER': 'text-gray-600',
        'VIEWER': 'text-gray-400',
        'USER': 'text-gray-600'
    };

    const totalBots = user.projectsWithBots.reduce((sum, p) => sum + p._count.bots, 0);

    return (
        <Card className="p-6">
            {/* Header - User Info */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <User className="w-5 h-5 text-gray-400" />
                        <h3 className="text-xl font-bold text-gray-900">{user.name || 'Senza nome'}</h3>
                        {user.role === 'ADMIN' && (
                            <span title="Admin">
                                <Shield className="w-4 h-4 text-red-500" />
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                        ID: <span className="font-mono">{user.id.slice(0, 12)}...</span>
                        {' | '}
                        Creato: {new Date(user.createdAt).toLocaleDateString('it-IT')}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isEditing ? (
                        <select
                            value={editData.plan}
                            onChange={(e) => setEditData(prev => ({ ...prev, plan: e.target.value }))}
                            className="px-2 py-1 rounded text-xs font-bold border border-gray-300"
                        >
                            <option value="FREE">FREE</option>
                            <option value="TRIAL">TRIAL</option>
                            <option value="STARTER">STARTER</option>
                            <option value="PRO">PRO</option>
                            <option value="BUSINESS">BUSINESS</option>
                            <option value="PARTNER">PARTNER</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                    ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${planColors[user.plan] || 'bg-gray-100 text-gray-800'}`}>
                            {user.plan}
                        </span>
                    )}
                    <span className={`text-xs font-medium ${roleColors[user.role] || 'text-gray-500'}`}>
                        Role: {user.role}
                    </span>
                </div>
            </div>

            {/* Credits Bar - NEW SYSTEM */}
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-violet-600" />
                    <span className="font-semibold text-violet-900">Crediti Utente (Nuovo Sistema)</span>
                </div>
                <UsageBar
                    used={monthlyUsed}
                    limit={monthlyLimit}
                    label="Crediti Mensili"
                    color="bg-violet-500"
                />
                {packCredits > 0 && (
                    <p className="text-xs text-violet-600 mt-2">
                        + {formatNumber(packCredits)} crediti da pack acquistati
                    </p>
                )}
                {user.creditsResetDate && (
                    <p className="text-xs text-gray-500 mt-1">
                        Reset: {new Date(user.creditsResetDate).toLocaleDateString('it-IT')}
                    </p>
                )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3 text-sm mb-4">
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <FolderKanban className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{user._count.ownedProjects}</p>
                    <p className="text-xs text-gray-500">Progetti</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <Bot className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{totalBots}</p>
                    <p className="text-xs text-gray-500">Bot</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <Building2 className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{user.organizations.length}</p>
                    <p className="text-xs text-gray-500">Org</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <Sparkles className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                    <p className="font-bold">{monthlyLimit === -1 ? '∞' : formatNumber(totalAvailable)}</p>
                    <p className="text-xs text-gray-500">Disponibili</p>
                </div>
            </div>

            {/* Organizations */}
            {user.organizations.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                        Organizzazioni ({user.organizations.length})
                    </p>
                    <div className="space-y-2">
                        {user.organizations.map(org => (
                            <div key={org.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium">{org.name}</span>
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        {org.role}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    {org.subscription && (
                                        <>
                                            <span className={`px-1.5 py-0.5 rounded ${planColors[org.subscription.tier] || 'bg-gray-100'}`}>
                                                {org.subscription.tier}
                                            </span>
                                            <span className={org.subscription.status === 'ACTIVE' ? 'text-green-600' : 'text-amber-600'}>
                                                {org.subscription.status}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Projects List */}
            {user.projectsWithBots.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                        Progetti ({user.projectsWithBots.length})
                    </p>
                    <div className="space-y-2">
                        {user.projectsWithBots.map(project => (
                            <div key={project.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <FolderKanban className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium">{project.name}</span>
                                </div>
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <Bot className="w-3 h-3" />
                                    {project._count.bots} bot
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Expandable Edit Section */}
            <div className="pt-4 border-t">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {isExpanded ? 'Nascondi editor' : 'Modifica piano e limiti'}
                </button>

                {isExpanded && (
                    <div className="mt-4 space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-medium text-gray-900">Modifica Utente</h4>
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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Limite Crediti Mensili</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={editData.monthlyCreditsLimit}
                                            onChange={(e) => setEditData(prev => ({
                                                ...prev,
                                                monthlyCreditsLimit: parseInt(e.target.value) || 0
                                            }))}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            placeholder="-1 per illimitato"
                                        />
                                    ) : (
                                        <p className="text-lg font-semibold">
                                            {monthlyLimit === -1 ? '∞ Illimitato' : formatNumber(monthlyLimit)}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">
                                        Usa -1 per crediti illimitati (ADMIN)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Limiti Piano {user.plan}</label>
                                    <p className="text-sm text-gray-600">
                                        Crediti: {planConfig.monthlyCredits === -1 ? '∞' : formatNumber(planConfig.monthlyCredits)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {planConfig.description}
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
