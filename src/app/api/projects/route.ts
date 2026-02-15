import { z } from 'zod';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { WorkspaceError, assertOrganizationAccess, syncLegacyProjectAccessForProject } from '@/lib/domain/workspace';
import { createProjectWithNameGuard } from '@/lib/projects/create-project';

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Nome progetto richiesto'),
  organizationId: z.string().optional()
});

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
  }
  console.error('Projects API error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ projects: [], isOrgAdmin: false });
    }

    const access = await assertOrganizationAccess(session.user.id, organizationId, 'VIEWER');
    const isOrgAdmin = access.isPlatformAdmin || ['OWNER', 'ADMIN'].includes(access.role);

    const projects = await prisma.project.findMany({
      where: isOrgAdmin
        ? { organizationId }
        : {
            organizationId,
            accessList: {
              some: { userId: session.user.id }
            }
          },
      select: {
        id: true,
        name: true,
        isPersonal: true,
        createdAt: true,
        accessList: {
          where: { userId: session.user.id },
          select: { role: true },
          take: 1
        }
      },
      orderBy: [{ createdAt: 'asc' }]
    });

    return NextResponse.json({
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        isPersonal: project.isPersonal,
        createdAt: project.createdAt,
        role: isOrgAdmin || project.accessList[0]?.role === 'OWNER' ? 'OWNER' : 'MEMBER'
      })),
      isOrgAdmin
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, organizationId } = createProjectSchema.parse(body);

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id, status: 'ACTIVE' },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: { organizationId: true }
    });

    const finalOrgId = organizationId || memberships[0]?.organizationId;
    if (!finalOrgId) {
      throw new WorkspaceError('Nessuna organizzazione trovata per l\'utente', 403, 'ORG_NOT_FOUND');
    }

    await assertOrganizationAccess(session.user.id, finalOrgId, 'ADMIN');

    const { project, created } = await createProjectWithNameGuard({
      name,
      organizationId: finalOrgId,
      ownerId: session.user.id,
      isPersonal: false
    });

    if (created) {
      await syncLegacyProjectAccessForProject(project.id);
    }

    return NextResponse.json(project);
  } catch (error) {
    return toErrorResponse(error);
  }
}
