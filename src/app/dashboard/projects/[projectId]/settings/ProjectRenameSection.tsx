'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Loader2, Check } from "lucide-react";
import { showToast } from '@/components/toast';
import { useRouter } from 'next/navigation';

interface ProjectRenameSectionProps {
    projectId: string;
    projectName: string;
}

export function ProjectRenameSection({ projectId, projectName }: ProjectRenameSectionProps) {
    const [name, setName] = useState(projectName);
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    const hasChanges = name !== projectName && name.trim().length > 0;

    const handleSave = async () => {
        if (!hasChanges) return;

        setSaving(true);
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });

            if (res.ok) {
                showToast('Nome progetto aggiornato');
                router.refresh();
            } else {
                const text = await res.text();
                showToast(text || 'Errore durante il salvataggio', 'error');
            }
        } catch (err) {
            showToast('Errore di rete', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="border-slate-200">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-amber-600" />
                    <CardTitle>Nome Progetto</CardTitle>
                </div>
                <CardDescription>Modifica il nome di questo progetto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nome progetto"
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-all"
                    />
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                Salva
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
