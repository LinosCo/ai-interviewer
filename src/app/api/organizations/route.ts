import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateDefaultOrganization } from '@/lib/organizations';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
        status: 'ACTIVE'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            monthlyCreditsLimit: true,
            monthlyCreditsUsed: true,
            packCreditsAvailable: true
          }
        }
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }]
    });

    if (memberships.length === 0) {
      const organization = await getOrCreateDefaultOrganization(session.user.id);
      memberships = await prisma.membership.findMany({
        where: {
          userId: session.user.id,
          organizationId: organization.id
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              monthlyCreditsLimit: true,
              monthlyCreditsUsed: true,
              packCreditsAvailable: true
            }
          }
        }
      });
    }

    const organizations = memberships.map((membership) => ({
      ...membership.organization,
      role: membership.role,
      monthlyCreditsLimit: membership.organization.monthlyCreditsLimit?.toString(),
      monthlyCreditsUsed: membership.organization.monthlyCreditsUsed?.toString(),
      packCreditsAvailable: membership.organization.packCreditsAvailable?.toString()
    }));

    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error('Organizations route error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
