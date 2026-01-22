import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { googleAnalyticsService } from '@/lib/cms/google-analytics.service';
import { NextResponse } from 'next/server';

/**
 * GET /api/admin/organizations/[orgId]/cms/google/auth-url
 * Get the Google OAuth URL for connecting Analytics and Search Console.
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

        // Generate OAuth URL
        const authUrl = googleAnalyticsService.getAuthUrl(connection.id);

        return NextResponse.json({ authUrl });

    } catch (error: any) {
        console.error('Error generating Google auth URL:', error);
        return NextResponse.json(
            { error: 'Failed to generate auth URL' },
            { status: 500 }
        );
    }
}
