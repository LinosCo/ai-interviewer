'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeftRight, UserPlus, Loader2, Mail, CheckCircle } from "lucide-react";
import { transferProjectToOrganization } from '@/app/actions/project-tools';
import { createTransferInvite } from '@/app/actions/transfer';
import TransferProjectDialog from '@/components/dashboard/TransferProjectDialog';

interface Organization {
    id: string;
    name: string;
}

interface ProjectTransferSectionProps {
    projectId: string;
    projectName: string;
    currentOrgId: string;
    availableOrganizations: Organization[];
}

export function ProjectTransferSection({
    projectId,
    projectName,
    currentOrgId,
    availableOrganizations
}: ProjectTransferSectionProps) {
    const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
    const [showOwnershipTransfer, setShowOwnershipTransfer] = useState(false);
    const [recipientEmail, setRecipientEmail] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferSuccess, setTransferSuccess] = useState(false);
    const [transferError, setTransferError] = useState('');

    const handleOwnershipTransfer = async () => {
        if (!recipientEmail || !recipientEmail.includes('@')) {
            setTransferError('Inserisci un indirizzo email valido');
            return;
        }

        setIsTransferring(true);
        setTransferError('');
        setTransferSuccess(false);

        try {
            await createTransferInvite({
                itemId: projectId,
                itemType: 'PROJECT',
                recipientEmail: recipientEmail.trim()
            });
            setTransferSuccess(true);
            setRecipientEmail('');
        } catch (error: any) {
            setTransferError(error.message || 'Errore durante l\'invio dell\'invito');
        } finally {
            setIsTransferring(false);
        }
    };

    return (
        <>
            <Card className="border-slate-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5 text-amber-600" />
                        <CardTitle>Trasferisci Progetto</CardTitle>
                    </div>
                    <CardDescription>
                        Sposta questo progetto in un'altra organizzazione o trasferisci la proprietà a un altro utente.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Transfer to another organization */}
                    <div>
                        <Button
                            variant="outline"
                            onClick={() => setIsTransferDialogOpen(true)}
                            className="border-amber-200 text-amber-700 hover:bg-amber-50 font-bold"
                        >
                            <ArrowLeftRight className="w-4 h-4 mr-2" />
                            Trasferisci ad un'altra Organizzazione
                        </Button>
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-white px-2 text-gray-500">oppure</span>
                        </div>
                    </div>

                    {/* Transfer ownership to another user */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <UserPlus className="w-4 h-4 text-indigo-600" />
                                    Trasferisci Proprietà
                                </h4>
                                <p className="text-sm text-gray-500">
                                    Invia un invito per trasferire la proprietà del progetto a un altro utente
                                </p>
                            </div>
                            {!showOwnershipTransfer && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowOwnershipTransfer(true)}
                                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                >
                                    Trasferisci
                                </Button>
                            )}
                        </div>

                        {showOwnershipTransfer && (
                            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="recipientEmail" className="text-sm font-medium">
                                        Email del nuovo proprietario
                                    </Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                id="recipientEmail"
                                                type="email"
                                                placeholder="email@esempio.com"
                                                value={recipientEmail}
                                                onChange={(e) => setRecipientEmail(e.target.value)}
                                                className="pl-10"
                                                disabled={isTransferring}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleOwnershipTransfer}
                                            disabled={isTransferring || !recipientEmail}
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            {isTransferring ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Invio...
                                                </>
                                            ) : (
                                                'Invia Invito'
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {transferError && (
                                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                                        {transferError}
                                    </div>
                                )}

                                {transferSuccess && (
                                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                                        <CheckCircle className="w-4 h-4" />
                                        Invito inviato con successo! Il destinatario riceverà un'email per accettare il trasferimento.
                                    </div>
                                )}

                                <p className="text-xs text-gray-500">
                                    L'utente riceverà un'email con un link per accettare il trasferimento.
                                    Il link sarà valido per 7 giorni.
                                </p>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowOwnershipTransfer(false);
                                        setRecipientEmail('');
                                        setTransferError('');
                                        setTransferSuccess(false);
                                    }}
                                    className="text-gray-500"
                                >
                                    Annulla
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <TransferProjectDialog
                isOpen={isTransferDialogOpen}
                onClose={() => setIsTransferDialogOpen(false)}
                projectName={projectName}
                targetOrganizations={availableOrganizations}
                currentOrgId={currentOrgId}
                onTransfer={(targetOrgId) => transferProjectToOrganization(projectId, targetOrgId)}
            />
        </>
    );
}
