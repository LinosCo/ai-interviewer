'use client';

import { useState } from 'react';
import { updateBotProjectAction } from '@/app/actions';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { showToast } from '@/components/toast';
import { ArrowLeftRight, Folder, Mail } from 'lucide-react';
import TransferDialog from './TransferDialog';

interface Project {
    id: string;
    name: string;
}

interface ProjectSelectorProps {
    botId: string;
    botName?: string;
    currentProjectId: string;
    projects: Project[];
}

export default function ProjectSelector({ botId, botName = 'Bot', currentProjectId, projects }: ProjectSelectorProps) {
    const [selectedId, setSelectedId] = useState(currentProjectId);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isTransferOpen, setIsTransferOpen] = useState(false);

    const handleUpdate = async (newId: string) => {
        setSelectedId(newId);
        setIsUpdating(true);
        try {
            await updateBotProjectAction(botId, newId);
            showToast('✅ Progetto aggiornato con successo!', 'success');
        } catch (error: any) {
            console.error(error);
            showToast('Errore durante l\'aggiornamento del progetto', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded shadow space-y-4">
            <div className="flex items-center justify-between border-b pb-2 mb-4">
                <div className="flex items-center gap-2">
                    <Folder className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold">Progetto</h2>
                </div>
                <button
                    onClick={() => setIsTransferOpen(true)}
                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                    title="Trasferimento avanzato (anche via email)"
                >
                    <ArrowLeftRight className="w-4 h-4" />
                    Trasferisci
                </button>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sposta rapida in un altro progetto
                </label>
                <div className="relative">
                    <select
                        value={selectedId}
                        onChange={(e) => handleUpdate(e.target.value)}
                        disabled={isUpdating}
                        className="w-full border p-2 rounded bg-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
                    >
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                    {isUpdating && (
                        <div className="absolute right-8 top-1/2 -translate-y-1/2">
                            <Icons.Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    L&apos;intervista sarà visibile solo agli utenti che hanno accesso a questo progetto. Per trasferirla a un altro utente, usa il tasto &quot;Trasferisci&quot; sopra.
                </p>
            </div>

            <TransferDialog
                isOpen={isTransferOpen}
                onClose={() => setIsTransferOpen(false)}
                itemName={botName}
                itemId={botId}
                itemType="BOT"
                targetProjects={projects}
                currentProjectId={currentProjectId}
                onTransfer={async (targetId) => {
                    await updateBotProjectAction(botId, targetId);
                }}
            />
        </div>
    );
}
