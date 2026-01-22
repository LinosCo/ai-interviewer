'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectAccessManager } from '../access-manager';

interface ProjectUserManagementDialogProps {
    projectId: string;
}

export function ProjectUserManagementDialog({ projectId }: ProjectUserManagementDialogProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold bg-white text-slate-700 border-slate-200 hover:border-amber-500 transition-all"
                >
                    <Users className="w-4 h-4 mr-2" />
                    Gestisci Utenti
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-600" />
                        Gestione Utenti Progetto
                    </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    <ProjectAccessManager
                        projectId={projectId}
                        variant="compact"
                        onClose={() => setOpen(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
