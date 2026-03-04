'use client';

import { useState } from 'react';
import { Plus, ArrowLeftRight, Pencil, Trash2 } from 'lucide-react';
import { deleteOrganization } from '@/app/actions/admin';
import { showToast } from '@/components/toast';
import OrganizationDialog from './organization-dialog';

interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: string;
    tier: string;
    owner: { name: string | null; email: string } | null;
    members: number;
    projectCount: number;
    botCount: number;
    toolCount: number;
    projects: any[];
    createdAt: string;
}

interface OrganizationsViewProps {
    organizations: Organization[];
}

export default function OrganizationsView({ organizations }: OrganizationsViewProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<Organization | undefined>(undefined);

    const handleCreate = () => {
        setSelectedOrg(undefined);
        setIsDialogOpen(true);
    };

    const handleTransfer = (org: Organization) => {
        setSelectedOrg(org);
        setIsDialogOpen(true);
    };

    const handleDelete = async (orgId: string, orgName: string) => {
        if (!confirm(`Sei sicuro di voler eliminare l'organizzazione "${orgName}"? Questa azione eliminerà anche tutti i progetti e i bot associati. L'azione è irreversibile.`)) {
            return;
        }

        try {
            await deleteOrganization(orgId);
            showToast('Organizzazione eliminata con successo', 'success');
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Errore durante l\'eliminazione', 'error');
        }
    };

    const totalMembers = organizations.reduce((sum, org) => sum + org.members, 0);
    const totalProjects = organizations.reduce((sum, org) => sum + org.projectCount, 0);
    const totalBots = organizations.reduce((sum, org) => sum + org.botCount, 0);

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestione Organizzazioni</h1>
                    <p className="text-gray-500 text-sm">Crea e trasferisci le organizzazioni tra gli utenti.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-amber-700 sm:w-auto"
                >
                    <Plus size={20} />
                    Nuova Organizzazione
                </button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Organizzazioni</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{organizations.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Membri totali</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{totalMembers}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Progetti</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{totalProjects}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Bot</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{totalBots}</p>
                </div>
            </div>

            <div className="space-y-3 md:hidden">
                {organizations.map((org) => (
                    <div key={org.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-gray-900">{org.name}</p>
                                <p className="truncate text-xs text-gray-500">slug: {org.slug}</p>
                            </div>
                            <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-xs font-bold uppercase text-amber-700">
                                {org.tier}
                            </span>
                        </div>
                        <div className="mt-3 text-sm text-gray-700">
                            <p className="font-medium">{org.owner?.name || 'Nessun proprietario'}</p>
                            <p className="truncate text-xs text-gray-500">{org.owner?.email || '---'}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-bold text-stone-700">{org.projectCount} PRJ</span>
                            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{org.botCount} BOT</span>
                            <span className="rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">{org.toolCount} TOOL</span>
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{org.members} MEM</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <button
                                onClick={() => handleTransfer(org)}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 transition-all hover:bg-stone-100"
                            >
                                <ArrowLeftRight size={14} />
                                Gestisci
                            </button>
                            <button
                                onClick={() => handleDelete(org.id, org.name)}
                                className="inline-flex items-center justify-center rounded-lg bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100 hover:text-red-700"
                                title="Elimina Organizzazione"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizzazione</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Proprietario (OWNER)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Piano</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risorse</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {organizations.map((org) => (
                                <tr key={org.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{org.name}</div>
                                        <div className="text-xs text-gray-400">slug: {org.slug}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{org.owner?.name || '---'}</div>
                                        <div className="text-xs text-gray-500">{org.owner?.email || 'Nessun proprietario'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase">
                                            {org.tier}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-stone-50 text-stone-600 px-2 py-0.5 rounded text-[10px] font-bold border border-stone-100">
                                                    {org.projectCount} PRJ
                                                </span>
                                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                                                    {org.botCount} BOT
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-100">
                                                    {org.toolCount} TOOL
                                                </span>
                                                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100">
                                                    {org.members} MEM
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleTransfer(org)}
                                                className="text-amber-600 hover:text-amber-700 p-2 bg-amber-50 rounded-lg transition-all"
                                                title="Gestisci / Trasferisci"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleTransfer(org)}
                                                className="text-stone-600 hover:text-stone-700 hidden lg:flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg transition-all text-xs font-bold"
                                            >
                                                <ArrowLeftRight size={14} />
                                                Trasferisci
                                            </button>
                                            <button
                                                onClick={() => handleDelete(org.id, org.name)}
                                                className="text-red-600 hover:text-red-700 p-2 bg-red-50 rounded-lg transition-all"
                                                title="Elimina Organizzazione"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <OrganizationDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                organization={selectedOrg}
            />
        </div>
    );
}
