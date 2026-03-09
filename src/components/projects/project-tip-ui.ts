import type { ProjectTipDetailSnapshot, ProjectTipSnapshot } from '@/lib/projects/project-intelligence-types';

export type TipRoutingDraft = {
  destinationType: string;
  destinationLabel: string;
  policyMode: 'MANUAL' | 'AUTO_APPROVE' | 'AUTO_EXECUTE';
  channelIntent: string;
  notes: string;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseTipRoutingDraft(suggestedRouting: unknown): TipRoutingDraft {
  const record = toRecord(suggestedRouting);

  return {
    destinationType: typeof record?.destinationType === 'string' ? record.destinationType : '',
    destinationLabel: typeof record?.destinationLabel === 'string' ? record.destinationLabel : '',
    policyMode:
      record?.policyMode === 'AUTO_APPROVE' || record?.policyMode === 'AUTO_EXECUTE'
        ? record.policyMode
        : 'MANUAL',
    channelIntent: typeof record?.channelIntent === 'string' ? record.channelIntent : '',
    notes: typeof record?.notes === 'string' ? record.notes : '',
  };
}

export function buildTipRoutingPayload(
  draft: TipRoutingDraft,
  currentSuggestedRouting: unknown,
): Record<string, unknown> {
  const current = toRecord(currentSuggestedRouting) ?? {};

  return {
    ...current,
    destinationType: draft.destinationType || null,
    destinationLabel: draft.destinationLabel || null,
    policyMode: draft.policyMode,
    channelIntent: draft.channelIntent || null,
    notes: draft.notes || null,
  };
}

export function getTipOperationalState(
  tip: ProjectTipSnapshot,
  detail?: ProjectTipDetailSnapshot | null,
): { key: string; label: string; className: string; description: string } {
  const hasFailed = Boolean(
    detail?.executions.some((execution) => execution.status === 'FAILED')
      || detail?.routes.some((route) => route.status === 'FAILED'),
  );
  if (hasFailed) {
    return {
      key: 'failed',
      label: 'Da correggere',
      className: 'border-red-200 bg-red-50 text-red-700',
      description: 'Almeno un invio o una route ha generato un errore.',
    };
  }

  const hasCompletedExecution = Boolean(detail?.executions.some((execution) => execution.status === 'SUCCEEDED'));
  if (hasCompletedExecution || tip.status === 'COMPLETED') {
    return {
      key: 'completed',
      label: 'Completato',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      description: 'Il tip ha gia prodotto un esito operativo tracciato.',
    };
  }

  if (tip.status === 'AUTOMATED') {
    return {
      key: 'automated',
      label: 'Automatizzato',
      className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      description: 'Il tip puo entrare in un flusso automatico senza passaggi manuali.',
    };
  }

  const hasDispatched = Boolean(detail?.routes.some((route) => route.status === 'DISPATCHED'));
  if (hasDispatched || tip.status === 'ROUTED') {
    return {
      key: 'awaiting_approval',
      label: 'In attesa di approvazione',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      description: 'Il tip ha una destinazione pronta ma serve ancora conferma o completamento.',
    };
  }

  if ((tip.routeCount ?? 0) > 0 || tip.routingStatus === 'PLANNED') {
    return {
      key: 'ready_to_route',
      label: 'Pronto da instradare',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
      description: 'La logica e chiara e il routing puo essere configurato o attivato.',
    };
  }

  return {
    key: 'manual_only',
    label: 'Solo manuale',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    description: 'Il tip esiste ma non ha ancora una strada operativa configurata.',
  };
}

export const ROUTING_POLICY_LABELS: Record<TipRoutingDraft['policyMode'], string> = {
  MANUAL: 'Solo manuale',
  AUTO_APPROVE: 'Approvazione automatica',
  AUTO_EXECUTE: 'Esecuzione automatica',
};

export function formatRouteStatus(status: string): string {
  const labels: Record<string, string> = {
    PLANNED: 'Pianificata',
    READY: 'Pronta',
    DISPATCHED: 'Inviata',
    SUCCEEDED: 'Completata',
    FAILED: 'Da correggere',
  };
  return labels[status] || status;
}

export function formatExecutionStatus(status: string): string {
  const labels: Record<string, string> = {
    RUNNING: 'In corso',
    SUCCEEDED: 'Riuscita',
    FAILED: 'Fallita',
    PENDING: 'In attesa',
  };
  return labels[status] || status;
}
