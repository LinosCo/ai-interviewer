import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { googleAnalyticsService } from '@/lib/cms/google-analytics.service';
import { searchConsoleService } from '@/lib/cms/search-console.service';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/organizations/[orgId]/cms/google/configure
 * Configure GA4 property and Search Console site.
 * Admin only.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { orgId } = await params;
        const body = await request.json();
        const { analyticsPropertyId, searchConsoleSiteUrl } = body;

        // Get connection for this organization
        const connection = await prisma.cMSConnection.findUnique({
            where: { organizationId: orgId }
        });

        if (!connection) {
            return NextResponse.json(
                { error: 'CMS connection not found for this organization' },
                { status: 404 }
            );
        }

        if (!connection.googleRefreshToken) {
            return NextResponse.json(
                { error: 'Google not connected. Please authorize first.' },
                { status: 400 }
            );
        }

        // Configure Analytics property
        if (analyticsPropertyId) {
            await googleAnalyticsService.configureProperty(connection.id, analyticsPropertyId);
        }

        // Configure Search Console site
        if (searchConsoleSiteUrl) {
            await searchConsoleService.configureSite(connection.id, searchConsoleSiteUrl);
        }

        // Update connection status
        const hasAnalytics = !!analyticsPropertyId || connection.googleAnalyticsConnected;
        const hasSearchConsole = !!searchConsoleSiteUrl || connection.searchConsoleConnected;

        let newStatus = connection.status;
        if (hasAnalytics && hasSearchConsole) {
            newStatus = connection.status === 'ACTIVE' ? 'ACTIVE' : 'PARTIAL';
        } else if (hasAnalytics || hasSearchConsole) {
            newStatus = 'GOOGLE_ONLY';
        }

        if (newStatus !== connection.status) {
            await prisma.cMSConnection.update({
                where: { id: connection.id },
                data: { status: newStatus }
            });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error configuring Google properties:', error);
        return NextResponse.json(
            { error: 'Failed to configure Google properties' },
            { status: 500 }
        );
    }
}
