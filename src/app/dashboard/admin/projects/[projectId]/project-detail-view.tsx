'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { linkVisibilityConfig, unlinkVisibilityConfig, transferBotToProject, transferProjectToOrganization } from '@/app/actions/project-tools';
import {
    ArrowLeft,
    ArrowLeftRight,
    Bot as BotIcon,
    FolderCog,
    Globe,
    Link as LinkIcon,
    Loader2,
    MessageSquare,
    Search,
    Unlink,
    Users,
    X
} from 'lucide-react';
import TransferProjectDialog from '@/components/dashboard/TransferProjectDialog';
import { ProjectAccessManager } from '@/app/dashboard/projects/access-manager';
import { showToast } from '@/components/toast';
import { AnimatePresence, motion } from 'framer-motion';

interface Bot {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: Date;
    projectId: string;
    botType: string;
}

interface VisibilityConfig {
    id: string;
    brandName: string;
    category: string;
    projectId: string | null;
}

interface ProjectData {
    id: string;
    name: string;
    owner: {
        name: string | null;
        email: string;
    } | null;
    visibilityConfigs: VisibilityConfig[];
    bots: Bot[];
    organization: { id: string; name: string } | null;
}

interface ProjectDetailViewProps {
    project: ProjectData;
    allProjects: { id: string; name: string }[];
    allOrganizations: { id: string; name: string }[];
    availableBots: (Bot & { project: { name: string } })[];
    availableVisibilityConfigs: (VisibilityConfig & { project?: { name: string } | null })[];
}

