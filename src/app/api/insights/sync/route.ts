import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { CrossChannelSyncEngine } from '@/lib/insights/sync-engine';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { memberships: { take: 1 } }
        });

        const orgId = user?.memberships[0]?.organizationId;
        if (!orgId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const insights = await CrossChannelSyncEngine.sync(orgId);

        return NextResponse.json({
            success: true,
            count: insights.length,
            insights
        });

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Failed to sync insights' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { memberships: { take: 1 } }
        });

        const orgId = user?.memberships[0]?.organizationId;
        if (!orgId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const insights = await prisma.crossChannelInsight.findMany({
            where: { organizationId: orgId },
            orderBy: { priorityScore: 'desc' }
        });

        return NextResponse.json({ insights });

    } catch (error) {
        console.error('Fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }
}
