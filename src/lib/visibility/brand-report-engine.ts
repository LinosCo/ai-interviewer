/**
 * Brand Report Engine
 *
 * Orchestrates a complete site intelligence report for a VisibilityConfig:
 *
 * 1. Parse sitemap → crawl all discovered pages
 * 2. Per-page: technical SEO audit + LLMO score (GEO / SEO for AI)
 * 3. Cross-reference with Google Search Console data (if connected via CMSConnection)
 * 4. Pull latest VisibilityScan scores (GEO brand mention rate)
 * 5. Pull latest SerpMonitoringScan score
 * 6. Use LLM to generate prioritised AI tips aligned to strategic objectives
 * 7. Persist everything to BrandReport table
 *
 * Scope: server-side only (Next.js server actions / API routes).
 */

import { z } from 'zod';
import { generateObject } from 'ai';
import { prisma } from '@/lib/prisma';
import { getSystemLLM } from '@/lib/visibility/llm-providers';
import { crawlSite, type SiteCrawlResult } from './site-crawler-engine';

// ─── AI Tips Schema ───────────────────────────────────────────────────────────

const TipCategorySchema = z.enum([
    'seo_onpage',       // Title, meta, H1, canonicals
    'seo_technical',    // Schema.org, sitemaps, canonicals, crawlability
    'llmo_schema',      // JSON-LD additions for AI optimisation
    'llmo_content',     // Content structure for AI (question headings, E-E-A-T)
    'content_strategy', // Topic gaps, page creation opportunities
    'gsc_performance',  // Pages with high impressions / low CTR
    'geo_visibility',   // GEO brand mention rate improvements
]);

const AITipSchema = z.object({
    category: TipCategorySchema,
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    title: z.string().describe('Short, actionable title (max 80 chars)'),
    description: z.string().describe('2-3 sentence explanation of the opportunity'),
    impact: z.string().describe('Specific expected outcome if implemented'),
    implementation: z.string().describe('Step-by-step action (max 3 steps)'),
    estimatedEffort: z.enum(['quick_win', 'medium', 'complex']),
    affectedPages: z.array(z.string()).optional().describe('Page URLs affected (max 3)'),
    strategyAlignment: z.string().optional().describe('How it aligns to brand strategic objectives'),
});

const AITipsResponseSchema = z.object({
    tips: z.array(AITipSchema).min(4).max(20),
    summaryInsight: z.string().describe(
        'Overall 2-sentence strategic insight about the site\'s AI readiness'
    ),
});

export type AITip = z.infer<typeof AITipSchema>;
export type AITipsResponse = z.infer<typeof AITipsResponseSchema>;

// ─── Score helpers ────────────────────────────────────────────────────────────

