import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
        status: 'ACTIVE'
      },
      select: { organizationId: true }
    });

    const organizationIds = memberships.map((membership) => membership.organizationId);
    if (organizationIds.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const projects = await prisma.project.findMany({
      where: {
        organizationId: { in: organizationIds }
      },
      select: {
        id: true,
        name: true,
        organizationId: true
      },
      orderBy: [{ createdAt: 'asc' }]
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Fetch all projects error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
