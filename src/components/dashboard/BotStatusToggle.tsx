'use client';

import { useState } from 'react';
import { ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { toggleBotStatusAction } from '@/actions/bot-actions';
import { useRouter } from 'next/navigation';

interface BotStatusToggleProps {
    botId: string;
    initialStatus: string;
}

export function BotStatusToggle({ botId, initialStatus }: BotStatusToggleProps) {
    const [status, setStatus] = useState(initialStatus);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const isPublished = status === 'PUBLISHED';

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsLoading(true);
        const result = await toggleBotStatusAction(botId);

        if (result.success && result.status) {
            setStatus(result.status);
            router.refresh();
        } else {
            alert(result.error || 'Errore durante l\'aggiornamento dello stato');
        }
        setIsLoading(false);
    };

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`flex items-center gap-2 px-2 py-1 rounded-md transition-all ${isPublished
                    ? 'text-green-700 bg-green-50 hover:bg-green-100'
                    : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
                }`}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : isPublished ? (
                <ToggleRight className="w-5 h-5 text-green-600" />
            ) : (
                <ToggleLeft className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-xs font-medium uppercase tracking-wider">
                {isPublished ? 'Attivo' : 'Bozza'}
            </span>
        </button>
    );
}
