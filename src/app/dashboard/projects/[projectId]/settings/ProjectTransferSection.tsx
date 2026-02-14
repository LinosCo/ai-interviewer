'use client';

import { useState } from 'react';
import { ArrowLeftRight, Info } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TransferProjectDialog from '@/components/dashboard/TransferProjectDialog';
import { transferProjectToOrganization } from '@/app/actions/project-tools';

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
            <ArrowLeftRight className="h-5 w-5 text-amber-600" />
            <CardTitle>Trasferimento Organizzazione</CardTitle>
          </div>
          <CardDescription>
            Sposta il progetto tra organizzazioni. I tool rimangono associati e vengono riallineati automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <Info className="h-4 w-4" />
              Regola di trasferimento
            </div>
            <p>
              Il trasferimento è immediato se chi lo avvia è ADMIN o OWNER sia nella org sorgente che in quella di destinazione.
              Negli altri casi viene creata una richiesta di approvazione.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => setIsTransferDialogOpen(true)}
            className="border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Trasferisci progetto
          </Button>
        </CardContent>
      </Card>

      <TransferProjectDialog
        isOpen={isTransferDialogOpen}
        onClose={() => setIsTransferDialogOpen(false)}
        projectName={projectName}
        targetOrganizations={availableOrganizations}
        currentOrgId={currentOrgId}
        onTransfer={(targetOrgId: string) => transferProjectToOrganization(projectId, targetOrgId)}
      />
    </>
  );
}
