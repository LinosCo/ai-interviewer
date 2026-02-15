'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { transferProject, createProject } from '@/app/actions/admin';
import { Icons } from '@/components/ui/business-tuner/Icons';

interface User {
    id: string;
    name: string | null;
    email: string;
}

interface Project {
    id: string;
    name: string;
    ownerId: string | null;
    owner: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    _count: {
        bots: number;
    };
}

interface ProjectsViewProps {
    projects: Project[];
    users: User[];
}

export default function ProjectsView({ projects, users }: ProjectsViewProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [newOwnerId, setNewOwnerId] = useState('');

    // Create State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createOwnerId, setCreateOwnerId] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const createInFlightRef = useRef(false);
    const transferInFlightRef = useRef(false);
    const router = useRouter();

    const filteredProjects = useMemo(() => projects.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.owner?.email.toLowerCase().includes(searchTerm.toLowerCase())
    ), [projects, searchTerm]);
    const totalBots = useMemo(() => projects.reduce((sum, project) => sum + project._count.bots, 0), [projects]);
    const orphanProjects = useMemo(() => projects.filter((project) => !project.owner).length, [projects]);

    const handleTransfer = async () => {
        if (!selectedProject || !newOwnerId || transferInFlightRef.current) return;
        transferInFlightRef.current = true;
        setIsLoading(true);
        try {
            await transferProject(selectedProject.id, newOwnerId);
            alert('Project transferred successfully');
            setSelectedProject(null);
            setNewOwnerId('');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to transfer project');
        } finally {
            transferInFlightRef.current = false;
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!createName || !createOwnerId || createInFlightRef.current) return;
        createInFlightRef.current = true;
        setIsLoading(true);
        try {
            await createProject(createName, createOwnerId);
            alert('Project created successfully');
            setIsCreateOpen(false);
            setCreateName('');
            setCreateOwnerId('');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to create project');
        } finally {
            createInFlightRef.current = false;
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-amber-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Admin Control Center</p>
                <p className="mt-1 text-sm text-slate-700">
                    Vista coordinata per governo progetti: ownership, trasferimenti e coerenza con l&apos;area gestione tool/progetti.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Progetti</p>
                    <p className="text-xl font-black text-slate-900">{projects.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tool totali</p>
                    <p className="text-xl font-black text-slate-900">{totalBots}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Senza owner</p>
                    <p className="text-xl font-black text-slate-900">{orphanProjects}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Filtrati</p>
                    <p className="text-xl font-black text-slate-900">{filteredProjects.length}</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-black text-slate-900">Amministrazione Progetti</h1>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                        <Icons.Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cerca progetto o owner..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 sm:w-72"
                        />
                    </div>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-amber-700"
                    >
                        <Icons.Plus className="w-4 h-4" />
                        Nuovo Progetto
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                        <tr>
                            <th className="px-6 py-3">Progetto</th>
                            <th className="px-6 py-3">Tool</th>
                            <th className="px-6 py-3">Owner corrente</th>
                            <th className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredProjects.map(project => (
                            <tr key={project.id} className="hover:bg-slate-50/70">
                                <td className="px-6 py-4 font-semibold text-slate-900">{project.name}</td>
                                <td className="px-6 py-4 text-slate-600">{project._count.bots}</td>
                                <td className="px-6 py-4 text-slate-600">
                                    {project.owner ? (
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900">{project.owner.name || 'Unnamed'}</span>
                                            <span className="text-xs text-slate-500">{project.owner.email}</span>
                                        </div>
                                    ) : (
                                        <span className="italic text-red-600">Nessun owner</span>
                                    )}
                                </td>
                                <td className="flex items-center justify-end gap-2 px-6 py-4 text-right">
                                    <button
                                        onClick={() => router.push(`/dashboard/admin/projects/${project.id}`)}
                                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                    >
                                        Apri scheda
                                    </button>
                                    <button
                                        onClick={() => setSelectedProject(project)}
                                        className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900"
                                    >
                                        Trasferisci owner
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredProjects.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    Nessun progetto trovato con questo filtro.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Dialog */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Crea nuovo progetto</h2>
                                <p className="text-sm text-slate-500">Il progetto verrà assegnato all&apos;organizzazione dell&apos;owner scelto.</p>
                            </div>
                            <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <Icons.X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Nome progetto</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                                    placeholder="Nuovo Progetto"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Owner</label>
                                <select
                                    value={createOwnerId}
                                    onChange={(e) => setCreateOwnerId(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                                >
                                    <option value="">Seleziona owner...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name || user.email} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => setIsCreateOpen(false)}
                                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!createName || !createOwnerId || isLoading}
                                    className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isLoading && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
                                    Crea progetto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Dialog */}
            {selectedProject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Trasferisci ownership</h2>
                                <p className="text-sm text-slate-500">Operazione di riallineamento governance.</p>
                            </div>
                            <button onClick={() => setSelectedProject(null)} className="text-slate-400 hover:text-slate-600">
                                <Icons.X size={20} />
                            </button>
                        </div>

                        <div className="mb-6">
                            <p className="mb-2 text-sm text-slate-600">
                                Stai trasferendo l&apos;ownership di <strong>{selectedProject.name}</strong>.
                            </p>
                            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                                <Icons.AlertCircle className="inline-block w-4 h-4 mr-2 -mt-0.5" />
                                Il nuovo owner ottiene controllo completo del progetto e dei suoi tool.
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Nuovo owner</label>
                                <select
                                    value={newOwnerId}
                                    onChange={(e) => setNewOwnerId(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                                >
                                    <option value="">Seleziona utente...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name || user.email} ({user.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setSelectedProject(null)}
                                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                                >
                                    Annulla
                                </button>
                                <button
                                    onClick={handleTransfer}
                                    disabled={!newOwnerId || isLoading}
                                    className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isLoading && <Icons.Loader2 className="w-4 h-4 animate-spin" />}
                                    Conferma trasferimento
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
