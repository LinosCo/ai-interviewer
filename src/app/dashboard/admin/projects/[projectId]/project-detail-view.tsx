'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { linkVisibilityConfig, unlinkVisibilityConfig, transferBotToProject, transferProjectToOrganization } from '@/app/actions/project-tools';
import { ArrowLeft, Loader2, X, Link as LinkIcon, Unlink, Bot as BotIcon, Globe, MessageSquare, Search, LayoutGrid, ChevronRight, Users, Building2, ArrowLeftRight } from 'lucide-react';
import TransferProjectDialog from '@/components/dashboard/TransferProjectDialog';
import { ProjectAccessManager } from '@/app/dashboard/projects/access-manager';
import { showToast } from '@/components/toast';
import { motion, AnimatePresence } from 'framer-motion';

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

    const handleTransfer = async () => {
        if (!transferBotId || !targetProjectId) return;
        setIsLoading(true);
        try {
            await transferBotToProject(transferBotId, targetProjectId);
            setTransferBotId(null);
            setTargetProjectId('');
            showToast('Bot trasferito con successo', 'success');
            router.refresh();
        } catch (error) {
            console.error(error);
            showToast('Errore durante il trasferimento del bot', 'error');
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
            showToast('Errore durante l\'associazione', 'error');
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
            showToast('Errore durante la dissociazione', 'error');
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
            showToast('Errore durante l\'associazione', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">{project.name}</h1>
                        <p className="text-sm text-gray-500 font-medium">
                            Owner: <span className="text-gray-900">{project.owner?.name || project.owner?.email || 'No Owner'}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsManageUsersOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:border-amber-500 hover:bg-amber-50 transition-all text-sm"
                    >
                        <Users className="w-4 h-4" />
                        Gestisci Utenti
                    </button>
                    <button
                        onClick={() => setIsTransferProjectOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:border-gray-900 hover:bg-gray-50 transition-all text-sm"
                    >
                        <ArrowLeftRight className="w-4 h-4" />
                        Sposta Organizzazione
                    </button>
                    <button
                        onClick={() => setIsManageToolsOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-sm shadow-amber-200 text-sm"
                    >
                        <Search className="w-4 h-4" />
                        Gestisci Tool
                    </button>
                </div>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Interviews & Chatbots */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <BotIcon className="text-amber-500" />
                            Interviste e Chatbot ({project.bots.length})
                        </h2>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-50 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-400 font-black uppercase tracking-widest text-[10px] border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">Nome</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Stato</th>
                                    <th className="px-6 py-4 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {project.bots.map(bot => (
                                    <tr key={bot.id} className="hover:bg-gray-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">{bot.name}</div>
                                            <div className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]">{bot.id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${bot.botType === 'chatbot' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {bot.botType === 'chatbot' ? 'Chatbot' : 'Intervista'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${bot.status === 'ACTIVE' || bot.status === 'PUBLISHED' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {bot.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setTransferBotId(bot.id)}
                                                className="text-gray-400 hover:text-amber-600 transition-colors"
                                                title="Sposta in un altro progetto"
                                            >
                                                <LinkIcon size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {project.bots.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-gray-400 font-medium italic">
                                            Nessun tool associato.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Brands / Visibility Configs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <Globe className="text-blue-500" />
                            Brand e Visibilità ({project.visibilityConfigs.length})
                        </h2>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-50 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 text-gray-400 font-black uppercase tracking-widest text-[10px] border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4">Brand</th>
                                    <th className="px-6 py-4">Categoria</th>
                                    <th className="px-6 py-4 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {project.visibilityConfigs.map(config => (
                                    <tr key={config.id} className="hover:bg-gray-50/30 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-900">{config.brandName}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                {config.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleUnlinkVisibility(config.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
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
                                        <td colSpan={3} className="px-6 py-10 text-center text-gray-400 font-medium italic">
                                            Nessun brand associato.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Manage Tools Dialog */}
            <AnimatePresence>
                {isManageToolsOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsManageToolsOpen(false)}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col relative z-10"
                        >
                            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gray-900 text-white rounded-2xl">
                                        <LayoutGrid size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Associa nuovi Tool</h2>
                                        <p className="text-sm text-gray-500 font-medium">Trova tool esistenti nell&apos;organizzazione.</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsManageToolsOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                {/* Available Bots */}
                                <section className="space-y-4">
                                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <MessageSquare size={14} /> Interviste e Chatbot disponibili
                                    </h3>
                                    <div className="space-y-3">
                                        {availableBots.map(bot => (
                                            <div key={bot.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-amber-200 hover:bg-amber-50/30 transition-all group">
                                                <div>
                                                    <div className="font-bold text-gray-900 group-hover:text-amber-600 transition-colors uppercase text-[12px] tracking-tight">{bot.name}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium">Attualmente in: <span className="font-bold text-gray-600">{bot.project.name}</span></div>
                                                </div>
                                                <button
                                                    onClick={() => handleAssociateBot(bot.id)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 bg-white text-gray-900 border-2 border-gray-900 rounded-xl text-xs font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
                                                >
                                                    Associa qui
                                                </button>
                                            </div>
                                        ))}
                                        {availableBots.length === 0 && (
                                            <div className="text-center py-6 px-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                                <p className="text-xs text-gray-400 font-medium italic">Nessun altro bot trovato nell&apos;organizzazione.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <hr className="border-gray-100" />

                                {/* Available Visibility Configs */}
                                <section className="space-y-4">
                                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Globe size={14} /> Brand/Visibilità disponibili
                                    </h3>
                                    <div className="space-y-3">
                                        {availableVisibilityConfigs.map(config => (
                                            <div key={config.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                                                <div>
                                                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase text-[12px] tracking-tight">{config.brandName}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium">
                                                        {config.projectId ? (
                                                            <>Associato a: <span className="font-bold text-gray-600">{config.project?.name || 'Sconosciuto'}</span></>
                                                        ) : (
                                                            <span className="text-green-600 font-bold uppercase tracking-widest">Disponibile</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleLinkVisibility(config.id)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 bg-white text-gray-900 border-2 border-gray-900 rounded-xl text-xs font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
                                                >
                                                    Associa qui
                                                </button>
                                            </div>
                                        ))}
                                        {availableVisibilityConfigs.length === 0 && (
                                            <div className="text-center py-6 px-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                                <p className="text-xs text-gray-400 font-medium italic">Nessun altro brand trovato nell&apos;organizzazione.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Manage Users Dialog */}
            <AnimatePresence>
                {isManageUsersOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsManageUsersOpen(false)}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col relative z-10"
                        >
                            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-500 text-white rounded-2xl">
                                        <Users size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Gestione Utenti</h2>
                                        <p className="text-sm text-gray-500 font-medium">Invita collaboratori al progetto.</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsManageUsersOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-8">
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

            {/* Transfer Bot Dialog (Basic Transfer to another Project) */}
            <AnimatePresence>
                {transferBotId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setTransferBotId(null)}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 relative z-10"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Sposta Tool</h2>
                                    <p className="text-sm text-gray-500 font-medium">Seleziona il progetto di destinazione.</p>
                                </div>
                                <button onClick={() => setTransferBotId(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Progetto di Destinazione</label>
                                    <div className="relative">
                                        <select
                                            value={targetProjectId}
                                            onChange={(e) => setTargetProjectId(e.target.value)}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl px-5 py-3 text-sm font-bold outline-none transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">Seleziona...</option>
                                            {allProjects
                                                .filter(p => p.id !== project.id)
                                                .map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <ChevronRight size={16} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setTransferBotId(null)}
                                        className="flex-1 px-6 py-4 border-2 border-gray-100 text-gray-500 rounded-2xl text-sm font-black hover:bg-gray-50 transition-all"
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        onClick={handleTransfer}
                                        disabled={!targetProjectId || isLoading}
                                        className="flex-1 px-6 py-4 bg-gray-900 text-white rounded-2xl text-sm font-black hover:bg-gray-800 shadow-lg shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                                    >
                                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Sposta Tool
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
