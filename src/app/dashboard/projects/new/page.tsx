'use client';

import { createProjectAction } from '@/app/actions';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSearchParams } from 'next/navigation';
import { Building2, LayoutGrid, Plus } from 'lucide-react';

export default function NewProjectPage() {
    const { organizations, currentOrganization } = useOrganization();
    const searchParams = useSearchParams();
    const orgIdFromUrl = searchParams.get('orgId');

    // Use orgId from URL, or currentOrg from context, or first org available
    const initialOrgId = orgIdFromUrl || currentOrganization?.id || organizations[0]?.id;

    return (
        <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-50 rounded-2xl">
                    <LayoutGrid className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Crea Nuovo Progetto</h1>
                    <p className="text-sm text-gray-500">Inizia a configurare i tuoi assistenti AI per questo spazio.</p>
                </div>
            </div>

            <form action={createProjectAction} className="space-y-6">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Spazio di lavoro (Team)</label>
                    <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            name="organizationId"
                            defaultValue={initialOrgId}
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-amber-500 transition-all text-sm appearance-none font-medium"
                            required
                        >
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Nome Progetto</label>
                    <input
                        name="name"
                        required
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-amber-500 transition-all text-sm font-medium"
                        placeholder="Es: Ricerca Clienti Q3"
                    />
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-2xl font-bold transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Crea Progetto
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-4 uppercase font-black tracking-widest">
                        I progetti sono isolati per team
                    </p>
                </div>
            </form>
        </div>
    );
}
