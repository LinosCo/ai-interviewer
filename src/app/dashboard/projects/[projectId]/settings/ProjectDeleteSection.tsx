'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { showToast } from '@/components/toast';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ProjectDeleteSectionProps {
    projectId: string;
    projectName: string;
}

export function ProjectDeleteSection({ projectId, projectName }: ProjectDeleteSectionProps) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const router = useRouter();

    const handleDelete = async () => {
        if (confirmText !== projectName) {
            showToast('Inserisci il nome corretto del progetto', 'error');
            return;
        }

        setDeleting(true);
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showToast('Progetto eliminato. I tool sono stati spostati nel progetto di default dell\'organizzazione.');
                router.push('/dashboard/projects');
            } else {
                const data = await res.json().catch(() => ({ error: 'Errore durante l\'eliminazione' }));
                showToast(data.error || 'Errore durante l\'eliminazione', 'error');
            }
        } catch (err) {
            showToast('Errore di rete', 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <Card className="border-red-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                        <Trash2 className="w-5 h-5" />
                        Elimina Progetto
                    </CardTitle>
                    <CardDescription>
                        Elimina definitivamente questo progetto. I tool verranno spostati nel progetto di default dell&apos;organizzazione.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div className="text-sm text-red-800">
                            <strong>Attenzione:</strong> Questa azione non può essere annullata. Tutti i membri perderanno l&apos;accesso a questo progetto. I bot e le configurazioni di visibilità verranno riassegnati al progetto di default dell&apos;organizzazione.
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => setDeleteDialogOpen(true)}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Elimina Progetto
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="w-5 h-5" />
                            Conferma Eliminazione
                        </DialogTitle>
                        <DialogDescription>
                            Stai per eliminare il progetto <strong>{projectName}</strong>. Questa azione è irreversibile.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                            <p className="text-sm text-amber-800">
                                <strong>Cosa succederà:</strong>
                            </p>
                            <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                                <li>I bot verranno spostati nel progetto di default dell&apos;organizzazione</li>
                                <li>I brand di visibilità manterranno un progetto associato (nessun orfano)</li>
                                <li>Tutti i membri perderanno l'accesso</li>
                            </ul>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Scrivi <strong>{projectName}</strong> per confermare:
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={projectName}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteDialogOpen(false);
                                setConfirmText('');
                            }}
                            disabled={deleting}
                        >
                            Annulla
                        </Button>
                        <Button
                            onClick={handleDelete}
                            disabled={deleting || confirmText !== projectName}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Elimina Definitivamente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