/** Compute GEO score from latest visibility scan results */
async function fetchGeoScore(configId: string): Promise<{ score: number; data: Record<string, unknown> }> {
    const scan = await prisma.visibilityScan.findFirst({
        where: { configId, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        select: {
            id: true,
            score: true,
            completedAt: true,
        },
    });

    if (!scan) return { score: 0, data: {} };

    // score is already 0-100 (brand mention rate * 100)
    const score = Math.round(scan.score ?? 0);

    return {
        score,
        data: {
            scanId: scan.id,
            geoScore: score,
            scannedAt: scan.completedAt,
        },
    };
}

/** Compute SERP score from latest SERP monitoring scan */
async function fetchSerpScore(configId: string): Promise<{ score: number; data: Record<string, unknown> }> {
    const scan = await prisma.serpMonitoringScan.findFirst({
        where: { configId, status: 'completed' },
        orderBy: { startedAt: 'desc' },
        select: {
            id: true,
            totalResults: true,
            positiveCount: true,
            negativeCount: true,
            neutralCount: true,
            avgImportance: true,
            completedAt: true,
        },
    });

    if (!scan) return { score: 0, data: {} };

    // Composite SERP score:
    // sentiment ratio (positive / total) * 60 + importance (0-100) * 40
    const total = scan.totalResults || 1;
    const sentimentScore = Math.round((scan.positiveCount / total) * 100);
    const importanceScore = Math.round((scan.avgImportance ?? 0) * 100); // normalize 0-1 → 0-100
    const score = Math.round(sentimentScore * 0.6 + importanceScore * 0.4);

    return {
        score: Math.min(100, Math.max(0, score)),
        data: {
            scanId: scan.id,
            totalResults: scan.totalResults,
            positiveCount: scan.positiveCount,
            negativeCount: scan.negativeCount,
            neutralCount: scan.neutralCount,
            avgImportance: scan.avgImportance,
            scannedAt: scan.completedAt,
        },
    };
}

/** Fetch the most recent WebsiteAnalytics (GSC+GA) for the org's CMSConnections */
async function fetchGSCData(organizationId: string): Promise<{
    topSearchPages: Array<{ page: string; impressions: number; clicks: number; position: number }>;
    topSearchQueries: Array<{ query: string; impressions: number; clicks: number; position: number }>;
    avgBounceRate?: number;
    avgSessionDuration?: number;
} | null> {
    const analytics = await prisma.websiteAnalytics.findFirst({
        where: { connection: { organizationId } },
        orderBy: { date: 'desc' },
        select: {
            topSearchPages: true,
            topSearchQueries: true,
            bounceRate: true,
            avgSessionDuration: true,
        },
    });

    if (!analytics) return null;

    return {
        topSearchPages: (analytics.topSearchPages as Array<{ page: string; impressions: number; clicks: number; position: number }>) ?? [],
        topSearchQueries: (analytics.topSearchQueries as Array<{ query: string; impressions: number; clicks: number; position: number }>) ?? [],
        avgBounceRate: analytics.bounceRate,
        avgSessionDuration: analytics.avgSessionDuration,
    };
}

// ─── AI Tips generation ───────────────────────────────────────────────────────

async function generateAITips(
    crawl: SiteCrawlResult,
    geoScore: number,
    serpScore: number,
    gscData: Awaited<ReturnType<typeof fetchGSCData>>,
    config: {
        brandName: string;
        language: string;
        strategicPlan?: string | null;
        description?: string | null;
    }
): Promise<AITipsResponse | null> {
    try {
        const { model } = await getSystemLLM();

        // Build a data summary to feed the LLM (keep prompt size manageable)
        const topSeoIssues = crawl.aggregated.topSeoIssues.slice(0, 5)
            .map(i => `• ${i.issue} (${i.count} pagine)`).join('\n');

        const topLlmoIssues = crawl.aggregated.topLlmoIssues.slice(0, 5)
            .map(i => `• ${i.issue} (${i.count} pagine)`).join('\n');

        const lowCtrPages = gscData?.topSearchPages
            .filter(p => p.impressions > 200 && (p.clicks / p.impressions) < 0.03)
            .slice(0, 3)
            .map(p => `${p.page} (pos ${p.position.toFixed(1)}, CTR ${((p.clicks / p.impressions) * 100).toFixed(1)}%)`)
            .join(', ') || 'nessuna';

        const topQueries = gscData?.topSearchQueries.slice(0, 5)
            .map(q => `"${q.query}" (${q.impressions} imp, pos ${q.position.toFixed(1)})`).join(', ') || 'nessuno';

        const language = config.language === 'it' ? 'italiano' : 'english';

        const prompt = `Sei un consulente senior di SEO e LLMO (LLM Optimization / GEO – Generative Engine Optimization).
Analizza i dati del sito "${config.brandName}" e genera raccomandazioni specifiche e prioritizzate.

## CONTESTO STRATEGICO
${config.strategicPlan || config.description || 'Non specificato'}

## DATI AUDIT SITO
- Pagine analizzate: ${crawl.pagesAudited}
- Score SEO tecnico medio: ${crawl.aggregated.avgSeoScore}/100
- Score LLMO medio (visibilità AI): ${crawl.aggregated.avgLlmoScore}/100
- Score GEO (menzioni brand su LLM): ${geoScore}/100
- Score SERP (presenza Google News): ${serpScore}/100
- Pagine con FAQ schema: ${crawl.aggregated.pagesWithFAQSchema}/${crawl.pagesAudited}
- Pagine con Article schema: ${crawl.aggregated.pagesWithArticleSchema}/${crawl.pagesAudited}
- Pagine LLMO score < 40: ${crawl.aggregated.pagesWithoutLLMO}

## TOP PROBLEMI SEO
${topSeoIssues || 'Nessuno rilevato'}

## TOP PROBLEMI LLMO
${topLlmoIssues || 'Nessuno rilevato'}

## DATI GSC (Google Search Console)
- Query principali: ${topQueries}
- Pagine con alto volume bassa CTR: ${lowCtrPages}
${gscData?.avgBounceRate ? `- Bounce rate medio: ${gscData.avgBounceRate.toFixed(1)}%` : ''}

## ISTRUZIONI
1. Genera 6-12 raccomandazioni SPECIFICHE e ATTUABILI
2. Prioritizza in base all'impatto su SEO tradizionale E visibilità AI
3. Include almeno 2 tip su LLMO schema, 2 su contenuto per AI, 2 su SEO tecnico
4. Se ci sono pagine GSC con alta impression/bassa CTR, genera un tip specifico
5. Allinea le raccomandazioni agli obiettivi strategici del brand
6. Rispondi in ${language}
7. Per "affectedPages", includi solo URL reali trovati nell'audit (non inventare)`;

        const { object } = await generateObject({
            model,
            schema: AITipsResponseSchema,
            prompt,
            temperature: 0.3,
        });

        return object;
    } catch (error) {
        console.error('[BrandReportEngine] AI tips generation failed:', error);
        return null;
    }
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export class BrandReportEngine {
    /**
     * Generate (or regenerate) a BrandReport for a VisibilityConfig.
     *
     * Creates a "pending" record first so the UI can poll for progress,
     * then runs all async work and updates the record to "completed".
     */
    static async generate(configId: string): Promise<string> {
        // Load config
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            select: {
                id: true,
                brandName: true,
                websiteUrl: true,
                language: true,
                organizationId: true,
                description: true,
                project: { select: { strategicVision: true } },
            },
        });

        if (!config) throw new Error(`VisibilityConfig ${configId} not found`);
        if (!config.websiteUrl) throw new Error('No websiteUrl configured for this brand');

        // Create pending record
        const report = await prisma.brandReport.create({
            data: {
                configId,
                status: 'running',
            },
        });

        const reportId = report.id;

        // Run all data gathering in parallel where possible
        try {
            const [gscData, geoResult, serpResult] = await Promise.all([
                fetchGSCData(config.organizationId),
                fetchGeoScore(configId),
                fetchSerpScore(configId),
            ]);

            // Crawl site (serial because it's intensive)
            const crawl = await crawlSite(config.websiteUrl, {
                gscPages: gscData?.topSearchPages ?? [],
                maxPages: 30,
            });

            // Generate AI tips
            const aiTipsResult = await generateAITips(
                crawl,
                geoResult.score,
                serpResult.score,
                gscData,
                {
                    brandName: config.brandName,
                    language: config.language,
                    strategicPlan: config.project?.strategicVision,
                    description: config.description,
                }
            );

            // Compute overall score (weighted)
            const overallScore = Math.round(
                crawl.aggregated.avgSeoScore * 0.30 +
                crawl.aggregated.avgLlmoScore * 0.30 +
                geoResult.score * 0.25 +
                serpResult.score * 0.15
            );

            await prisma.brandReport.update({
                where: { id: reportId },
                data: {
                    status: 'completed',
                    overallScore,
                    seoScore: crawl.aggregated.avgSeoScore,
                    llmoScore: crawl.aggregated.avgLlmoScore,
                    geoScore: geoResult.score,
                    serpScore: serpResult.score,
                    pagesAudited: crawl.pagesAudited,
                    seoAuditData: JSON.parse(JSON.stringify(crawl)) as object,
                    geoData: geoResult.data as object,
                    serpData: serpResult.data as object,
                    gscInsights: gscData as object ?? undefined,
                    aiTips: aiTipsResult as unknown as object ?? undefined,
                    generatedAt: new Date(),
                },
            });

            return reportId;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error('[BrandReportEngine] generation failed:', msg);

            await prisma.brandReport.update({
                where: { id: reportId },
                data: {
                    status: 'failed',
                    errorMessage: msg,
                },
            });

            throw error;
        }
    }

    /** Fetch the latest completed report for a config */
    static async getLatest(configId: string) {
        return prisma.brandReport.findFirst({
            where: { configId, status: 'completed' },
            orderBy: { createdAt: 'desc' },
        });
    }

    /** Check if a report is currently being generated */
    static async getRunning(configId: string) {
        return prisma.brandReport.findFirst({
            where: { configId, status: 'running' },
            orderBy: { createdAt: 'desc' },
        });
    }
}
