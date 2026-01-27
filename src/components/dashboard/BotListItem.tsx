'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageSquare, Bot, Trash2, Loader2, Users } from 'lucide-react';
import { deleteBotAction } from '@/actions/bot-actions';
import { BotStatusToggle } from './BotStatusToggle';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface BotListItemProps {
    bot: {
        id: string;
        name: string;
        botType: string;
        conversations: { id: string; status: string; completedAt: string | null }[];
        updatedAt: string;
        project?: { id: string; name: string } | null;
    };
    compact?: boolean;
    showProject?: boolean;
}

export function BotListItem({ bot, compact = false, showProject = false }: BotListItemProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

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
                        <span>{new Date(bot.updatedAt).toLocaleDateString('it-IT')}</span>
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
        </div>
    );
}
