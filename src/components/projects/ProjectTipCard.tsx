import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectTipSnapshot } from '@/lib/projects/project-intelligence-types';

interface ProjectTipCardProps {
  tip: ProjectTipSnapshot;
  operationalState: {
    label: string;
    className: string;
    description: string;
  };
  isExpanded: boolean;
  onToggleDetails: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  children?: ReactNode;
}

export function ProjectTipCard({
  tip,
  operationalState,
  isExpanded,
  onToggleDetails,
  onEdit,
  onDuplicate,
  children,
}: ProjectTipCardProps) {
  return (
    <Card className="overflow-hidden border-slate-200 transition-all hover:border-amber-200 hover:shadow-xl hover:shadow-slate-200/40">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">{tip.originType}</Badge>
              <Badge variant="outline" className="text-[10px] uppercase">{tip.status}</Badge>
              <Badge variant="outline" className={`text-[10px] uppercase ${operationalState.className}`}>
                {operationalState.label}
              </Badge>
              {tip.contentKind ? (
                <Badge variant="outline" className="text-[10px] uppercase">{tip.contentKind}</Badge>
              ) : null}
            </div>
            <CardTitle className="text-xl font-black leading-tight text-slate-900">{tip.title}</CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 text-slate-600">
              {tip.summary || operationalState.description}
            </CardDescription>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span>Evidenze: {tip.evidenceCount ?? 0}</span>
              <span>Route: {tip.routeCount ?? 0}</span>
              <span>Esecuzioni: {tip.executionCount ?? 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full px-4 text-xs" onClick={onToggleDetails}>
              {isExpanded ? 'Nascondi' : 'Dettagli'}
            </Button>
            <Button variant="outline" size="sm" className="rounded-full px-4 text-xs" onClick={onEdit}>
              Modifica
            </Button>
            <Button variant="outline" size="sm" className="rounded-full px-4 text-xs" onClick={onDuplicate}>
              Duplica
            </Button>
          </div>
        </div>
      </CardHeader>

      {children ? <CardContent className="pt-0">{children}</CardContent> : null}
    </Card>
  );
}
