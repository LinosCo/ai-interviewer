import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { VisibilityEngine } from '@/lib/visibility/visibility-engine';
import { checkResourceAccess } from '@/lib/guards/resourceGuard';

// Extend timeout for long-running scans (5 minutes)
export const maxDuration = 300;

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get configId from request body
        const body = await request.json().catch(() => ({}));
        const { configId } = body;
        if (!configId) {
            return NextResponse.json({ error: 'configId required' }, { status: 400 });
        }

        // Find the specific config by id and authorize by membership on config organization.
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            include: {
                project: {
                    select: { id: true, ownerId: true }
                }
            }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: config.organizationId
                }
            },
            select: { organizationId: true }
        });

        if (!membership) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Check plan limits - usa l'owner del progetto
        const projectId = config.projectId || config.project?.id;
        const access = await checkResourceAccess('VISIBILITY_QUERY', 0, { projectId: projectId || undefined });

        if (!access.allowed) {
            return NextResponse.json(
                { error: access.error },
                { status: access.status }
            );
        }

        // No cooldown - scans only consume AI credits from the plan
        // Run the scan
        const result = await VisibilityEngine.runScan(config.id);

        return NextResponse.json({
            success: true,
            scanId: result.scanId,
            partial: result.partial,
            message: result.partial
                ? 'Scan completed with some providers skipped (check API keys).'
                : 'Scan completed successfully.'
        });

    } catch (error) {
        console.error('Error running scan:', error);
        return NextResponse.json(
            { error: 'Failed to run scan' },
            { status: 500 }
        );
    }
}
