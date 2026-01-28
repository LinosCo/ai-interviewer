'use client';

import { useState } from 'react';
import { Plus, ArrowLeftRight, Pencil } from 'lucide-react';
import OrganizationDialog from './organization-dialog';

interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: string;
    tier: string;
    owner: { name: string | null; email: string } | null;
    members: number;
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
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizzazione</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Proprietario (OWNER)</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Piano</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Progetti / Membri</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Azioni</th>
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
                                    <div className="flex items-center gap-2">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                            {org.projects.length} prj
                                        </span>
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                            {org.members} mem
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleTransfer(org)}
                                        className="text-amber-600 hover:text-amber-700 flex items-center gap-1.5 ml-auto bg-amber-50 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        <ArrowLeftRight size={16} />
                                        Trasferisci
                                    </button>
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
    );
}
