import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  WorkspaceError,
  assertProjectAccess,
  hasRequiredRole,
  syncLegacyProjectAccessForOrganization
} from '@/lib/domain/workspace';

const ALLOWED_INVITE_ROLES: Role[] = ['ADMIN', 'MEMBER', 'VIEWER'];

function toErrorResponse(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('Project access route error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const access = await assertProjectAccess(session.user.id, projectId, 'VIEWER');

    const memberships = await prisma.membership.findMany({
      where: {
        organizationId: access.organizationId,
        status: 'ACTIVE'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }]
    });

    return NextResponse.json({
      members: memberships.map((membership) => ({
        id: membership.id,
        userId: membership.userId,
        email: membership.user.email,
        name: membership.user.name,
        role: membership.role,
        createdAt: membership.createdAt
      })),
      currentUserRole: access.role,
      organizationId: access.organizationId
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const access = await assertProjectAccess(session.user.id, projectId, 'ADMIN');
    const body = await req.json();

    const email = String(body.email || '').trim().toLowerCase();
    const role = ALLOWED_INVITE_ROLES.includes(body.role as Role) ? (body.role as Role) : 'MEMBER';

    if (!email) {
      throw new WorkspaceError('Email is required', 400, 'INVALID_EMAIL');
    }

    const userToInvite = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true }
    });

    if (!userToInvite) {
      throw new WorkspaceError('Utente non trovato su Business Tuner.', 404, 'USER_NOT_FOUND');
    }

    const membership = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: userToInvite.id,
          organizationId: access.organizationId
        }
      },
      update: {
        status: 'ACTIVE',
        role,
        acceptedAt: new Date(),
        joinedAt: new Date()
      },
      create: {
        userId: userToInvite.id,
        organizationId: access.organizationId,
        role,
        status: 'ACTIVE',
        acceptedAt: new Date(),
        joinedAt: new Date()
      }
    });

    await syncLegacyProjectAccessForOrganization(access.organizationId);

    return NextResponse.json({
      id: membership.id,
      userId: userToInvite.id,
      email: userToInvite.email,
      name: userToInvite.name,
      role: membership.role,
      createdAt: membership.createdAt
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const access = await assertProjectAccess(session.user.id, projectId, 'ADMIN');
    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'transfer_ownership') {
      return NextResponse.json(
        { error: 'Project ownership transfer is deprecated. Use organization transfer.' },
        { status: 410 }
      );
    }

    if (action !== 'update_member_role') {
      throw new WorkspaceError('Invalid action', 400, 'INVALID_ACTION');
    }

    const targetUserId = String(body.targetUserId || '');
    const newRole = ALLOWED_INVITE_ROLES.includes(body.newRole as Role) ? (body.newRole as Role) : null;

    if (!targetUserId || !newRole) {
      throw new WorkspaceError('targetUserId and valid newRole are required', 400, 'INVALID_PAYLOAD');
    }

    const targetMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: access.organizationId
        }
      },
      select: { id: true, role: true }
    });

    if (!targetMembership) {
      throw new WorkspaceError('Member not found in organization', 404, 'MEMBER_NOT_FOUND');
    }

    await prisma.membership.update({
      where: { id: targetMembership.id },
      data: { role: newRole }
    });

    await syncLegacyProjectAccessForOrganization(access.organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId } = await params;
    const access = await assertProjectAccess(session.user.id, projectId, 'VIEWER');
    const { searchParams } = new URL(req.url);
    const requestedUserId = String(searchParams.get('userId') || '');
    const targetUserId = requestedUserId === 'self' ? session.user.id : requestedUserId;

    if (!targetUserId) {
      throw new WorkspaceError('userId is required', 400, 'MISSING_USER_ID');
    }

    const actorCanManageOthers = access.isPlatformAdmin || hasRequiredRole(access.role, 'ADMIN');
    const isSelfRemoval = targetUserId === session.user.id;

    if (!isSelfRemoval && !actorCanManageOthers) {
      throw new WorkspaceError('Only admins can remove organization members', 403, 'ACCESS_DENIED');
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: access.organizationId
        }
      },
      select: { id: true, role: true }
    });

    if (!membership) {
      throw new WorkspaceError('Member not found', 404, 'MEMBER_NOT_FOUND');
    }

    if (membership.role === 'OWNER') {
      const ownersCount = await prisma.membership.count({
        where: {
          organizationId: access.organizationId,
          status: 'ACTIVE',
          role: 'OWNER'
        }
      });

      if (ownersCount <= 1) {
        throw new WorkspaceError('Cannot remove the last owner of the organization', 403, 'LAST_OWNER');
      }
    }

    await prisma.membership.delete({
      where: { id: membership.id }
    });

    await syncLegacyProjectAccessForOrganization(access.organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
