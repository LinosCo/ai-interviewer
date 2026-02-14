'use client';

import { useState } from 'react';
import { ArrowLeftRight, Clock3, Info, ShieldCheck, Zap } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const transferableOrganizations = availableOrganizations.filter((org) => org.id !== currentOrgId);

  return (
    <>
      <Card className="overflow-hidden border-slate-200">
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
          <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-amber-50 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-white text-slate-700">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Sicurezza attiva
              </Badge>
              <Badge variant="secondary" className="bg-white text-slate-700">
                {transferableOrganizations.length} org destinazione
              </Badge>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>
                  <span className="font-semibold text-slate-900">Immediato</span> se chi avvia è ADMIN/OWNER in org sorgente e destinazione.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 text-amber-600" />
                <p>
                  <span className="font-semibold text-slate-900">Con approvazione</span> negli altri casi: viene inviata richiesta a un admin della org target.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <Info className="h-4 w-4" />
              Cosa viene trasferito
            </div>
            <p>Il progetto resta unico: bot, integrazioni e monitor rimangono agganciati e vengono riallineati automaticamente all&apos;organizzazione di destinazione.</p>
          </div>

          <Button
            variant="outline"
            onClick={() => setIsTransferDialogOpen(true)}
            className="w-full border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
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
