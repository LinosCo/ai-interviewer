import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { googleAnalyticsService } from '@/lib/cms/google-analytics.service';
import { searchConsoleService } from '@/lib/cms/search-console.service';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/organizations/[orgId]/cms/google/properties
 * List available GA4 properties and Search Console sites.
 * Admin only.
 */
export async function GET(
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

        // Fetch available properties from both services
        const [analyticsAccounts, searchConsoleSites] = await Promise.all([
            googleAnalyticsService.listProperties(connection.id).catch(err => {
                console.error('Error listing GA properties:', err);
                return [];
            }),
            searchConsoleService.listSites(connection.id).catch(err => {
                console.error('Error listing SC sites:', err);
                return [];
            })
        ]);

        return NextResponse.json({
            analytics: {
                accounts: analyticsAccounts
            },
            searchConsole: {
                sites: searchConsoleSites
            }
        });

    } catch (error: any) {
        console.error('Error listing Google properties:', error);
        return NextResponse.json(
            { error: 'Failed to list Google properties' },
            { status: 500 }
        );
    }
}
