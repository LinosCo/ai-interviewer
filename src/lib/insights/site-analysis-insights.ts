import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type WebsiteRecommendation = {
  type?: string;
  priority?: string;
  title?: string;
  description?: string;
  impact?: string;
  implementation?: {
    publishChannel?: string;
    contentKind?: string;
    targetSection?: string;
  } | null;
  explainability?: {
    logic?: string;
    confidence?: number;
    evidence?: string[];
  } | null;
};

type BrandReportTip = {
  category?: string;
  priority?: string;
  title?: string;
  description?: string;
  impact?: string;
  implementation?: string;
  strategyAlignment?: string;
  estimatedEffort?: string;
};

type VirtualInsight = {
  id: string;
  topicName: string;
  reasoning: string;
  priorityScore: number;
  crossChannelScore: number;
  suggestedActions: Array<{
    type: string;
    target: string;
    title: string;
    body: string;
    reasoning: string;
    strategicAlignment?: string;
    coordination?: string;
    evidence?: Array<{
      sourceType: string;
      sourceRef: string;
      detail: string;
    }>;
    autoApply: boolean;
    status: 'pending';
    source: 'site_analysis';
  }>;
  status: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  isVirtual: true;
  source: 'site_analysis';
  visibilityData: {
    source: 'site_analysis';
    configId: string;
    analysisId?: string;
    reportId?: string;
    brandName: string;
  };
};

type LoadArgs = {
  organizationId: string;
  projectId?: string;
};

function mapPriority(value: string | undefined): number {
  const v = String(value || '').toLowerCase();
  if (v === 'critical') return 92;
  if (v === 'high') return 80;
  if (v === 'medium') return 62;
  if (v === 'low') return 42;
  return 55;
}

function mapWebsiteRecommendationAction(rec: WebsiteRecommendation) {
  const t = String(rec.type || '').toLowerCase();
  if (t === 'add_faq') return { type: 'add_faq', target: 'website' };
  if (t === 'social_post') return { type: 'marketing_campaign', target: 'marketing' };
  if (t === 'improve_value_proposition') return { type: 'strategic_recommendation', target: 'strategy' };
  if (t === 'address_knowledge_gap') return { type: 'add_faq', target: 'chatbot' };
  if (t === 'product_content_optimization') return { type: 'modify_content', target: 'product' };
  if (t === 'add_page' || t === 'add_keyword_content' || t === 'competitive_positioning') {
    return { type: 'create_content', target: 'website' };
  }
  return { type: 'modify_content', target: 'website' };
}

function mapBrandTipAction(tip: BrandReportTip) {
  const c = String(tip.category || '').toLowerCase();
  if (c === 'geo_visibility') return { type: 'marketing_campaign', target: 'marketing' };
  if (c === 'content_strategy' || c === 'llmo_content') return { type: 'create_content', target: 'website' };
  if (c === 'gsc_performance') return { type: 'modify_content', target: 'website' };
  if (c === 'llmo_schema' || c === 'seo_technical' || c === 'seo_onpage') return { type: 'modify_content', target: 'website' };
  return { type: 'strategic_recommendation', target: 'strategy' };
}

async function loadScopedConfigs(args: LoadArgs) {
  const whereWithShare = {
    organizationId: args.organizationId,
    ...(args.projectId
      ? {
          OR: [{ projectId: args.projectId }, { projectShares: { some: { projectId: args.projectId } } }],
        }
      : {}),
  };

  try {
    return await prisma.visibilityConfig.findMany({
      where: whereWithShare as any,
      select: {
        id: true,
        brandName: true,
        projectId: true,
      },
    });
  } catch (err: any) {
    if (err?.code !== 'P2021') throw err;
    return prisma.visibilityConfig.findMany({
      where: {
        organizationId: args.organizationId,
        ...(args.projectId ? { projectId: args.projectId } : {}),
      },
      select: {
        id: true,
        brandName: true,
        projectId: true,
      },
    });
  }
}

