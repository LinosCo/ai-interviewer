import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CMSSuggestionGenerator } from '@/lib/cms/suggestion-generator';
import {
  WorkspaceError,
  assertOrganizationAccess,
  assertProjectAccess,
} from '@/lib/domain/workspace';

type PrepareBody = {
  insightId?: string;
  actionTitle?: string;
  virtualTip?: {
    organizationId: string;
    projectId?: string | null;
    topicName: string;
    action: {
      type: string;
      target: string;
      title?: string;
      body?: string;
      reasoning?: string;
      strategicAlignment?: string;
      coordination?: string;
      evidence?: Array<{ sourceType: string; sourceRef: string; detail: string }>;
      executionClass?: string;
      contentKind?: string | null;
      category?: string | null;
      businessCategory?: string | null;
      workflowStatus?: string;
      autoApply?: boolean;
    };
    source?: string;
  };
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function scoreTitleMatch(title: string, actionTitle: string): number {
  const a = normalizeText(title);
  const b = normalizeText(actionTitle);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b)) return 75;
  if (b.includes(a)) return 65;

  const aTokens = new Set(a.split(' ').filter((t) => t.length >= 3));
  const bTokens = new Set(b.split(' ').filter((t) => t.length >= 3));
  if (!aTokens.size || !bTokens.size) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  const union = aTokens.size + bTokens.size - intersection;
  if (union <= 0) return 0;
  return Math.round((intersection / union) * 50);
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as PrepareBody;
    if (!body?.insightId && !body?.virtualTip) {
      return NextResponse.json({ error: 'insightId or virtualTip is required' }, { status: 400 });
    }
    let insight: { id: string; organizationId: string; projectId: string | null } | null = null;

    if (body.insightId) {
      insight = await prisma.crossChannelInsight.findUnique({
        where: { id: body.insightId },
        select: {
          id: true,
          organizationId: true,
          projectId: true,
        },
      });

      if (!insight) {
        return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
      }

      try {
        if (insight.projectId) {
          await assertProjectAccess(session.user.id, insight.projectId, 'MEMBER');
        } else {
          await assertOrganizationAccess(session.user.id, insight.organizationId, 'MEMBER');
        }
      } catch (error) {
        if (error instanceof WorkspaceError) {
          return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        throw error;
      }
    } else if (body.virtualTip) {
      const virtual = body.virtualTip;
      try {
        if (virtual.projectId) {
          const access = await assertProjectAccess(session.user.id, virtual.projectId, 'MEMBER');
          if (access.organizationId !== virtual.organizationId) {
            return NextResponse.json({ error: 'Project does not belong to provided organization' }, { status: 403 });
          }
        } else {
          await assertOrganizationAccess(session.user.id, virtual.organizationId, 'MEMBER');
        }
      } catch (error) {
        if (error instanceof WorkspaceError) {
          return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        throw error;
      }

      const created = await prisma.crossChannelInsight.create({
        data: {
          organizationId: virtual.organizationId,
          projectId: virtual.projectId || null,
          topicName: virtual.topicName || 'Tip sito importato',
          status: 'new',
          crossChannelScore: 70,
          priorityScore: 70,
          interviewData: [],
          chatbotData: [],
          visibilityData: {
            source: virtual.source || 'site_analysis',
            createdFrom: 'virtual_tip_discover',
            createdBy: session.user.id,
            createdAt: new Date().toISOString(),
          } as any,
          suggestedActions: [
            {
              type: virtual.action.type || 'modify_content',
              target: virtual.action.target || 'website',
              title: virtual.action.title || virtual.topicName,
              body: virtual.action.body || 'Azione importata dalla site-analysis.',
              reasoning: virtual.action.reasoning || 'Trasformazione tip sito in task operativo.',
              strategicAlignment: virtual.action.strategicAlignment || 'Coerenza con priorita strategiche del progetto.',
              coordination: virtual.action.coordination || 'Coordina il contenuto su sito/social/interviste.',
              evidence: Array.isArray(virtual.action.evidence) ? virtual.action.evidence : [],
              executionClass: virtual.action.executionClass,
              contentKind: virtual.action.contentKind,
              category: virtual.action.category,
              businessCategory: virtual.action.businessCategory,
              workflowStatus: virtual.action.workflowStatus || 'draft',
              autoApply: Boolean(virtual.action.autoApply),
            },
          ] as any,
        },
        select: {
          id: true,
          organizationId: true,
          projectId: true,
        },
      });

      insight = created;
      body.actionTitle = body.actionTitle || virtual.action.title || virtual.topicName;
    }

    if (!insight) {
      return NextResponse.json({ error: 'Unable to resolve insight context' }, { status: 400 });
    }

    const existing = await prisma.cMSSuggestion.findMany({
      where: { crossChannelInsightId: insight.id },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    let suggestionIds = existing.map((s) => s.id);
    if (suggestionIds.length === 0) {
      suggestionIds = await CMSSuggestionGenerator.generateFromInsight(insight.id);
    }

    if (suggestionIds.length === 0) {
      return NextResponse.json(
        {
          error: 'Nessuna bozza contenuto disponibile per questo tip',
          details: 'Il tip non contiene azioni sito/prodotto/marketing convertibili in draft CMS.',
        },
        { status: 422 }
      );
    }

    const suggestions = await prisma.cMSSuggestion.findMany({
      where: { id: { in: suggestionIds } },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const preferredTitle = typeof body.actionTitle === 'string' ? body.actionTitle : '';
    let selected = suggestions[0];
    if (preferredTitle) {
      selected = suggestions
        .map((s) => ({ suggestion: s, score: scoreTitleMatch(s.title || '', preferredTitle) }))
        .sort((a, b) => b.score - a.score || +new Date(b.suggestion.createdAt) - +new Date(a.suggestion.createdAt))[0]
        ?.suggestion || suggestions[0];
    }

    return NextResponse.json({
      success: true,
      suggestionId: selected.id,
      generatedCount: suggestionIds.length,
      url: `/dashboard/cms/suggestions?id=${selected.id}`,
    });
  } catch (error) {
    console.error('[insights/suggestions/prepare] POST error:', error);
    return NextResponse.json({ error: 'Failed to prepare suggestion' }, { status: 500 });
  }
}
