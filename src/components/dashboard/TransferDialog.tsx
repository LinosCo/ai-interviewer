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
import { Folder, Mail, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createTransferInvite, ItemTransferType } from '@/app/actions/transfer';

interface Project {
    id: string;
    name: string;
}

interface TransferDialogProps {
    isOpen: boolean;
    onClose: () => void;
    itemName: string;
    itemId: string;
    itemType: ItemTransferType;
    targetProjects: Project[];
    currentProjectId: string;
    onTransfer: (targetProjectId: string) => Promise<any>;
}

export default function TransferDialog({
    isOpen,
    onClose,
    itemName,
    itemId,
    itemType,
    targetProjects,
    currentProjectId,
    onTransfer
}: TransferDialogProps) {
    const [selectedProjectId, setSelectedProjectId] = useState(currentProjectId);
    const [recipientEmail, setRecipientEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('internal');

    const handleInternalTransfer = async () => {
        if (selectedProjectId === currentProjectId) {
            showToast('Seleziona un progetto diverso da quello attuale', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await onTransfer(selectedProjectId);
            showToast('✅ Trasferimento completato con successo!', 'success');
            onClose();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Errore durante il trasferimento', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailTransfer = async () => {
        if (!recipientEmail || !recipientEmail.includes('@')) {
            showToast('Inserisci un indirizzo email valido', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await createTransferInvite({
                itemId,
                itemType,
                recipientEmail
            });
            showToast('✅ Invito di trasferimento inviato via email!', 'success');
            onClose();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Errore durante l\'invio dell\'invito', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Folder className="w-5 h-5 text-amber-500" />
                        Trasferisci "{itemName}"
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 p-1 rounded-xl">
                        <TabsTrigger value="internal" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Interno</TabsTrigger>
                        <TabsTrigger value="email" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Via Email</TabsTrigger>
                    </TabsList>

                    <TabsContent value="internal" className="space-y-4 py-2 mt-0">
                        <p className="text-sm text-gray-500">
                            Sposta questo elemento in un altro dei tuoi progetti.
                        </p>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Progetto di destinazione</label>
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                disabled={isSubmitting}
                            >
                                {targetProjects.map((p) => (
                                    <option key={p.id} value={p.id} disabled={p.id === currentProjectId}>
                                        {p.name} {p.id === currentProjectId ? '(Corrente)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                disabled={isSubmitting}
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleInternalTransfer}
                                disabled={isSubmitting || selectedProjectId === currentProjectId}
                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Icons.Loader2 className="w-4 h-4 animate-spin" />
                                ) : null}
                                Trasferisce
                            </button>
                        </div>
                    </TabsContent>

                    <TabsContent value="email" className="space-y-4 py-2 mt-0">
                        <p className="text-sm text-gray-500">
                            Invia questo elemento a un altro utente tramite il suo indirizzo email.
                        </p>

                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Email del destinatario</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="email"
                                    placeholder="utente@esempio.com"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                disabled={isSubmitting}
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleEmailTransfer}
                                disabled={isSubmitting || !recipientEmail}
                                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Icons.Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                Invia Invito
                            </button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
