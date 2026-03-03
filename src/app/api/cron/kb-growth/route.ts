import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { sanitize } from '@/lib/llm/prompt-sanitizer';

export const dynamic = 'force-dynamic';

const LOOKBACK_DAYS = 7;
const SERP_IMPORTANCE_THRESHOLD = 60;
const CROSS_CHANNEL_PRIORITY_THRESHOLD = 50;

/**
 * GET /api/cron/kb-growth
 *
 * Daily cron job that ingests knowledge from 4 automated sources into the KB
 * of every chatbot bot that has a project association:
 *
 *   1. TIP_IMPLEMENTED  — Completed AI tip actions (TipAction.completedAt)
 *   2. CMS_PUBLISHED    — Published CMS suggestions (CMSSuggestion.status=PUBLISHED)
 *   3. SERP_DATA        — High-importance SERP results (importanceScore ≥ 60)
 *   4. CROSS_CHANNEL    — Cross-channel insights (priorityScore ≥ 50)
 *
 * Deduplication: each source type is ingested at most once per LOOKBACK_DAYS window
 * per bot. If a KnowledgeSource of that type already exists within the window, the
 * ingestor is skipped.
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);

    console.log(`[KB-Growth] Starting ingestion (lookback: last ${LOOKBACK_DAYS} days)...`);

    const bots = await prisma.bot.findMany({
        where: { botType: 'chatbot' },
        select: { id: true, projectId: true, slug: true },
    });

    console.log(`[KB-Growth] Processing ${bots.length} chatbot bots`);

    const stats = {
        tipsIngested: 0,
        cmsIngested: 0,
        serpIngested: 0,
        crossChannelIngested: 0,
        errors: 0,
    };

    for (const bot of bots) {
        if (!bot.projectId) continue;
        try {
            stats.tipsIngested       += await ingestTips(bot.id, bot.projectId, since);
            stats.cmsIngested        += await ingestCmsPublished(bot.id, bot.projectId, since);
            stats.serpIngested       += await ingestSerpData(bot.id, bot.projectId, since);
            stats.crossChannelIngested += await ingestCrossChannelInsights(bot.id, bot.projectId, since);
        } catch (err) {
            stats.errors++;
            console.error(`[KB-Growth] Error for bot ${bot.id}:`, err instanceof Error ? err.message : err);
        }
    }

    console.log('[KB-Growth] Done.', stats);
    return NextResponse.json({ success: true, botsProcessed: bots.length, ...stats });
}

// ---------------------------------------------------------------------------
// Ingestor 1: Implemented AI Tips
// ---------------------------------------------------------------------------

async function ingestTips(botId: string, projectId: string, since: Date): Promise<number> {
    // Deduplication: skip if already ingested within the window
    const existing = await prisma.knowledgeSource.findFirst({
        where: { botId, type: 'TIP_IMPLEMENTED', createdAt: { gte: since } },
        select: { id: true },
    });
    if (existing) return 0;

    const configIds = await prisma.visibilityConfig
        .findMany({ where: { projectId, isActive: true }, select: { id: true } })
        .then(cs => cs.map(c => c.id));

    if (!configIds.length) return 0;

    const tips = await prisma.tipAction.findMany({
        where: {
            configId: { in: configIds },
            completedAt: { not: null, gte: since },
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
    });

    if (!tips.length) return 0;

    const lines = tips
        .map(t => `- ${sanitize(t.tipTitle, 200)}: ${sanitize(t.notes || 'Implementato con successo', 300)}`)
        .join('\n');

    await prisma.knowledgeSource.create({
        data: {
            botId,
            type: 'TIP_IMPLEMENTED',
            title: `Miglioramenti implementati di recente (${tips.length})`,
            content: `I seguenti miglioramenti sono stati applicati alla piattaforma o al sito:\n\n${lines}`,
        },
    });

    console.log(`[KB-Growth] Bot ${botId}: ${tips.length} tips ingested`);
    return 1;
}

// ---------------------------------------------------------------------------
// Ingestor 2: Published CMS Suggestions
// ---------------------------------------------------------------------------

async function ingestCmsPublished(botId: string, projectId: string, since: Date): Promise<number> {
    const existing = await prisma.knowledgeSource.findFirst({
        where: { botId, type: 'CMS_PUBLISHED', createdAt: { gte: since } },
        select: { id: true },
    });
    if (existing) return 0;

    const connection = await prisma.cMSConnection.findFirst({
        where: { projectId },
        select: { id: true },
    });
    if (!connection) return 0;

    const suggestions = await prisma.cMSSuggestion.findMany({
        where: {
            connectionId: connection.id,
            status: 'PUBLISHED',
            publishedAt: { gte: since },
        },
        select: { title: true, body: true, type: true, metaDescription: true },
        orderBy: { publishedAt: 'desc' },
        take: 10,
    });

    if (!suggestions.length) return 0;

    const lines = suggestions
        .map(s => {
            const excerpt = sanitize(s.body, 400).substring(0, 400);
            return `- [${s.type}] ${sanitize(s.title, 150)}\n  ${excerpt}`;
        })
        .join('\n\n');

    await prisma.knowledgeSource.create({
        data: {
            botId,
            type: 'CMS_PUBLISHED',
            title: `Contenuti pubblicati di recente (${suggestions.length})`,
            content: `I seguenti contenuti sono stati pubblicati sul sito nell'ultima settimana:\n\n${lines}`,
        },
    });

    console.log(`[KB-Growth] Bot ${botId}: ${suggestions.length} CMS suggestions ingested`);
    return 1;
}

// ---------------------------------------------------------------------------
// Ingestor 3: High-importance SERP Data
// ---------------------------------------------------------------------------

async function ingestSerpData(botId: string, projectId: string, since: Date): Promise<number> {
    const existing = await prisma.knowledgeSource.findFirst({
        where: { botId, type: 'SERP_DATA', createdAt: { gte: since } },
        select: { id: true },
    });
    if (existing) return 0;

    const configIds = await prisma.visibilityConfig
        .findMany({ where: { projectId, isActive: true }, select: { id: true } })
        .then(cs => cs.map(c => c.id));
    if (!configIds.length) return 0;

    const scanIds = await prisma.serpMonitoringScan
        .findMany({
            where: { configId: { in: configIds }, startedAt: { gte: since } },
            select: { id: true },
        })
        .then(ss => ss.map(s => s.id));
    if (!scanIds.length) return 0;

    const results = await prisma.serpResult.findMany({
        where: {
            scanId: { in: scanIds },
            importanceScore: { gte: SERP_IMPORTANCE_THRESHOLD },
        },
        select: {
            title: true,
            snippet: true,
            topicCategory: true,
            contentSummary: true,
            sentiment: true,
            importanceScore: true,
        },
        orderBy: { importanceScore: 'desc' },
        take: 15,
    });

    if (!results.length) return 0;

    const lines = results
        .map(r => {
            const summary = sanitize(r.contentSummary || r.snippet, 350);
            const topic   = r.topicCategory ? ` [${r.topicCategory}]` : '';
            const sentimentLabel = r.sentiment === 'positive' ? '✓' : r.sentiment === 'negative' ? '✗' : '~';
            return `- ${sanitize(r.title, 150)}${topic} (sentiment: ${sentimentLabel})\n  ${summary}`;
        })
        .join('\n\n');

    await prisma.knowledgeSource.create({
        data: {
            botId,
            type: 'SERP_DATA',
            title: `Segnali web recenti su brand e settore (${results.length} risultati)`,
            content: `Dati raccolti da motori di ricerca e web sui temi rilevanti:\n\n${lines}`,
        },
    });

    console.log(`[KB-Growth] Bot ${botId}: ${results.length} SERP results ingested`);
    return 1;
}

// ---------------------------------------------------------------------------
// Ingestor 4: Cross-Channel Insights
// ---------------------------------------------------------------------------

async function ingestCrossChannelInsights(botId: string, projectId: string, since: Date): Promise<number> {
    const existing = await prisma.knowledgeSource.findFirst({
        where: { botId, type: 'CROSS_CHANNEL', createdAt: { gte: since } },
        select: { id: true },
    });
    if (existing) return 0;

    const insights = await prisma.crossChannelInsight.findMany({
        where: {
            projectId,
            createdAt: { gte: since },
            priorityScore: { gte: CROSS_CHANNEL_PRIORITY_THRESHOLD },
        },
        select: { topicName: true, suggestedActions: true, priorityScore: true },
        orderBy: { priorityScore: 'desc' },
        take: 10,
    });

    if (!insights.length) return 0;

    const lines = insights
        .map(i => {
            const actions = (i.suggestedActions as any[])
                ?.slice(0, 3)
                .map((a: any) => `  • ${sanitize(String(a.description || a.type || ''), 150)}`)
                .join('\n') || '';
            return `- ${sanitize(i.topicName, 100)} (priorità: ${Math.round(i.priorityScore)}):\n${actions}`;
        })
        .join('\n\n');

    await prisma.knowledgeSource.create({
        data: {
            botId,
            type: 'CROSS_CHANNEL',
            title: `Insight cross-canale recenti (${insights.length} temi)`,
            content: `Analisi integrata di interviste, chatbot e monitoraggio visibilità:\n\n${lines}`,
        },
    });

    console.log(`[KB-Growth] Bot ${botId}: ${insights.length} cross-channel insights ingested`);
    return 1;
}
