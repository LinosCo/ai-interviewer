'use client';

import { deleteBotAction } from '@/app/actions';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { MethodologyBadge } from '@/components/ui/MethodologyBadge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface BotCardProps {
    bot: any;
    canDelete: boolean;
}

export default function BotCard({ bot, canDelete }: BotCardProps) {
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
        try {
            await deleteBotAction(bot.id);
        } catch (err) {
            setDeleteError("Eliminazione fallita. Potresti non avere i permessi.");
            setIsDeleting(false);
            throw err;
        }
    };

    if (isDeleting) {
        return <div className="border p-4 rounded bg-red-50 text-red-500 text-sm animate-pulse">Deleting...</div>;
    }

    return (
        <>
            <Link href={`/dashboard/bots/${bot.id}`} className="block border p-4 rounded hover:border-amber-500 hover:shadow-md transition bg-white relative group">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="font-medium text-gray-800">{bot.name}</div>
                        <div className="text-sm text-gray-500 mt-1 truncate max-w-[150px]">{bot.description || 'Nessuna descrizione'}</div>
                    </div>
                    {canDelete && (
                        <button
                            onClick={handleDeleteClick}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                            title="Elimina Bot"
                            aria-label={`Elimina bot ${bot.name}`}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <MethodologyBadge />
                </div>
            </Link>

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Elimina Bot"
                description={`Sei sicuro di voler eliminare "${bot.name}"? Questa azione non può essere annullata.${deleteError ? `\n\nErrore: ${deleteError}` : ''}`}
                confirmLabel="Elimina"
                cancelLabel="Annulla"
                variant="destructive"
                onConfirm={handleConfirmDelete}
                loading={isDeleting}
            />
        </>
    );
}
