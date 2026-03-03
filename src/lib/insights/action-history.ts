import { prisma } from '@/lib/prisma';
import { buildInsightActionMetadata } from '@/lib/insights/action-metadata';
import {
  mapCMSSuggestionTypeToFallbackKind,
  mapContentKindToCategory,
  type RoutingTipCategory,
} from '@/lib/cms/tip-routing-taxonomy';
import type { ContentKind } from '@/lib/cms/content-kinds';

type JsonObject = Record<string, unknown>;

export type TipHistoryItem = {
  contentKind: string;
  category: RoutingTipCategory | null;
  draftReady: number;
  sent: number;
  discarded: number;
  total: number;
  latestAt: string | null;
};

async function getProjectConnectionIds(projectId: string): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      cmsConnectionId: true,
      newCmsConnection: { select: { id: true } },
    },
  });

  if (!project) return [];

  const shared = await prisma.projectCMSConnection.findMany({
    where: { projectId },
    select: { connectionId: true },
  });

  return Array.from(
    new Set(
      [project.cmsConnectionId, project.newCmsConnection?.id, ...shared.map((item) => item.connectionId)].filter(
        Boolean
      ) as string[]
    )
  );
}

export async function loadTipHistoryByContentKind(projectId?: string): Promise<TipHistoryItem[]> {
  if (!projectId) return [];
  const connectionIds = await getProjectConnectionIds(projectId);
  if (!connectionIds.length) return [];

  const suggestions = await prisma.cMSSuggestion.findMany({
    where: { connectionId: { in: connectionIds } },
    select: {
      type: true,
      status: true,
      sourceSignals: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1200,
  });

  const buckets = new Map<string, TipHistoryItem>();
  for (const suggestion of suggestions) {
    const raw = suggestion.sourceSignals as JsonObject | null;
    const publishRouting = raw?.publishRouting as JsonObject | undefined;
    const contentKind = typeof publishRouting?.contentKind === 'string' ? publishRouting.contentKind : null;
    const fallbackKind = mapCMSSuggestionTypeToFallbackKind(suggestion.type);
    const kind = (contentKind || fallbackKind || 'UNKNOWN') as ContentKind | 'UNKNOWN';

    const existing = buckets.get(kind) || {
      contentKind: kind,
      category: kind === 'UNKNOWN' ? null : mapContentKindToCategory(kind),
      draftReady: 0,
      sent: 0,
      discarded: 0,
      total: 0,
      latestAt: null,
    };

    existing.total += 1;
    if (suggestion.status === 'PENDING') existing.draftReady += 1;
    if (suggestion.status === 'PUSHED' || suggestion.status === 'PUBLISHED') existing.sent += 1;
    if (suggestion.status === 'REJECTED' || suggestion.status === 'FAILED') existing.discarded += 1;

    const eventAt = suggestion.updatedAt || suggestion.createdAt;
    if (!existing.latestAt || new Date(eventAt) > new Date(existing.latestAt)) {
      existing.latestAt = eventAt.toISOString();
    }
    buckets.set(kind, existing);
  }

  return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
}

export function enrichInsightsWithActionMetadata(insights: any[], historyByKind: TipHistoryItem[]) {
  const historyMap = new Map(historyByKind.map((item) => [item.contentKind, item]));

  return insights.map((insight) => {
    const actions = Array.isArray(insight?.suggestedActions) ? insight.suggestedActions : [];
    const enrichedActions = actions.map((action: any) => {
      const metadata = buildInsightActionMetadata(action);
      const history = metadata.contentKind ? historyMap.get(metadata.contentKind) : undefined;
      const normalizedEvidence = Array.isArray(action?.evidence) && action.evidence.length > 0
        ? action.evidence
        : [{
            sourceType: 'strategy',
            sourceRef: 'legacy:insight_action',
            detail: String(action?.reasoning || 'Evidenza strutturata non disponibile in questo tip legacy.')
          }];
      return {
        ...action,
        ...metadata,
        workflowStatus: action.workflowStatus || 'draft',
        strategicAlignment: action.strategicAlignment || 'Allineamento strategico da validare sulla base del piano attuale.',
        evidence: normalizedEvidence,
        coordination: action.coordination || 'Definire coordinamento tra canali in fase di revisione del tip.',
        lifecycleHistory: history
          ? {
              draftReady: history.draftReady,
              sent: history.sent,
              discarded: history.discarded,
              total: history.total,
            }
          : null,
      };
    });

    return {
      ...insight,
      suggestedActions: enrichedActions,
    };
  });
}
