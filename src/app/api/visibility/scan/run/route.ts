import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { VisibilityEngine } from '@/lib/visibility/visibility-engine';
import { checkResourceAccess } from '@/lib/guards/resourceGuard';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    take: 1,
                    include: { organization: true }
                }
            }
        });

        if (!user || !user.memberships[0]) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const organizationId = user.memberships[0].organizationId;

        // Check plan limits via ResourceGuard
        const access = await checkResourceAccess('VISIBILITY_QUERY');
        if (!access.allowed) {
            return NextResponse.json(
                { error: access.error },
                { status: access.status }
            );
        }

        const config = await prisma.visibilityConfig.findFirst({
            where: { organizationId },
            include: { organization: true }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Check 24h cooldown - find last scan for this config
        const lastScan = await prisma.visibilityScan.findFirst({
            where: { configId: config.id },
            orderBy: { startedAt: 'desc' }
        });

        if (lastScan) {
            const hoursSinceLastScan = (Date.now() - new Date(lastScan.startedAt).getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastScan < 24) {
                const hoursRemaining = Math.ceil(24 - hoursSinceLastScan);
                return NextResponse.json(
                    {
                        error: `Cooldown attivo. Prossimo scan disponibile tra ${hoursRemaining} ore.`,
                        cooldownRemaining: hoursRemaining,
                        nextAvailable: new Date(new Date(lastScan.startedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
                    },
                    { status: 429 }
                );
            }
        }

        // Create today date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);

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