export async function loadSiteAnalysisInsights(args: LoadArgs): Promise<VirtualInsight[]> {
  const configs = await loadScopedConfigs(args);
  if (!configs.length) return [];

  const configIds = configs.map((c) => c.id);
  const configMeta = new Map(configs.map((cfg) => [cfg.id, cfg]));

  const [websiteAnalyses, brandReports] = await Promise.all([
    prisma.websiteAnalysis.findMany({
      where: {
        configId: { in: configIds },
        completedAt: { not: null },
        recommendations: { not: Prisma.AnyNull },
      },
      select: {
        id: true,
        configId: true,
        recommendations: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
      take: Math.min(configIds.length * 3, 80),
    }),
    prisma.brandReport.findMany({
      where: {
        configId: { in: configIds },
        status: 'completed',
        aiTips: { not: Prisma.AnyNull },
      },
      select: {
        id: true,
        configId: true,
        aiTips: true,
        generatedAt: true,
        createdAt: true,
      },
      orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(configIds.length * 3, 80),
    }),
  ]);

  const latestAnalysisByConfig = new Map<string, (typeof websiteAnalyses)[number]>();
  for (const row of websiteAnalyses) {
    if (!latestAnalysisByConfig.has(row.configId)) latestAnalysisByConfig.set(row.configId, row);
  }

  const latestReportByConfig = new Map<string, (typeof brandReports)[number]>();
  for (const row of brandReports) {
    if (!latestReportByConfig.has(row.configId)) latestReportByConfig.set(row.configId, row);
  }

  const virtualInsights: VirtualInsight[] = [];
  const dedupe = new Set<string>();

  for (const [configId, analysis] of latestAnalysisByConfig) {
    const meta = configMeta.get(configId);
    if (!meta) continue;
    const recs = Array.isArray(analysis.recommendations) ? (analysis.recommendations as WebsiteRecommendation[]) : [];

    recs.slice(0, 6).forEach((rec, idx) => {
      const title = String(rec.title || '').trim();
      if (!title) return;
      const dedupeKey = `${meta.brandName.toLowerCase()}::wa::${title.toLowerCase()}`;
      if (dedupe.has(dedupeKey)) return;
      dedupe.add(dedupeKey);

      const mapped = mapWebsiteRecommendationAction(rec);
      const reasoningBits = [rec.impact, rec.explainability?.logic]
        .filter((v): v is string => Boolean(v && String(v).trim().length > 0))
        .join(' ');
      const bodyParts = [rec.description, rec.implementation?.targetSection ? `Sezione target: ${rec.implementation.targetSection}.` : null]
        .filter((v): v is string => Boolean(v && String(v).trim().length > 0));

      virtualInsights.push({
        id: `virtual:site-wa:${analysis.id}:${idx}`,
        topicName: `[Sito] ${meta.brandName} - ${title}`,
        reasoning: reasoningBits || "Raccomandazione generata dall'analisi del sito.",
        priorityScore: mapPriority(rec.priority),
        crossChannelScore: 74,
        suggestedActions: [
          {
            type: mapped.type,
            target: mapped.target,
            title,
            body: bodyParts.join(' ') || 'Raccomandazione proveniente da analisi sito.',
            reasoning: reasoningBits || 'Basato su analisi tecnica e contenutistica del sito.',
            strategicAlignment: 'Allineare contenuti e posizionamento digitale alla value proposition emersa dal sito.',
            evidence: [
              {
                sourceType: 'site_analysis',
                sourceRef: `website_analysis:${analysis.id}`,
                detail: `Raccomandazione tipo "${String(rec.type || 'unknown')}" con priorita "${String(rec.priority || 'n/d')}".`
              }
            ],
            coordination: 'Partire dal sito (base messaggio), poi estendere su social/interviste/PR in base al tema.',
            autoApply: false,
            status: 'pending',
            source: 'site_analysis',
          },
        ],
        status: 'new',
        projectId: meta.projectId || null,
        createdAt: (analysis.completedAt || new Date()).toISOString(),
        updatedAt: (analysis.completedAt || new Date()).toISOString(),
        isVirtual: true,
        source: 'site_analysis',
        visibilityData: {
          source: 'site_analysis',
          configId,
          analysisId: analysis.id,
          brandName: meta.brandName,
        },
      });
    });
  }

  for (const [configId, report] of latestReportByConfig) {
    const meta = configMeta.get(configId);
    if (!meta) continue;
    const payload = report.aiTips as { tips?: BrandReportTip[] } | null;
    const tips = Array.isArray(payload?.tips) ? payload.tips : [];

    tips.slice(0, 6).forEach((tip, idx) => {
      const title = String(tip.title || '').trim();
      if (!title) return;
      const dedupeKey = `${meta.brandName.toLowerCase()}::br::${title.toLowerCase()}`;
      if (dedupe.has(dedupeKey)) return;
      dedupe.add(dedupeKey);

      const mapped = mapBrandTipAction(tip);
      const reasoningBits = [tip.impact, tip.strategyAlignment]
        .filter((v): v is string => Boolean(v && String(v).trim().length > 0))
        .join(' ');
      const bodyParts = [tip.description, tip.implementation]
        .filter((v): v is string => Boolean(v && String(v).trim().length > 0));

      virtualInsights.push({
        id: `virtual:site-br:${report.id}:${idx}`,
        topicName: `[AI Tip Sito] ${meta.brandName} - ${title}`,
        reasoning: reasoningBits || 'Tip strategico proveniente dal report sito.',
        priorityScore: mapPriority(tip.priority),
        crossChannelScore: 76,
        suggestedActions: [
          {
            type: mapped.type,
            target: mapped.target,
            title,
            body: bodyParts.join(' ') || 'Tip strategico proveniente da brand report.',
            reasoning: reasoningBits || 'Generato da scoring SEO/LLMO/GEO/SERP.',
            strategicAlignment: tip.strategyAlignment || 'Coerenza con priorita strategiche di visibilita e acquisizione.',
            evidence: [
              {
                sourceType: 'site_analysis',
                sourceRef: `brand_report:${report.id}`,
                detail: `Categoria "${String(tip.category || 'n/d')}", priorita "${String(tip.priority || 'n/d')}", effort "${String(tip.estimatedEffort || 'n/d')}".`
              }
            ],
            coordination: 'Coordinare output sito con contenuti social e azioni di digital PR sullo stesso tema.',
            autoApply: false,
            status: 'pending',
            source: 'site_analysis',
          },
        ],
        status: 'new',
        projectId: meta.projectId || null,
        createdAt: (report.generatedAt || report.createdAt || new Date()).toISOString(),
        updatedAt: (report.generatedAt || report.createdAt || new Date()).toISOString(),
        isVirtual: true,
        source: 'site_analysis',
        visibilityData: {
          source: 'site_analysis',
          configId,
          reportId: report.id,
          brandName: meta.brandName,
        },
      });
    });
  }

  return virtualInsights.sort((a, b) => b.priorityScore - a.priorityScore);
}
