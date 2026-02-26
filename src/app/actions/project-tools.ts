'use server';

import crypto from 'crypto';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email';
import {
  WorkspaceError,
  assertOrganizationAccess,
  assertProjectAccess,
  autoFixToolOrganizationForProject,
  hasRequiredRole,
  moveProjectToOrganization
} from '@/lib/domain/workspace';

type TransferResult =
  | { success: true; mode: 'moved'; projectId: string; targetOrganizationId: string }
  | { success: true; mode: 'pending'; inviteId: string; recipientEmail: string; targetOrganizationId: string };

async function requireAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new WorkspaceError('Unauthorized', 401, 'UNAUTHORIZED');
  }
  return session.user.id;
}

async function verifyTransferPermissions(sourceProjectId: string, targetProjectId: string) {
  const userId = await requireAuthenticatedUser();
  const source = await assertProjectAccess(userId, sourceProjectId, 'ADMIN');
  const target = await assertProjectAccess(userId, targetProjectId, 'ADMIN');

  if (source.organizationId !== target.organizationId) {
    throw new WorkspaceError(
      'Tool transfer across organizations is not allowed. Move the project first.',
      422,
      'CROSS_ORG_TRANSFER_DENIED'
    );
  }

  return { userId, organizationId: source.organizationId };
}

