'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, X, Mail, Shield, AlertCircle, Loader2 } from "lucide-react";
import { showToast } from "@/components/toast";

interface AccessEntry {
    id: string;
    userId: string;
    user: {
        id: string;
        name: string | null;
        email: string;
    };
}

export function ProjectAccessManager({ projectId }: { projectId: string }) {
    const [accessList, setAccessList] = useState<AccessEntry[]>([]);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [inviting, setInviting] = useState(false);

    const fetchAccess = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/access`);
            if (res.ok) {
                const data = await res.json();
                setAccessList(data);
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
            }
        } catch (err) {
            showToast("Errore durante la rimozione", "error");
        }
    };

    return (
        <Card className="border-slate-200">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-600" />
                    <CardTitle>Gestione Accessi</CardTitle>
                </div>
                <CardDescription>
                    Condividi questo progetto con altri collaboratori inserendo la loro email.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

                <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Persone con accesso
                    </h4>
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-200" />
                        </div>
                    ) : accessList.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                            <p className="text-xs text-slate-500 italic">Nessun collaboratore esterno aggiunto.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {accessList.map((access) => (
                                <div key={access.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl group hover:border-amber-100 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xs uppercase">
                                            {access.user.name?.[0] || access.user.email[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{access.user.name || 'Utente'}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">{access.user.email}</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemove(access.userId)}
                                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex gap-3">
                    <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Nota:</strong> Gli invitati potranno visualizzare e gestire i bot all'interno di questo progetto, ma solo il proprietario può eliminarlo o invitarne altri.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
