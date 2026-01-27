import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(
    req: Request,
    { params }: { params: { orgId: string } }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orgId } = await params;

        // Verify membership
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: orgId
                }
            }
        });

        if (!membership && (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Fetch organization settings
        const settings = await prisma.platformSettings.findUnique({
            where: { organizationId: orgId }
        });

        // If admin, also return global config
        let globalConfig = null;
        if ((session.user as any).role === 'ADMIN') {
            globalConfig = await prisma.globalConfig.findUnique({
                where: { id: "default" }
            });
        }

        return NextResponse.json({
            settings,
            globalConfig
        });
    } catch (error) {
        console.error('Error fetching organization settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
