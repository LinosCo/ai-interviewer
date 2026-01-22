'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, X, Mail, Shield, AlertCircle, Loader2, Crown, LogOut, ArrowRightLeft, Users } from "lucide-react";
import { showToast } from "@/components/toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Member {
    id: string;
    userId: string;
    email: string;
    name: string | null;
    role: 'OWNER' | 'MEMBER';
    createdAt: string;
}

interface AccessData {
    members: Member[];
    isPersonal: boolean;
    currentUserRole: 'OWNER' | 'MEMBER';
}

interface ProjectAccessManagerProps {
    projectId: string;
    variant?: 'full' | 'compact';
    onClose?: () => void;
}

export function ProjectAccessManager({ projectId, variant = 'full', onClose }: ProjectAccessManagerProps) {
    const [accessData, setAccessData] = useState<AccessData | null>(null);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [inviting, setInviting] = useState(false);
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);
    const [selectedMemberForTransfer, setSelectedMemberForTransfer] = useState<Member | null>(null);
    const [transferring, setTransferring] = useState(false);

    const fetchAccess = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/access`);
            if (res.ok) {
                const data = await res.json();
                setAccessData(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccess();
    }, [projectId]);

    const handleShare = async () => {
        if (!email) return;
        setInviting(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                showToast("Progetto condiviso con successo!");
                setEmail('');
                fetchAccess();
            } else {
                const data = await res.json();
                showToast(data.error || "Errore durante la condivisione", "error");
            }
        } catch (err) {
            showToast("Errore di rete", "error");
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (userId: string) => {
        try {
            const res = await fetch(`/api/projects/${projectId}/access?userId=${userId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showToast("Accesso rimosso");
                fetchAccess();
            } else {
                const text = await res.text();
                showToast(text || "Errore durante la rimozione", "error");
            }
        } catch (err) {
            showToast("Errore durante la rimozione", "error");
        }
    };

    const handleLeave = async () => {
        if (!confirm('Sei sicuro di voler abbandonare questo progetto?')) return;

        try {
            const res = await fetch(`/api/projects/${projectId}/access?userId=self`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showToast("Hai abbandonato il progetto");
                window.location.href = '/dashboard';
            } else {
                const text = await res.text();
                showToast(text || "Errore", "error");
            }
        } catch (err) {
            showToast("Errore durante l'uscita", "error");
        }
    };

    const handleTransferOwnership = async () => {
        if (!selectedMemberForTransfer) return;
        setTransferring(true);

        try {
            const res = await fetch(`/api/projects/${projectId}/access`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'transfer_ownership',
                    targetUserId: selectedMemberForTransfer.userId
                })
            });

            if (res.ok) {
                showToast("Proprietà trasferita con successo!");
                setTransferDialogOpen(false);
                setSelectedMemberForTransfer(null);
                fetchAccess();
            } else {
                const data = await res.json();
                showToast(data.error || "Errore durante il trasferimento", "error");
            }
        } catch (err) {
            showToast("Errore di rete", "error");
        } finally {
            setTransferring(false);
        }
    };

    const openTransferDialog = (member: Member) => {
        setSelectedMemberForTransfer(member);
        setTransferDialogOpen(true);
    };

    const isOwner = accessData?.currentUserRole === 'OWNER';
    const isPersonal = accessData?.isPersonal || false;
    const isCompact = variant === 'compact';

    const content = (
        <>
            {/* Invite form - only for owners of non-personal projects */}
            {isOwner && !isPersonal && (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="email"
                            placeholder="Collaboratore@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-all"
                        />
                    </div>
                    <Button
                        onClick={handleShare}
                        disabled={inviting || !email}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
                    >
                        {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invita"}
                    </Button>
                </div>
            )}

            <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Membri del progetto
                </h4>
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-200" />
                    </div>
                ) : !accessData || accessData.members.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                        <p className="text-xs text-slate-500 italic">Nessun membro.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {accessData.members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl group hover:border-amber-100 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                        member.role === 'OWNER'
                                            ? 'bg-amber-100 text-amber-600'
                                            : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {member.name?.[0] || member.email[0]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-slate-900">{member.name || 'Utente'}</p>
                                            {member.role === 'OWNER' && (
                                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 text-[10px]">
                                                    <Crown className="w-3 h-3 mr-1" />
                                                    Proprietario
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium">{member.email}</p>
                                    </div>
                                </div>
                                {/* Actions for members (not owners) when current user is owner */}
                                {member.role !== 'OWNER' && isOwner && (
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openTransferDialog(member)}
                                            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full"
                                            title="Trasferisci proprietà"
                                        >
                                            <ArrowRightLeft className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemove(member.userId)}
                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                            title="Rimuovi dal progetto"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Leave project button - only for non-owners of non-personal projects */}
            {!isOwner && !isPersonal && (
                <Button
                    variant="outline"
                    onClick={handleLeave}
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Abbandona progetto
                </Button>
            )}

            {!isCompact && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex gap-3">
                    <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Nota:</strong> I membri possono visualizzare e gestire i bot all'interno di questo progetto. Solo il proprietario può invitare altri membri, trasferire la proprietà o eliminare il progetto.
                    </p>
                </div>
            )}

            {/* Transfer Ownership Dialog */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                            Trasferisci Proprietà
                        </DialogTitle>
                        <DialogDescription>
                            Stai per trasferire la proprietà di questo progetto a <strong>{selectedMemberForTransfer?.name || selectedMemberForTransfer?.email}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                            <strong>Attenzione:</strong> Dopo il trasferimento diventerai un membro normale e non potrai più gestire gli accessi o eliminare il progetto. Questa azione non può essere annullata.
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setTransferDialogOpen(false)}
                            disabled={transferring}
                        >
                            Annulla
                        </Button>
                        <Button
                            onClick={handleTransferOwnership}
                            disabled={transferring}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {transferring ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Conferma Trasferimento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );

    // Compact variant: no card wrapper
    if (isCompact) {
        return <div className="space-y-6">{content}</div>;
    }

    // Full variant: with card wrapper
    return (
        <Card className="border-slate-200">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-600" />
                    <CardTitle>Gestione Accessi</CardTitle>
                </div>
                <CardDescription>
                    {isPersonal
                        ? "Questo è il tuo progetto personale. Non può essere condiviso con altri."
                        : "Condividi questo progetto con altri collaboratori inserendo la loro email."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {content}
            </CardContent>
        </Card>
    );
}
