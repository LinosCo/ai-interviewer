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
      select: {
        organizationId: true,
        role: true
      }
    });

    if (memberships.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const adminOrganizationIds = memberships
      .filter((membership) => membership.role === 'OWNER' || membership.role === 'ADMIN')
      .map((membership) => membership.organizationId);
    const memberOrganizationIds = memberships
      .filter((membership) => membership.role === 'MEMBER' || membership.role === 'VIEWER')
      .map((membership) => membership.organizationId);

    let adminProjects: { id: string; name: string; organizationId: string | null; createdAt: Date }[] = [];
    if (adminOrganizationIds.length > 0) {
      adminProjects = await prisma.project.findMany({
        where: { organizationId: { in: adminOrganizationIds } },
        select: {
          id: true,
          name: true,
          organizationId: true,
          createdAt: true
        },
        orderBy: [{ createdAt: 'asc' }]
      });
    }

    let memberProjects: { id: string; name: string; organizationId: string | null; createdAt: Date }[] = [];
    if (memberOrganizationIds.length > 0) {
      memberProjects = await prisma.project.findMany({
        where: {
          organizationId: { in: memberOrganizationIds },
          accessList: {
            some: { userId: session.user.id }
          }
        },
        select: {
          id: true,
          name: true,
          organizationId: true,
          createdAt: true
        },
        orderBy: [{ createdAt: 'asc' }]
      });
    }

    const projectMap = new Map<string, { id: string; name: string; organizationId: string | null; createdAt: Date }>();
    for (const project of [...adminProjects, ...memberProjects]) {
      projectMap.set(project.id, project);
    }

    const projects = Array.from(projectMap.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((project) => ({
        id: project.id,
        name: project.name,
        organizationId: project.organizationId
      }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Fetch all projects error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
