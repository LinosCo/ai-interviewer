import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

/**
 * GET /api/visibility/analytics?configId=xxx
 * Returns historical scan data, source analytics, and GAP analysis
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('configId');

        if (!configId) {
            return NextResponse.json({ error: 'configId required' }, { status: 400 });
        }

        // Verify access to config
        const orgId = await resolveActiveOrganizationIdForUser(session.user.id);
        if (!orgId) {
            return NextResponse.json({ error: 'No organization' }, { status: 403 });
        }

        const config = await prisma.visibilityConfig.findFirst({
            where: { id: configId, organizationId: orgId },
            include: { competitors: true }
        });

        if (!config) {
            return NextResponse.json({ error: 'Config not found' }, { status: 404 });
        }

        // 1. Fetch historical scans for trend chart (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const historicalScans = await prisma.visibilityScan.findMany({
            where: {
                configId,
                status: 'completed',
                completedAt: { gte: thirtyDaysAgo }
            },
            orderBy: { completedAt: 'asc' },
            select: {
                id: true,
                completedAt: true,
                score: true
            }
        });

        // Format for trend chart
        const trendData = historicalScans.map(scan => ({
            date: scan.completedAt?.toISOString().split('T')[0] || '',
            dateLabel: scan.completedAt?.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) || '',
            score: Math.round(scan.score),
            scanId: scan.id
        }));

        // 2. Fetch all responses for source and GAP analysis
        const latestScan = await prisma.visibilityScan.findFirst({
            where: { configId, status: 'completed' },
            orderBy: { completedAt: 'desc' },
            include: {
                responses: {
                    select: {
                        brandMentioned: true,
                        brandPosition: true,
                        competitorPositions: true,
                        sourcesCited: true,
                        platform: true
                    }
                }
            }
        });

        // 3. Source Usage Tracking with GAP Analysis
        const sourceAnalysis: Record<string, {
            count: number;
            withBrand: number;
            withoutBrand: number;
            competitorMentions: Record<string, number>;
            platforms: Set<string>;
        }> = {};

        if (latestScan) {
            latestScan.responses.forEach(response => {
                const sources = response.sourcesCited || [];
                const competitorPositions = response.competitorPositions as Record<string, number | null>;

                sources.forEach(source => {
                    if (!source) return;
                    const normalizedSource = source.toLowerCase().trim();

                    if (!sourceAnalysis[normalizedSource]) {
                        sourceAnalysis[normalizedSource] = {
                            count: 0,
                            withBrand: 0,
                            withoutBrand: 0,
                            competitorMentions: {},
                            platforms: new Set()
                        };
                    }

                    sourceAnalysis[normalizedSource].count++;
                    sourceAnalysis[normalizedSource].platforms.add(response.platform);

                    if (response.brandMentioned) {
                        sourceAnalysis[normalizedSource].withBrand++;
                    } else {
                        sourceAnalysis[normalizedSource].withoutBrand++;
                    }

                    // Track which competitors appear with this source
                    Object.entries(competitorPositions).forEach(([competitor, position]) => {
                        if (position !== null) {
                            sourceAnalysis[normalizedSource].competitorMentions[competitor] =
                                (sourceAnalysis[normalizedSource].competitorMentions[competitor] || 0) + 1;
                        }
                    });
                });
            });
        }

        // Convert to array and calculate GAP score
        const sourcesWithGap = Object.entries(sourceAnalysis).map(([source, data]) => {
            const competitorCount = Object.keys(data.competitorMentions).length;
            const totalCompetitorMentions = Object.values(data.competitorMentions).reduce((a, b) => a + b, 0);

            // GAP Score: High if competitors appear but brand doesn't
            // Formula: (competitor mentions without brand) / total * 100
            const gapScore = data.withoutBrand > 0 && totalCompetitorMentions > 0
                ? Math.round((totalCompetitorMentions / data.count) * (data.withoutBrand / data.count) * 100)
                : 0;

            return {
                source,
                displayName: source.startsWith('http')
                    ? new URL(source).hostname.replace('www.', '')
                    : source,
                count: data.count,
                withBrand: data.withBrand,
                withoutBrand: data.withoutBrand,
                competitorCount,
                totalCompetitorMentions,
                competitors: Object.entries(data.competitorMentions)
                    .map(([name, mentions]) => ({ name, mentions }))
                    .sort((a, b) => b.mentions - a.mentions),
                platforms: Array.from(data.platforms),
                gapScore,
                opportunity: gapScore > 50 ? 'high' : gapScore > 25 ? 'medium' : 'low',
                suggestion: getSuggestion(source, gapScore, data.competitorMentions)
            };
        });

        // Sort by GAP score (opportunities first)
        const gapAnalysis = sourcesWithGap
            .filter(s => s.gapScore > 0)
            .sort((a, b) => b.gapScore - a.gapScore)
            .slice(0, 15);

        // Top sources by frequency
        const topSources = sourcesWithGap
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);

        // 4. Calculate overall stats
        const totalResponses = latestScan?.responses.length || 0;
        const brandMentions = latestScan?.responses.filter(r => r.brandMentioned).length || 0;
        const avgBrandPosition = calculateAvgPosition(latestScan?.responses || []);

        return NextResponse.json({
            trendData,
            gapAnalysis,
            topSources,
            stats: {
                totalResponses,
                brandMentions,
                brandMentionRate: totalResponses > 0 ? Math.round((brandMentions / totalResponses) * 100) : 0,
                avgBrandPosition,
                totalSources: Object.keys(sourceAnalysis).length,
                gapOpportunities: gapAnalysis.filter(g => g.opportunity === 'high').length
            }
        });

    } catch (error) {
        console.error('Error fetching visibility analytics:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

function calculateAvgPosition(responses: { brandPosition: number | null }[]): number | null {
    const positions = responses.filter(r => r.brandPosition !== null).map(r => r.brandPosition!);
    if (positions.length === 0) return null;
    return Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10;
}

function getSuggestion(source: string, gapScore: number, competitors: Record<string, number>): string {
    const topCompetitors = Object.entries(competitors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([name]) => name);

    const competitorText = topCompetitors.length > 0
        ? `(${topCompetitors.join(', ')} già presenti)`
        : '';

    if (source.includes('wikipedia') || source.includes('wiki')) {
        return `Crea o aggiorna una pagina Wikipedia ${competitorText}`;
    }
    if (source.includes('reddit')) {
        return `Partecipa alle discussioni su Reddit ${competitorText}`;
    }
    if (source.includes('quora')) {
        return `Rispondi a domande rilevanti su Quora ${competitorText}`;
    }
    if (source.includes('linkedin')) {
        return `Aumenta la presenza su LinkedIn ${competitorText}`;
    }
    if (source.includes('youtube')) {
        return `Crea contenuti video su YouTube ${competitorText}`;
    }
    if (gapScore > 50) {
        return `Valuta una partnership o guest post ${competitorText}`;
    }
    if (gapScore > 25) {
        return `Monitora questa fonte per opportunità PR ${competitorText}`;
    }
    return `Analizza se questa fonte è rilevante per il tuo settore`;
}
