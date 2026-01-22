import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/analytics?range=7d|30d|90d
 * Get aggregated website analytics for the user's organization.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's organization with CMS connection
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                cmsConnection: true
                            }
                        }
                    }
                }
            }
        });

        if (!user || user.memberships.length === 0) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        const org = user.memberships[0].organization;

        if (!org.hasCMSIntegration || !org.cmsConnection) {
            return NextResponse.json({ error: 'CMS integration not enabled' }, { status: 400 });
        }

        const url = new URL(request.url);
        const range = url.searchParams.get('range') || '30d';

        // Calculate date range
        const endDate = new Date();
        let startDate = new Date();
        switch (range) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            default: // 30d
                startDate.setDate(endDate.getDate() - 30);
        }

        // Get analytics data
        const analytics = await prisma.websiteAnalytics.findMany({
            where: {
                connectionId: org.cmsConnection.id,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { date: 'asc' }
        });

        // Aggregate summary
        const summary = {
            pageviews: 0,
            uniqueVisitors: 0,
            avgSessionDuration: 0,
            bounceRate: 0,
            searchImpressions: 0,
            searchClicks: 0,
            avgPosition: 0
        };

        let sessionDurationCount = 0;
        let bounceRateCount = 0;
        let positionCount = 0;

        for (const a of analytics) {
            summary.pageviews += a.pageviews;
            summary.uniqueVisitors += a.uniqueVisitors;

            if (a.avgSessionDuration > 0) {
                summary.avgSessionDuration += a.avgSessionDuration;
                sessionDurationCount++;
            }

            if (a.bounceRate > 0) {
                summary.bounceRate += a.bounceRate;
                bounceRateCount++;
            }

            summary.searchImpressions += a.searchImpressions || 0;
            summary.searchClicks += a.searchClicks || 0;

            if (a.avgSearchPosition && a.avgSearchPosition > 0) {
                summary.avgPosition += a.avgSearchPosition;
                positionCount++;
            }
        }

        // Calculate averages
        if (sessionDurationCount > 0) {
            summary.avgSessionDuration = Math.round(summary.avgSessionDuration / sessionDurationCount);
        }
        if (bounceRateCount > 0) {
            summary.bounceRate = summary.bounceRate / bounceRateCount;
        }
        if (positionCount > 0) {
            summary.avgPosition = summary.avgPosition / positionCount;
        }

        // Build trends data
        const trends = {
            pageviews: analytics.map(a => ({
                date: a.date.toISOString().split('T')[0],
                value: a.pageviews
            })),
            visitors: analytics.map(a => ({
                date: a.date.toISOString().split('T')[0],
                value: a.uniqueVisitors
            }))
        };

        // Get top pages from the most recent analytics record
        const latestAnalytics = analytics[analytics.length - 1];
        const topPages = (latestAnalytics?.topPages as any[]) || [];
        const topSearchQueries = (latestAnalytics?.topSearchQueries as any[]) || [];

        return NextResponse.json({
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            },
            summary,
            trends,
            topPages: topPages.slice(0, 10),
            topSearchQueries: topSearchQueries.slice(0, 10)
        });

    } catch (error: any) {
        console.error('Error getting CMS analytics:', error);
        return NextResponse.json(
            { error: 'Failed to get analytics' },
            { status: 500 }
        );
    }
}
