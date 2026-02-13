'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Bot, Trash2, Loader2, Users, Copy } from 'lucide-react';
import { deleteBotAction, duplicateBotAction } from '@/actions/bot-actions';
import { BotStatusToggle } from './BotStatusToggle';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BotListItemProps {
    bot: {
        id: string;
        name: string;
        botType: string;
        language?: string;
        conversations: { id: string; status: string; completedAt: string | null }[];
        updatedAt: string;
        status?: string;
        project?: { id: string; name: string } | null;
    };
    compact?: boolean;
    showProject?: boolean;
}

function formatDateITUtc(date: string): string {
    return new Date(date).toLocaleDateString('it-IT', { timeZone: 'UTC' });
}

export function BotListItem({ bot, compact = false, showProject = false }: BotListItemProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateName, setDuplicateName] = useState(`${bot.name} (copia)`);
    const [duplicateLanguage, setDuplicateLanguage] = useState(bot.language || 'it');
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        setDeleteError(null);
        const result = await deleteBotAction(bot.id);

        if (result.success) {
            router.refresh();
        } else {
            setDeleteError(result.error || 'Errore durante la cancellazione');
            setIsDeleting(false);
            throw new Error(result.error);
        }
    };

    const handleDuplicateClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDuplicateName(`${bot.name} (copia)`);
        setDuplicateLanguage(bot.language || 'it');
        setDuplicateError(null);
        setShowDuplicateDialog(true);
    };

    const handleConfirmDuplicate = async () => {
        if (!duplicateName.trim()) {
            setDuplicateError('Inserisci un nome valido');
            return;
        }
        setIsDuplicating(true);
        setDuplicateError(null);

        const result = await duplicateBotAction(bot.id, {
            name: duplicateName.trim(),
            language: duplicateLanguage
        });

        if (result.success && result.botId) {
            setShowDuplicateDialog(false);
            router.refresh();
            router.push(`/dashboard/bots/${result.botId}`);
        } else {
            setDuplicateError(result.error || 'Errore durante la duplicazione');
            setIsDuplicating(false);
        }
    };

    const completedCount = bot.conversations.filter(c => c.status === 'COMPLETED').length;

    // Type checking with fallback
    const isChatbot = bot.botType === 'chatbot';
    const Icon = isChatbot ? Bot : MessageSquare;
    const colorClass = isChatbot ? 'text-blue-600 bg-blue-100' : 'text-amber-600 bg-amber-100';

    return (
        <div className="group flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b last:border-0 border-gray-100 relative">
            <Link href={`/dashboard/bots/${bot.id}`} className="flex items-center gap-4 flex-1">
                <div className={`p-3 rounded-xl ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900">{bot.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>{formatDateITUtc(bot.updatedAt)}</span>
                        <span>•</span>
                        <span>{completedCount} risposte</span>
                        {showProject && bot.project?.name && (
                            <>
                                <span>•</span>
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{bot.project.name}</span>
                            </>
                        )}
                    </div>
                </div>
            </Link>

            <div className="flex items-center gap-4">
                {!compact && (
                    <BotStatusToggle botId={bot.id} initialStatus={(bot as any).status} />
                )}

                <div className="flex items-center gap-2">
                    {compact ? (
                        // Compact view (Dashboard recent)
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md max-md:hidden">
                            {completedCount} risp.
                        </span>
                    ) : (
                        // Full view actions can go here
                        <Link
                            href={`/dashboard/bots/${bot.id}/profiles`}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Profili & Lead"
                        >
                            <Users className="w-4 h-4" />
                        </Link>
                    )}

                    <div className="w-px h-4 bg-gray-200 mx-1" />

                    <button
                        onClick={handleDuplicateClick}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Duplica"
                        aria-label={`Duplica bot ${bot.name}`}
                    >
                        <Copy className="w-4 h-4" aria-hidden="true" />
                    </button>

                    <button
                        onClick={handleDeleteClick}
                        disabled={isDeleting}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina"
                        aria-label={`Elimina bot ${bot.name}`}
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
                    </button>
                </div>
            </div>

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Elimina Bot"
                description={`Sei sicuro di voler eliminare "${bot.name}"? Questa azione è irreversibile.${deleteError ? `\n\nErrore: ${deleteError}` : ''}`}
                confirmLabel="Elimina"
                cancelLabel="Annulla"
                variant="destructive"
                onConfirm={handleConfirmDelete}
                loading={isDeleting}
            />

            <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Duplica intervista</DialogTitle>
                        <DialogDescription>
                            Crea una nuova versione basata su questa intervista, cambiando lingua o altri parametri.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Nome</label>
                            <input
                                type="text"
                                value={duplicateName}
                                onChange={(e) => setDuplicateName(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="Nome nuova intervista"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Lingua</label>
                            <select
                                value={duplicateLanguage}
                                onChange={(e) => setDuplicateLanguage(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="it">Italiano</option>
                                <option value="en">English</option>
                                <option value="fr">Français</option>
                                <option value="de">Deutsch</option>
                                <option value="es">Español</option>
                            </select>
                        </div>
                        {duplicateError && (
                            <p className="text-sm text-red-600">{duplicateError}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <button
                            type="button"
                            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                            onClick={() => setShowDuplicateDialog(false)}
                            disabled={isDuplicating}
                        >
                            Annulla
                        </button>
                        <button
                            type="button"
                            className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                            onClick={handleConfirmDuplicate}
                            disabled={isDuplicating}
                        >
                            {isDuplicating ? 'Duplicazione...' : 'Duplica'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
