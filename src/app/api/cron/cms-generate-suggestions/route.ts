import { prisma } from '@/lib/prisma';
import { CMSSuggestionGenerator } from '@/lib/cms/suggestion-generator';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cms-generate-suggestions
 * Daily cron job to generate CMS suggestions from recent CrossChannelInsights.
 * Run at 05:00 AM daily (after analytics sync and insights sync).
 */
export async function GET(req: Request) {
    try {
        // Verify cron secret (optional, for security)
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Get all organizations with CMS integration
        const orgsWithCMS = await prisma.organization.findMany({
            where: {
                hasCMSIntegration: true,
                cmsConnection: {
                    status: { in: ['ACTIVE', 'PARTIAL'] }
                }
            },
            include: {
                cmsConnection: true
            }
        });

        console.log(`[CMS Suggestions] Starting generation for ${orgsWithCMS.length} organizations`);

        const results: { orgId: string; suggestionsGenerated: number; error?: string }[] = [];

        for (const org of orgsWithCMS) {
            try {
                // Get recent CrossChannelInsights with content-related actions
                const recentInsights = await prisma.crossChannelInsight.findMany({
                    where: {
                        organizationId: org.id,
                        status: 'new',
                        createdAt: {
                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                        }
                    },
                    orderBy: { priorityScore: 'desc' },
                    take: 10
                });

                let suggestionsGenerated = 0;

                for (const insight of recentInsights) {
                    const actions = insight.suggestedActions as any[];
                    const contentActions = actions?.filter(a =>
                        a.type === 'create_content' ||
                        a.type === 'modify_content' ||
                        a.target === 'website'
                    ) || [];

                    if (contentActions.length > 0) {
                        try {
                            const suggestionIds = await CMSSuggestionGenerator.generateFromInsight(insight.id);
                            suggestionsGenerated += suggestionIds.length;

                            // Mark insight as processed (optional)
                            if (suggestionIds.length > 0) {
                                await prisma.crossChannelInsight.update({
                                    where: { id: insight.id },
                                    data: { status: 'processed' }
                                });
                            }
                        } catch (genError: any) {
                            console.error(`[CMS Suggestions] Error generating from insight ${insight.id}:`, genError.message);
                        }
                    }
                }

                results.push({ orgId: org.id, suggestionsGenerated });
                console.log(`[CMS Suggestions] Org ${org.id}: ${suggestionsGenerated} suggestions generated`);

            } catch (error: any) {
                console.error(`[CMS Suggestions] Error for org ${org.id}:`, error);
                results.push({ orgId: org.id, suggestionsGenerated: 0, error: error.message });
            }
        }

        const totalSuggestions = results.reduce((sum, r) => sum + r.suggestionsGenerated, 0);
        console.log(`[CMS Suggestions] Completed: ${totalSuggestions} total suggestions generated`);

        return NextResponse.json({
            success: true,
            processed: orgsWithCMS.length,
            totalSuggestions,
            results
        });

    } catch (error: any) {
        console.error('[CMS Suggestions] Cron failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
