import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { strategicVision: true, valueProposition: true }
        });

        return NextResponse.json(org);
    } catch (error) {
        console.error('Fetch org settings error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { strategicVision, valueProposition } = await request.json();

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { memberships: { take: 1 } }
        });

        const orgId = user?.memberships[0]?.organizationId;
        if (!orgId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const updatedOrg = await prisma.organization.update({
            where: { id: orgId },
            data: {
                strategicVision,
                valueProposition
            }
        });

        return NextResponse.json(updatedOrg);
    } catch (error) {
        console.error('Update org settings error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
