import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * GET /api/cms/connection
 * Get the CMS connection status for the user's organization.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's organization
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
            return NextResponse.json({
                enabled: false,
                message: 'CMS integration is not enabled for this organization'
            });
        }

        const connection = org.cmsConnection;

        return NextResponse.json({
            enabled: true,
            connection: {
                name: connection.name,
                status: connection.status,
                lastSyncAt: connection.lastSyncAt,
                hasGoogleAnalytics: connection.googleAnalyticsConnected,
                hasSearchConsole: connection.searchConsoleConnected,
                cmsPublicUrl: connection.cmsPublicUrl,
                cmsDashboardUrl: connection.cmsDashboardUrl
            }
        });

    } catch (error: any) {
        console.error('Error getting CMS connection:', error);
        return NextResponse.json(
            { error: 'Failed to get CMS connection' },
            { status: 500 }
        );
    }
}
