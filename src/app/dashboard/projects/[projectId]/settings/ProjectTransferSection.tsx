'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { transferProjectToOrganization } from '@/app/actions/project-tools';
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

    return (
        <>
            <Card className="border-slate-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5 text-amber-600" />
                        <CardTitle>Trasferisci Progetto</CardTitle>
                    </div>
                    <CardDescription>
                        Sposta questo progetto in un'altra organizzazione di cui sei amministratore.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        onClick={() => setIsTransferDialogOpen(true)}
                        className="border-amber-200 text-amber-700 hover:bg-amber-50 font-bold"
                    >
                        Trasferisci ad un'altra Organizzazione
                    </Button>
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
