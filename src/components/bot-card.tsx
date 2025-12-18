'use client';

import { deleteBotAction } from '@/app/actions';
import { Trash2, MessageSquare, Edit } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface BotCardProps {
    bot: any;
    canDelete: boolean;
}

export default function BotCard({ bot, canDelete }: BotCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (confirm(`Are you sure you want to delete the bot "${bot.name}"? This action cannot be undone.`)) {
            setIsDeleting(true);
            try {
                await deleteBotAction(bot.id);
            } catch (err) {
                alert("Failed to delete bot. You may not have permission.");
                setIsDeleting(false);
            }
        }
    };

    if (isDeleting) {
        return <div className="border p-4 rounded bg-red-50 text-red-500 text-sm animate-pulse">Deleting...</div>;
    }

    return (
        <Link href={`/dashboard/bots/${bot.id}`} className="block border p-4 rounded hover:border-amber-500 hover:shadow-md transition bg-white relative group">
            <div className="flex justify-between items-start">
                <div>
                    <div className="font-medium text-gray-800">{bot.name}</div>
                    <div className="text-sm text-gray-500 mt-1 truncate max-w-[150px]">{bot.description || 'No description'}</div>
                </div>
                {canDelete && (
                    <button
                        onClick={handleDelete}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Delete Bot"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <MessageSquare className="w-3 h-3" />
                <span>Chatbot</span>
            </div>
        </Link>
    );
}
