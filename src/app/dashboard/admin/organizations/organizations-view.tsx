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

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestione Organizzazioni</h1>
                    <p className="text-gray-500 text-sm">Crea e trasferisci le organizzazioni tra gli utenti.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 transition-all font-medium shadow-sm"
                >
                    <Plus size={20} />
                    Nuova Organizzazione
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                                                className="text-stone-600 hover:text-stone-700 flex items-center gap-1.5 bg-stone-50 px-3 py-1.5 rounded-lg transition-all text-xs font-bold"
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

                <OrganizationDialog
                    isOpen={isDialogOpen}
                    onClose={() => setIsDialogOpen(false)}
                    organization={selectedOrg}
                />
            </div>
        </div>
    );
}
