import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  CATEGORY_TO_CONTENT_KINDS,
  ROUTING_TIP_CATEGORY_LABELS,
  type RoutingTipCategory,
  mapCMSSuggestionTypeToFallbackKind,
  mapContentKindToCategory,
  mapSuggestionTypeToCategory,
} from '@/lib/cms/tip-routing-taxonomy';

type JsonObject = Record<string, unknown>;

function getSuggestionContentKind(suggestion: { type: string; sourceSignals: unknown }): string {
  const raw = suggestion.sourceSignals as JsonObject | null;
  const publishRouting = raw?.publishRouting as JsonObject | undefined;
  const contentKind = typeof publishRouting?.contentKind === 'string' ? publishRouting.contentKind : '';
  if (contentKind) return contentKind;
  return mapCMSSuggestionTypeToFallbackKind(suggestion.type);
}

function buildEmptyCategoryCounts(): Record<RoutingTipCategory, number> {
  return {
    seo_onpage: 0,
    seo_technical: 0,
    llmo_schema: 0,
    llmo_content: 0,
    content_strategy: 0,
    gsc_performance: 0,
    geo_visibility: 0,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { memberships: true },
    });
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        organizationId: true,
        cmsConnectionId: true,
        newCmsConnection: { select: { id: true } },
      },
    });

    if (!project || !user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (
      project.organizationId &&
      !user.memberships.some((m) => m.organizationId === project.organizationId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rules = await prisma.tipRoutingRule.findMany({
      where: { projectId, enabled: true },
      select: { contentKind: true },
    });
    const enabledKinds = new Set(rules.map((r) => r.contentKind));

    const sharedCmsLinks = await prisma.projectCMSConnection.findMany({
      where: { projectId },
      select: { connectionId: true },
    });
    const connectionIds = Array.from(
      new Set(
        [
          project.cmsConnectionId,
          project.newCmsConnection?.id,
          ...sharedCmsLinks.map((s) => s.connectionId),
        ].filter(Boolean) as string[]
      )
    );

    const directConfigIds = await prisma.visibilityConfig.findMany({
      where: { projectId },
      select: { id: true },
    });
    const sharedConfigLinks = await prisma.projectVisibilityConfig.findMany({
      where: { projectId },
      select: { configId: true },
    });
    const configIds = Array.from(
      new Set([...directConfigIds.map((c) => c.id), ...sharedConfigLinks.map((c) => c.configId)])
    );

    const categoryCounts = buildEmptyCategoryCounts();

    if (configIds.length > 0) {
      const reports = await prisma.brandReport.findMany({
        where: {
          configId: { in: configIds },
          status: 'completed',
          aiTips: { not: Prisma.AnyNull },
        },
        select: { id: true, aiTips: true, generatedAt: true, createdAt: true },
        orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      });

      if (reports.length > 0) {
        for (const report of reports) {
          const aiTips = report.aiTips as JsonObject | null;
          const tips = Array.isArray(aiTips?.tips) ? aiTips?.tips : [];
          for (const tip of tips) {
            const category = typeof (tip as JsonObject)?.category === 'string'
              ? ((tip as JsonObject).category as RoutingTipCategory)
              : null;
            if (category && category in categoryCounts) {
              categoryCounts[category] += 1;
            }
          }
        }
      } else {
        const analyses = await prisma.websiteAnalysis.findMany({
          where: {
            configId: { in: configIds },
            completedAt: { not: null },
            recommendations: { not: Prisma.AnyNull },
          },
          select: { recommendations: true },
          orderBy: { completedAt: 'desc' },
          take: 8,
        });

        for (const analysis of analyses) {
          const recs = Array.isArray(analysis.recommendations)
            ? (analysis.recommendations as Array<JsonObject>)
            : [];
          for (const rec of recs) {
            const tipType = typeof rec.type === 'string' ? rec.type : '';
            const category = mapSuggestionTypeToCategory(tipType);
            if (category) categoryCounts[category] += 1;
          }
        }
      }
    }

    const coverage = (Object.keys(CATEGORY_TO_CONTENT_KINDS) as RoutingTipCategory[]).map((category) => {
      const kinds = CATEGORY_TO_CONTENT_KINDS[category];
      const coveredKinds = kinds.filter((kind) => enabledKinds.has(kind));
      return {
        category,
        label: ROUTING_TIP_CATEGORY_LABELS[category],
        tipCount: categoryCounts[category],
        mappedContentKinds: kinds,
        coveredKinds,
        isCovered: coveredKinds.length > 0,
      };
    });

    let historyByContentKind: Array<{
      contentKind: string;
      category: RoutingTipCategory | null;
      draftReady: number;
      sent: number;
      discarded: number;
      total: number;
      latestAt: string | null;
    }> = [];

    if (connectionIds.length > 0) {
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

      const buckets = new Map<string, {
        contentKind: string;
        category: RoutingTipCategory | null;
        draftReady: number;
        sent: number;
        discarded: number;
        total: number;
        latestAt: string | null;
      }>();

      for (const suggestion of suggestions) {
        const contentKind = getSuggestionContentKind(suggestion);
        const existing = buckets.get(contentKind) || {
          contentKind,
          category: mapContentKindToCategory(contentKind),
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
        buckets.set(contentKind, existing);
      }

      historyByContentKind = Array.from(buckets.values()).sort((a, b) => b.total - a.total);
    }

    return NextResponse.json({
      coverage,
      historyByContentKind,
      enabledContentKinds: Array.from(enabledKinds.values()),
    });
  } catch (err) {
    console.error('tip-routing-overview GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
