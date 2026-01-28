'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { showToast } from '@/components/toast';
import { Building2 } from 'lucide-react';

interface Organization {
    id: string;
    name: string;
}

interface TransferProjectDialogProps {
    isOpen: boolean;
    onClose: () => void;
    projectName: string;
    targetOrganizations: Organization[];
    currentOrgId: string;
    onTransfer: (targetOrgId: string) => Promise<any>;
}

export default function TransferProjectDialog({
    isOpen,
    onClose,
    projectName,
    targetOrganizations,
    currentOrgId,
    onTransfer
}: TransferProjectDialogProps) {
    const [selectedOrgId, setSelectedOrgId] = useState(currentOrgId);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (selectedOrgId === currentOrgId) {
            showToast('Seleziona un\'organizzazione diversa da quella attuale', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await onTransfer(selectedOrgId);
            showToast('✅ Progetto trasferito con successo!', 'success');
            onClose();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Errore durante il trasferimento del progetto', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Building2 className="w-5 h-5 text-amber-500" />
                        Trasferisci Progetto "{projectName}"
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <p className="text-sm text-gray-500">
                        Seleziona l'organizzazione di destinazione. Il progetto e tutti i suoi tool (bot, integrazioni, ecc.) verranno spostati nell'organizzazione selezionata.
                    </p>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Organizzazione di destinazione</label>
                        <select
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                            className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                            disabled={isSubmitting}
                        >
                            {targetOrganizations.map((org) => (
                                <option key={org.id} value={org.id} disabled={org.id === currentOrgId}>
                                    {org.name} {org.id === currentOrgId ? '(Corrente)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        disabled={isSubmitting}
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || selectedOrgId === currentOrgId}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <Icons.Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        Conferma Trasferimento
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
