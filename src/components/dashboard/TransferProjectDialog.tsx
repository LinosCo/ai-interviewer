'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Icons } from '@/components/ui/business-tuner/Icons';
import { showToast } from '@/components/toast';
import { ArrowRight, Building2, Clock3, Zap } from 'lucide-react';

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
    const selectedOrganization = useMemo(
        () => targetOrganizations.find((org) => org.id === selectedOrgId),
        [targetOrganizations, selectedOrgId]
    );
    const currentOrganization = useMemo(
        () => targetOrganizations.find((org) => org.id === currentOrgId),
        [targetOrganizations, currentOrgId]
    );

    useEffect(() => {
        const fallback = targetOrganizations.find((org) => org.id !== currentOrgId)?.id || currentOrgId;
        setSelectedOrgId(fallback);
    }, [isOpen, currentOrgId, targetOrganizations]);

    const handleSubmit = async () => {
        if (selectedOrgId === currentOrgId) {
            showToast('Seleziona un\'organizzazione diversa da quella attuale', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await onTransfer(selectedOrgId);
            if (result?.mode === 'pending') {
                showToast(`Richiesta inviata a ${result.recipientEmail}. In attesa di approvazione.`, 'success');
            } else {
                showToast('Progetto trasferito con successo', 'success');
            }
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
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Building2 className="w-5 h-5 text-amber-500" />
                        Trasferisci Progetto &quot;{projectName}&quot;
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                            Flusso
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="rounded-md bg-white px-2 py-1 text-slate-700">{currentOrganization?.name || 'Organizzazione corrente'}</span>
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="rounded-md bg-amber-100 px-2 py-1 font-semibold text-amber-800">{selectedOrganization?.name || 'Seleziona destinazione'}</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Organizzazione di destinazione</label>
                        <select
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30"
                            disabled={isSubmitting}
                        >
                            {targetOrganizations.map((org) => (
                                <option key={org.id} value={org.id} disabled={org.id === currentOrgId}>
                                    {org.name} {org.id === currentOrgId ? '(Corrente)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Regole</div>
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                <Zap className="mt-0.5 h-4 w-4 text-emerald-600" />
                                <p>Immediato se sei admin/owner in entrambe le organizzazioni.</p>
                            </div>
                            <div className="flex items-start gap-2">
                                <Clock3 className="mt-0.5 h-4 w-4 text-amber-600" />
                                <p>Altrimenti viene inviata richiesta di approvazione all&apos;admin della org target.</p>
                            </div>
                        </div>
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