export default function ProjectDetailView({
    project,
    allProjects,
    allOrganizations,
    availableBots,
    availableVisibilityConfigs
}: ProjectDetailViewProps) {
    const router = useRouter();
    const [transferBotId, setTransferBotId] = useState<string | null>(null);
    const [targetProjectId, setTargetProjectId] = useState('');
    const [isTransferProjectOpen, setIsTransferProjectOpen] = useState(false);
    const [isManageToolsOpen, setIsManageToolsOpen] = useState(false);
    const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const transferTargets = useMemo(
        () => allProjects.filter((candidate) => candidate.id !== project.id),
        [allProjects, project.id]
    );
    const activeTransferBot = useMemo(
        () => project.bots.find((bot) => bot.id === transferBotId) || null,
        [project.bots, transferBotId]
    );

    const handleTransfer = async () => {
        if (!transferBotId || !targetProjectId) return;
        setIsLoading(true);
        try {
            await transferBotToProject(transferBotId, targetProjectId);
            setTransferBotId(null);
            setTargetProjectId('');
            showToast('Tool trasferito con successo', 'success');
            router.refresh();
        } catch (error) {
            console.error(error);
            showToast('Errore durante il trasferimento del tool', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLinkVisibility = async (configId: string) => {
        setIsLoading(true);
        try {
            await linkVisibilityConfig(configId, project.id);
            showToast('Brand associato con successo', 'success');
            router.refresh();
        } catch (error) {
            console.error(error);
            showToast('Errore durante l\'associazione del brand', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnlinkVisibility = async (configId: string) => {
        setIsLoading(true);
        try {
            await unlinkVisibilityConfig(configId, project.id);
            showToast('Brand dissociato con successo', 'success');
            router.refresh();
        } catch (error) {
            console.error(error);
            showToast('Errore durante la dissociazione del brand', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssociateBot = async (botId: string) => {
        setIsLoading(true);
        try {
            await transferBotToProject(botId, project.id);
            showToast('Tool associato con successo', 'success');
            router.refresh();
        } catch (error) {
            console.error(error);
            showToast('Errore durante l\'associazione del tool', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-amber-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Admin Project Workspace</p>
                <p className="mt-1 text-sm text-slate-700">
                    Area coordinata con gestione progetti/tool: ownership, associazioni e trasferimenti nella stessa vista.
                </p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => router.back()}
                        className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
                        aria-label="Torna indietro"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">{project.name}</h1>
                        <p className="text-sm font-medium text-slate-500">
                            Owner: <span className="text-slate-900">{project.owner?.name || project.owner?.email || 'Nessun owner'}</span>
                            <span className="mx-2 text-slate-300">|</span>
                            Org: <span className="text-slate-900">{project.organization?.name || 'Nessuna organizzazione'}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsManageUsersOpen(true)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-amber-400 hover:bg-amber-50"
                    >
                        <Users className="h-4 w-4" />
                        Gestisci utenti
                    </button>
                    <button
                        onClick={() => setIsTransferProjectOpen(true)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
                    >
                        <ArrowLeftRight className="h-4 w-4" />
                        Trasferisci progetto
                    </button>
                    <button
                        onClick={() => setIsManageToolsOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-200 transition-all hover:bg-amber-600"
                    >
                        <Search className="h-4 w-4" />
                        Associa tool
                    </button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tool associati</p>
                    <p className="text-xl font-black text-slate-900">{project.bots.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Brand associati</p>
                    <p className="text-xl font-black text-slate-900">{project.visibilityConfigs.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tool disponibili</p>
                    <p className="text-xl font-black text-slate-900">{availableBots.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Org disponibili</p>
                    <p className="text-xl font-black text-slate-900">{allOrganizations.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                    <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                        <BotIcon className="text-amber-500" />
                        Tool del progetto ({project.bots.length})
                    </h2>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto w-full">
                        <table className="w-full text-sm text-left">
                            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                                <tr>
                                    <th className="px-6 py-3">Nome</th>
                                    <th className="px-6 py-3">Tipo</th>
                                    <th className="px-6 py-3">Stato</th>
                                    <th className="px-6 py-3 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {project.bots.map((bot) => (
                                    <tr key={bot.id} className="transition-colors hover:bg-slate-50/70">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{bot.name}</div>
                                            <div className="max-w-[180px] truncate text-[10px] font-medium text-slate-400">{bot.id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${bot.botType === 'chatbot' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                                {bot.botType === 'chatbot' ? 'Chatbot' : 'Intervista'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${bot.status === 'ACTIVE' || bot.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {bot.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setTransferBotId(bot.id)}
                                                className="text-slate-400 transition-colors hover:text-amber-600"
                                                title="Sposta in un altro progetto"
                                            >
                                                <LinkIcon size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {project.bots.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-sm italic text-slate-400">
                                            Nessun tool associato.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                        <Globe className="text-blue-500" />
                        Brand e visibilita ({project.visibilityConfigs.length})
                    </h2>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto w-full">
                        <table className="w-full text-sm text-left">
                            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                                <tr>
                                    <th className="px-6 py-3">Brand</th>
                                    <th className="px-6 py-3">Categoria</th>
                                    <th className="px-6 py-3 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {project.visibilityConfigs.map((config) => (
                                    <tr key={config.id} className="transition-colors hover:bg-slate-50/70">
                                        <td className="px-6 py-4 font-semibold text-slate-900">{config.brandName}</td>
                                        <td className="px-6 py-4">
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                                                {config.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleUnlinkVisibility(config.id)}
                                                className="text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50"
                                                title="Dissocia dal progetto"
                                                disabled={isLoading}
                                            >
                                                <Unlink size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {project.visibilityConfigs.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-10 text-center text-sm italic text-slate-400">
                                            Nessun brand associato.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isManageToolsOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsManageToolsOpen(false)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 18 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 18 }}
                            className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                        >
                            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-amber-500 p-2 text-white">
                                        <FolderCog size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">Associazioni Tool</h3>
                                        <p className="text-sm text-slate-500">Aggiungi tool e brand da altri progetti della stessa organizzazione.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsManageToolsOpen(false)}
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6 overflow-y-auto p-6">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Tool disponibili</p>
                                        <p className="text-xl font-black text-slate-900">{availableBots.length}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Brand disponibili</p>
                                        <p className="text-xl font-black text-slate-900">{availableVisibilityConfigs.length}</p>
                                    </div>
                                </div>

                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        <MessageSquare size={14} /> Bot disponibili
                                    </h4>
                                    <div className="space-y-2">
                                        {availableBots.map((bot) => (
                                            <div key={bot.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{bot.name}</p>
                                                    <p className="text-xs text-slate-500">Attualmente in: {bot.project.name}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleAssociateBot(bot.id)}
                                                    disabled={isLoading}
                                                    className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
                                                >
                                                    Associa qui
                                                </button>
                                            </div>
                                        ))}
                                        {availableBots.length === 0 && (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm italic text-slate-500">
                                                Nessun bot disponibile.
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                        <Globe size={14} /> Brand disponibili
                                    </h4>
                                    <div className="space-y-2">
                                        {availableVisibilityConfigs.map((config) => (
                                            <div key={config.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{config.brandName}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {config.projectId ? `Associato a: ${config.project?.name || 'Sconosciuto'}` : 'Disponibile'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleLinkVisibility(config.id)}
                                                    disabled={isLoading}
                                                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
                                                >
                                                    Associa qui
                                                </button>
                                            </div>
                                        ))}
                                        {availableVisibilityConfigs.length === 0 && (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm italic text-slate-500">
                                                Nessun brand disponibile.
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isManageUsersOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsManageUsersOpen(false)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 18 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 18 }}
                            className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                        >
                            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-amber-500 p-2 text-white">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">Gestione membri</h3>
                                        <p className="text-sm text-slate-500">Permessi e inviti all&apos;interno del progetto.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsManageUsersOpen(false)}
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6">
                                <ProjectAccessManager
                                    projectId={project.id}
                                    variant="compact"
                                    onClose={() => setIsManageUsersOpen(false)}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {transferBotId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setTransferBotId(null);
                                setTargetProjectId('');
                            }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 18 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 18 }}
                            className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
                        >
                            <div className="mb-5 flex items-start justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Sposta tool</h3>
                                    <p className="text-sm text-slate-500">
                                        {activeTransferBot ? `Tool selezionato: ${activeTransferBot.name}` : 'Seleziona il progetto di destinazione.'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setTransferBotId(null);
                                        setTargetProjectId('');
                                    }}
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Progetto destinazione</label>
                                    <select
                                        value={targetProjectId}
                                        onChange={(e) => setTargetProjectId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                                    >
                                        <option value="">Seleziona...</option>
                                        {transferTargets.map((candidate) => (
                                            <option key={candidate.id} value={candidate.id}>
                                                {candidate.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => {
                                            setTransferBotId(null);
                                            setTargetProjectId('');
                                        }}
                                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        onClick={handleTransfer}
                                        disabled={!targetProjectId || isLoading}
                                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Conferma
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <TransferProjectDialog
                isOpen={isTransferProjectOpen}
                onClose={() => setIsTransferProjectOpen(false)}
                projectName={project.name}
                targetOrganizations={allOrganizations}
                currentOrgId={project.organization?.id || ''}
                onTransfer={async (targetOrgId) => {
                    await transferProjectToOrganization(project.id, targetOrgId);
                    router.refresh();
                }}
            />
        </div>
    );
}
