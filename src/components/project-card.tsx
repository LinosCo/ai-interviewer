'use client';

import { useState } from 'react';
import { deleteProjectAction, renameProjectAction } from '@/app/actions';
import { MoreVertical, Trash2, Edit2, Check, X, Folder } from 'lucide-react';
import Link from 'next/link';
import BotCard from './bot-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface ProjectCardProps {
    project: any;
    userId: string;
    isAdmin: boolean;
}

export default function ProjectCard({ project, userId, isAdmin }: ProjectCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(project.name);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isOwner = project.ownerId === userId || project.role === 'OWNER';
    const canRename = isAdmin || isOwner;
    const canDeleteProject = isAdmin || isOwner;
    const canDeleteBots = isAdmin || isOwner;

    const handleSaveName = async () => {
        if (!newName.trim() || newName === project.name) {
            setIsEditing(false);
            return;
        }
        try {
            await renameProjectAction(project.id, newName);
            setIsEditing(false);
            setError(null);
        } catch (err) {
            setError("Rinomina fallita.");
        }
    };

    const handleDeleteClick = () => {
        setShowMenu(false);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        setError(null);
        try {
            await deleteProjectAction(project.id);
        } catch (err: any) {
            setError(err.message || "Eliminazione fallita.");
            setIsDeleting(false);
            throw err;
        }
    };

    if (isDeleting) return null; // Optimistic removal

    return (
        <div className="border p-6 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3 flex-1">
                    <Folder className="w-5 h-5 text-gray-400" />
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="border rounded px-2 py-1 text-sm font-semibold"
                                autoFocus
                            />
                            <button onClick={handleSaveName} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => { setIsEditing(false); setNewName(project.name); }} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <h2 className="font-semibold text-lg text-gray-800">{project.name}</h2>
                    )}
                </div>

                {/* Actions Menu */}
                {(canRename || canDeleteProject) && (
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                            <MoreVertical className="w-5 h-5" />
                        </button>

                        {showMenu && (
                            <div className="absolute right-0 mt-1 w-48 bg-white border rounded shadow-lg z-10 py-1">
                                {canRename && (
                                    <button
                                        onClick={() => { setIsEditing(true); setShowMenu(false); }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                    >
                                        <Edit2 className="w-4 h-4" /> Rename Project
                                    </button>
                                )}
                                {canDeleteProject && (
                                    <button
                                        onClick={handleDeleteClick}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" aria-hidden="true" /> Elimina Progetto
                                    </button>
                                )}
                            </div>
                        )}
                        {/* Backdrop to close menu */}
                        {showMenu && (
                            <div className="fixed inset-0 z-0" onClick={() => setShowMenu(false)}></div>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {project.bots.map((bot: any) => (
                    <BotCard key={bot.id} bot={bot} canDelete={canDeleteBots} />
                ))}

                {/* Add new bot card */}
                {(isOwner || isAdmin) && (
                    <Link href={`/dashboard/projects/${project.id}/bots/new`} className="flex items-center justify-center border-2 border-dashed p-4 rounded text-gray-400 hover:text-blue-600 hover:border-blue-300 transition bg-gray-50/50 hover:bg-blue-50/20">
                        <span className="text-sm font-medium">+ Crea Bot</span>
                    </Link>
                )}
            </div>

            {error && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                    {error}
                </div>
            )}

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Elimina Progetto"
                description={`Sei sicuro di voler eliminare "${project.name}" e TUTTI i suoi bot? Questa azione non può essere annullata.`}
                confirmLabel="Elimina"
                cancelLabel="Annulla"
                variant="destructive"
                onConfirm={handleConfirmDelete}
                loading={isDeleting}
            />
        </div>
    );
}
