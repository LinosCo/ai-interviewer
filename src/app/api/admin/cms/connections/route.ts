import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/cms/connections
 * List all CMS connections across all projects.
 * Admin only.
 */
export async function GET(request: Request) {
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

        const connections = await CMSConnectionService.getAllConnections();

        // Transform for response
        const response = connections.map((conn: any) => ({
            id: conn.id,
            name: conn.name,
            status: conn.status,
            project: {
                id: conn.project.id,
                name: conn.project.name,
                organization: conn.project.organization ? {
                    id: conn.project.organization.id,
                    name: conn.project.organization.name,
                    slug: conn.project.organization.slug
                } : null,
                owner: conn.project.owner ? {
                    id: conn.project.owner.id,
                    name: conn.project.owner.name,
                    email: conn.project.owner.email
                } : null
            },
            cmsApiUrl: conn.cmsApiUrl,
            cmsPublicUrl: conn.cmsPublicUrl,
            apiKeyPreview: `${conn.apiKeyPrefix}...${conn.apiKeyLastChars}`,
            googleAnalyticsConnected: conn.googleAnalyticsConnected,
            searchConsoleConnected: conn.searchConsoleConnected,
            lastPingAt: conn.lastPingAt,
            lastSyncAt: conn.lastSyncAt,
            lastSyncError: conn.lastSyncError,
            suggestionsCount: conn._count.suggestions,
            analyticsCount: conn._count.analytics,
            enabledAt: conn.enabledAt,
            enabledBy: conn.enabledBy
        }));

        return NextResponse.json({ connections: response });

    } catch (error: any) {
        console.error('Error listing CMS connections:', error);
        return NextResponse.json(
            { error: 'Failed to list CMS connections' },
            { status: 500 }
        );
    }
}
