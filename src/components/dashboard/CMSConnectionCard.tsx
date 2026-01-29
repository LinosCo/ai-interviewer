'use client';

import { ExternalLink, Settings, Trash2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface CMSConnectionCardProps {
    connection: {
        id: string;
        name: string;
        status: 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISABLED';
        cmsPublicUrl?: string;
        cmsDashboardUrl?: string;
        lastPingAt?: Date;
        projectId: string;
        projectName: string;
    };
    canManage: boolean;
    onTransfer?: (connectionId: string) => void;
    onDelete?: (connectionId: string) => void;
}

export default function CMSConnectionCard({ connection, canManage, onTransfer, onDelete }: CMSConnectionCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const statusColors = {
        ACTIVE: 'bg-green-100 text-green-700 border-green-200',
        PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        ERROR: 'bg-red-100 text-red-700 border-red-200',
        DISABLED: 'bg-gray-100 text-gray-700 border-gray-200'
    };

    const statusLabels = {
        ACTIVE: 'Attivo',
        PENDING: 'In attesa',
        ERROR: 'Errore',
        DISABLED: 'Disabilitato'
    };

    const handleDelete = async () => {
        if (!confirm('Sei sicuro di voler eliminare questa connessione CMS? Questa azione non può essere annullata.')) {
            return;
        }
        setIsDeleting(true);
        try {
            await onDelete?.(connection.id);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="platform-card rounded-xl p-5 hover:border-amber-200 transition-all">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-gray-900">{connection.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${statusColors[connection.status]}`}>
                            {statusLabels[connection.status]}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500">Progetto: {connection.projectName}</p>
                    {connection.lastPingAt && (
                        <p className="text-xs text-gray-400 mt-1">
                            Ultimo ping: {new Date(connection.lastPingAt).toLocaleString('it-IT')}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {connection.cmsPublicUrl && (
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={() => window.open(connection.cmsPublicUrl, '_blank')}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Accedi al Sito
                    </Button>
                )}

                {canManage && connection.cmsDashboardUrl && (
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(connection.cmsDashboardUrl, '_blank')}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Dashboard CMS
                    </Button>
                )}

                {canManage && (
                    <>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = `/dashboard/cms/${connection.id}/settings`}
                        >
                            <Settings className="w-3.5 h-3.5" />
                            Impostazioni
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onTransfer?.(connection.id)}
                        >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Trasferisci
                        </Button>

                        <Button
                            size="sm"
                            variant="danger"
                            loading={isDeleting}
                            loadingText="Eliminazione..."
                            onClick={handleDelete}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Elimina
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