async function enqueueProjectTransferInvite(params: {
  projectId: string;
  senderId: string;
  targetOrganizationId: string;
}): Promise<{ inviteId: string; recipientEmail: string }> {
  const { projectId, senderId, targetOrganizationId } = params;

  const targetAdmins = await prisma.membership.findMany({
    where: {
      organizationId: targetOrganizationId,
      status: 'ACTIVE',
      role: { in: ['OWNER', 'ADMIN'] }
    },
    include: {
      user: {
        select: { id: true, email: true }
      }
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }]
  });

  const recipient = targetAdmins.find((row) => row.userId !== senderId)?.user || targetAdmins[0]?.user;

  if (!recipient?.email) {
    throw new WorkspaceError(
      'No admin found in target organization to approve transfer',
      422,
      'TARGET_ORG_NO_ADMIN'
    );
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.projectTransferInvite.create({
    data: {
      projectId,
      partnerId: senderId,
      clientEmail: recipient.email.toLowerCase(),
      token,
      expiresAt,
      status: 'pending',
      personalMessage: JSON.stringify({ targetOrganizationId })
    }
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is not configured');
  }
  const acceptUrl = `${appUrl}/transfer/accept?token=${token}`;

  try {
    await sendEmail({
      to: recipient.email,
      subject: 'Richiesta approvazione trasferimento progetto',
      html: `
        <h2>Trasferimento progetto in attesa</h2>
        <p>Un amministratore ha richiesto il trasferimento di un progetto verso la tua organizzazione.</p>
        <p>Per approvare il trasferimento clicca il pulsante:</p>
        <a href="${acceptUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
          Approva trasferimento
        </a>
        <p style="margin-top:16px;color:#64748b;font-size:12px">Il link scade tra 7 giorni.</p>
      `
    });
  } catch (error) {
    // Invite remains valid even if email delivery fails.
    console.error('Failed to send transfer approval email:', error);
  }

  return { inviteId: invite.id, recipientEmail: recipient.email };
}

/**
 * Links a Visibility Config to a Project
 */
export async function linkVisibilityConfig(configId: string, projectId: string) {
  const userId = await requireAuthenticatedUser();
  const projectAccess = await assertProjectAccess(userId, projectId, 'ADMIN');

  const config = await prisma.visibilityConfig.findUnique({
    where: { id: configId },
    select: { organizationId: true }
  });

  if (!config || config.organizationId !== projectAccess.organizationId) {
    throw new WorkspaceError('Visibility config not found in this organization', 404, 'CONFIG_NOT_FOUND');
  }

  await prisma.visibilityConfig.update({
    where: { id: configId },
    data: { projectId }
  });

  await autoFixToolOrganizationForProject(projectId);
  revalidatePath(`/dashboard/admin/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

/**
 * Unlinks a Visibility Config from a Project
 */
export async function unlinkVisibilityConfig(configId: string, projectId: string) {
  const userId = await requireAuthenticatedUser();
  await assertProjectAccess(userId, projectId, 'ADMIN');

  await prisma.visibilityConfig.update({
    where: { id: configId },
    data: { projectId: null }
  });

  revalidatePath(`/dashboard/admin/projects/${projectId}`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

/**
 * Transfers a Bot to a Project
 */
export async function transferBotToProject(botId: string, targetProjectId: string) {
  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { projectId: true } });
  if (!bot) throw new WorkspaceError('Bot not found', 404, 'BOT_NOT_FOUND');

  await verifyTransferPermissions(bot.projectId, targetProjectId);

  await prisma.bot.update({
    where: { id: botId },
    data: { projectId: targetProjectId }
  });

  await autoFixToolOrganizationForProject(targetProjectId);

  revalidatePath(`/dashboard/bots/${botId}`);
  revalidatePath(`/dashboard/projects/${targetProjectId}`);
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Transfers an MCP Connection (Tool) to a Project
 */
export async function transferMCPConnectionToProject(connectionId: string, targetProjectId: string) {
  const connection = await prisma.mCPConnection.findUnique({
    where: { id: connectionId },
    select: { projectId: true }
  });
  if (!connection) throw new WorkspaceError('Connection not found', 404, 'MCP_NOT_FOUND');

  await verifyTransferPermissions(connection.projectId, targetProjectId);

  await prisma.mCPConnection.update({
    where: { id: connectionId },
    data: { projectId: targetProjectId }
  });

  await autoFixToolOrganizationForProject(targetProjectId);

  revalidatePath(`/dashboard/projects/${targetProjectId}/integrations`);
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Transfers a Google Connection to a Project
 */
export async function transferGoogleConnectionToProject(connectionId: string, targetProjectId: string) {
  const connection = await prisma.googleConnection.findUnique({
    where: { id: connectionId },
    select: { projectId: true }
  });
  if (!connection) throw new WorkspaceError('Connection not found', 404, 'GOOGLE_NOT_FOUND');

  await verifyTransferPermissions(connection.projectId, targetProjectId);

  await prisma.googleConnection.update({
    where: { id: connectionId },
    data: { projectId: targetProjectId }
  });

  await autoFixToolOrganizationForProject(targetProjectId);

  revalidatePath(`/dashboard/projects/${targetProjectId}/integrations`);
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Transfers a CMS Connection to a Project
 */
export async function transferCMSConnectionToProject(connectionId: string, targetProjectId: string) {
  const connection = await prisma.cMSConnection.findUnique({
    where: { id: connectionId },
    select: { projectId: true }
  });
  if (!connection?.projectId) {
    throw new WorkspaceError('Connection is not linked to a project', 422, 'CMS_ORPHAN_CONNECTION');
  }

  await verifyTransferPermissions(connection.projectId, targetProjectId);

  await prisma.cMSConnection.update({
    where: { id: connectionId },
    data: { projectId: targetProjectId }
  });

  await autoFixToolOrganizationForProject(targetProjectId);

  revalidatePath(`/dashboard/projects/${targetProjectId}/integrations`);
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Transfers a Project to another Organization.
 * Immediate move only when actor is ADMIN/OWNER in both source and target organizations.
 * Otherwise, create an approval invite for target organization admins.
 */
export async function transferProjectToOrganization(projectId: string, targetOrgId: string): Promise<TransferResult> {
  const userId = await requireAuthenticatedUser();
  const sourceAccess = await assertProjectAccess(userId, projectId, 'ADMIN');
  const targetAccess = await assertOrganizationAccess(userId, targetOrgId, 'VIEWER');

  const canMoveImmediately = hasRequiredRole(sourceAccess.role, 'ADMIN')
    && (targetAccess.isPlatformAdmin || hasRequiredRole(targetAccess.role, 'ADMIN'));

  if (canMoveImmediately) {
    await moveProjectToOrganization({
      projectId,
      targetOrganizationId: targetOrgId,
      actorUserId: userId
    });

    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard');
    return {
      success: true,
      mode: 'moved',
      projectId,
      targetOrganizationId: targetOrgId
    };
  }

  const invite = await enqueueProjectTransferInvite({
    projectId,
    senderId: userId,
    targetOrganizationId: targetOrgId
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath('/dashboard/projects');

  return {
    success: true,
    mode: 'pending',
    inviteId: invite.inviteId,
    recipientEmail: invite.recipientEmail,
    targetOrganizationId: targetOrgId
  };
}
