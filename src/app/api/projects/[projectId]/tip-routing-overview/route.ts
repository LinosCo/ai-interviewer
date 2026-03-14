import { auth } from '@/auth';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';
import { prisma } from '@/lib/prisma';
import { isMissingPrismaTable } from '@/lib/prisma-table-errors';
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    await assertProjectAccess(session.user.id, projectId, 'VIEWER');
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        organizationId: true,
        cmsConnectionId: true,
        newCmsConnection: { select: { id: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rules = await prisma.tipRoutingRule.findMany({
      where: { projectId, enabled: true },
      select: {
        contentKind: true,
        mcpTool: true,
        mcpConnectionId: true,
        cmsConnectionId: true,
        n8nConnectionId: true,
        mcpConnection: { select: { status: true } },
        cmsConnection: { select: { status: true } },
        n8nConnection: { select: { status: true } },
      },
    });
    const enabledKinds = new Set(rules.map((r) => r.contentKind));
    const operationalKinds = new Set(
      rules
        .filter((r) => {
          if (r.mcpConnectionId) {
            return r.mcpConnection?.status === 'ACTIVE' && Boolean(r.mcpTool);
          }
          if (r.cmsConnectionId) {
            return r.cmsConnection?.status === 'ACTIVE';
          }
          if (r.n8nConnectionId) {
            return r.n8nConnection?.status === 'ACTIVE';
          }
          return false;
        })
        .map((r) => r.contentKind)
    );

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
    const directMcpIds = await prisma.mCPConnection.findMany({
      where: { projectId },
      select: { id: true },
    });
    const sharedMcpLinks = await prisma.projectMCPConnection.findMany({
      where: { projectId },
      select: { connectionId: true },
    });
    const mcpConnectionIds = Array.from(
      new Set([...directMcpIds.map((c) => c.id), ...sharedMcpLinks.map((c) => c.connectionId)])
    );
    const sharedConfigLinks = await prisma.projectVisibilityConfig.findMany({
      where: { projectId },
      select: { configId: true },
    });
    const configIds = Array.from(
      new Set([...directConfigIds.map((c) => c.id), ...sharedConfigLinks.map((c) => c.configId)])
    );

    const categoryCounts = buildEmptyCategoryCounts();
    let canonicalTips: Array<{
      id: string;
      title: string;
      category: string | null;
      contentKind: string | null;
      updatedAt: Date;
      routes: Array<{
        status: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
      executions: Array<{
        id: string;
        status: string;
        startedAt: Date;
        completedAt: Date | null;
      }>;
    }> = [];
    try {
      canonicalTips = await prisma.projectTip.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          category: true,
          contentKind: true,
          updatedAt: true,
          routes: {
            select: {
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          executions: {
            select: {
              id: true,
              status: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      });
    } catch (error) {
      if (!isMissingPrismaTable(error, ['ProjectTip', 'ProjectTipRoute', 'ProjectTipExecution'])) {
        throw error;
      }
    }
    const hasCanonicalLedger = canonicalTips.some((tip) => tip.routes.length > 0 || tip.executions.length > 0);

    if (hasCanonicalLedger) {
      for (const tip of canonicalTips) {
        const mappedCategory = tip.category && tip.category in categoryCounts
          ? (tip.category as RoutingTipCategory)
          : mapContentKindToCategory(tip.contentKind || '');
        if (mappedCategory) {
          categoryCounts[mappedCategory] += 1;
        }
      }
    } else if (configIds.length > 0) {
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
      const coveredKinds = kinds.filter((kind) => operationalKinds.has(kind));
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

    if (hasCanonicalLedger) {
      const buckets = new Map<string, {
        contentKind: string;
        category: RoutingTipCategory | null;
        draftReady: number;
        sent: number;
        discarded: number;
        total: number;
        latestAt: string | null;
      }>();

      for (const tip of canonicalTips) {
        const contentKind = tip.contentKind || 'uncategorized';
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

        const routeStatuses = new Set(tip.routes.map((route) => route.status));
        if (tip.executions.length > 0 || routeStatuses.has('SUCCEEDED') || routeStatuses.has('DISPATCHED')) {
          existing.sent += 1;
        } else if (routeStatuses.has('FAILED')) {
          existing.discarded += 1;
        } else {
          existing.draftReady += 1;
        }

        const latestRouteAt = tip.routes
          .map((route) => route.updatedAt || route.createdAt)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const latestExecutionAt = tip.executions
          .map((execution) => execution.completedAt || execution.startedAt)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const latestAt = [tip.updatedAt, latestRouteAt, latestExecutionAt]
          .filter((value): value is Date => Boolean(value))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        if (latestAt && (!existing.latestAt || latestAt > new Date(existing.latestAt))) {
          existing.latestAt = latestAt.toISOString();
        }

        buckets.set(contentKind, existing);
      }

      historyByContentKind = Array.from(buckets.values()).sort((a, b) => b.total - a.total);
    } else if (connectionIds.length > 0) {
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

    const sentSuggestions = !hasCanonicalLedger && connectionIds.length > 0
      ? await prisma.cMSSuggestion.findMany({
        where: {
          connectionId: { in: connectionIds },
          status: { in: ['PUSHED', 'PUBLISHED'] },
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          cmsContentId: true,
          cmsPreviewUrl: true,
          sourceSignals: true,
          pushedAt: true,
          publishedAt: true,
          updatedAt: true,
        },
        orderBy: [{ pushedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 30,
      })
      : [];

    const sentContentHistory = hasCanonicalLedger
      ? (await prisma.projectTipExecution.findMany({
        where: { tip: { projectId } },
        include: {
          tip: {
            select: {
              title: true,
              category: true,
              contentKind: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: 30,
      })).map((execution) => ({
        id: execution.id,
        title: execution.tip.title,
        contentKind: execution.tip.contentKind || 'uncategorized',
        category: execution.tip.category
          ? (execution.tip.category as RoutingTipCategory)
          : mapContentKindToCategory(execution.tip.contentKind || ''),
        status: execution.status,
        cmsContentId: null,
        previewUrl: null,
        sentAt: (execution.completedAt || execution.startedAt).toISOString(),
      }))
      : sentSuggestions.map((suggestion) => {
        const contentKind = getSuggestionContentKind({
          type: suggestion.type,
          sourceSignals: suggestion.sourceSignals,
        });
        return {
          id: suggestion.id,
          title: suggestion.title,
          contentKind,
          category: mapContentKindToCategory(contentKind),
          status: suggestion.status,
          cmsContentId: suggestion.cmsContentId,
          previewUrl: suggestion.cmsPreviewUrl,
          sentAt: (suggestion.publishedAt || suggestion.pushedAt || suggestion.updatedAt).toISOString(),
        };
      });

    const logCandidates = await prisma.integrationLog.findMany({
      where: {
        OR: [
          ...(mcpConnectionIds.length ? [{ mcpConnectionId: { in: mcpConnectionIds } }] : []),
          ...(connectionIds.length ? [{ cmsConnectionId: { in: connectionIds } }] : []),
          { action: { startsWith: 'tip_routing.' } },
        ],
      },
      select: {
        id: true,
        action: true,
        arguments: true,
        result: true,
        success: true,
        errorMessage: true,
        durationMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });

    const actionHistory = logCandidates
      .filter((log) => {
        const args = (log.arguments || {}) as JsonObject;
        const argProjectId = typeof args.projectId === 'string' ? args.projectId : null;
        if (argProjectId && argProjectId === projectId) return true;
        if (log.action.startsWith('tip_routing.') && !argProjectId) return true;
        return false;
      })
      .slice(0, 40)
      .map((log) => {
        const args = (log.arguments || {}) as JsonObject;
        const result = (log.result || {}) as JsonObject;
        const contentKind = typeof args.contentKind === 'string' ? args.contentKind : null;
        const destination = typeof result.destination === 'string'
          ? result.destination
          : (() => {
            if (log.action.includes('.mcp')) return 'mcp';
            if (log.action.includes('.cms')) return 'cms';
            if (log.action.includes('.n8n')) return 'n8n';
            return null;
          })();

        return {
          id: log.id,
          at: log.createdAt.toISOString(),
          action: log.action,
          success: log.success,
          errorMessage: log.errorMessage,
          durationMs: log.durationMs,
          ruleId: typeof args.ruleId === 'string' ? args.ruleId : null,
          contentKind,
          destination,
        };
      });

    return NextResponse.json({
      coverage,
      historyByContentKind,
      sentContentHistory,
      actionHistory,
      enabledContentKinds: Array.from(enabledKinds.values()),
      operationalContentKinds: Array.from(operationalKinds.values()),
    });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error('tip-routing-overview GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
