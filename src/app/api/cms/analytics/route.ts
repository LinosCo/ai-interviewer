import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

/**
 * GET /api/cms/analytics?range=7d|30d|90d&projectId=xxx
 * Get aggregated website analytics for a project with CMS.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = session.user.id;
        const userEmail = session.user.email;

        const url = new URL(request.url);
        const projectId = url.searchParams.get('projectId');
        const range = url.searchParams.get('range') || '30d';

        const activeOrgId = await resolveActiveOrganizationIdForUser(userId);

        // Verify user access and load org projects with CMS connections
        const user = await prisma.user.findUnique({
            where: { email: userEmail },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                projects: { include: { cmsConnection: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!user || user.memberships.length === 0) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        // Pick project:
        // - requested projectId when provided
        // - otherwise first project with CMS in active organization
        // - fallback to first project with CMS in any user organization
        let targetProjectId = projectId;
        if (!targetProjectId) {
            const activeMembership = activeOrgId
                ? user.memberships.find((m) => m.organizationId === activeOrgId)
                : undefined;

            const activeOrgProject = activeMembership?.organization.projects.find((p) => p.cmsConnection);
            if (activeOrgProject) {
                targetProjectId = activeOrgProject.id;
            } else {
                for (const membership of user.memberships) {
                    const project = membership.organization.projects.find((p) => p.cmsConnection);
                    if (project) {
                        targetProjectId = project.id;
                        break;
                    }
                }
            }
        }

        // Find CMS connection for target project
        let cmsConnection = null;
        for (const membership of user.memberships) {
            const project = membership.organization.projects.find(p => p.id === targetProjectId);
            if (project?.cmsConnection) {
                cmsConnection = project.cmsConnection;
                break;
            }
        }

        if (!cmsConnection) {
            return NextResponse.json({ error: 'CMS integration not enabled for this project' }, { status: 400 });
        }

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
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
                connectionId: cmsConnection.id,
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
