'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { PartnerService } from '@/services/partnerService';
import {
  WorkspaceError,
  assertOrganizationAccess,
  assertProjectAccess,
  moveProjectToOrganization
} from '@/lib/domain/workspace';

export type ItemTransferType = 'ORGANIZATION' | 'PROJECT' | 'BOT' | 'TOOL';

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

async function resolveDefaultOrganizationIdForUser(userId: string): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      status: 'ACTIVE'
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    select: { organizationId: true }
  });

  return membership?.organizationId || null;
}

export async function createTransferInvite(params: {
  itemId: string;
  itemType: ItemTransferType;
  recipientEmail: string;
  targetOrganizationId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new WorkspaceError('Unauthorized', 401, 'UNAUTHORIZED');

  const { itemId, itemType, recipientEmail, targetOrganizationId } = params;
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new WorkspaceError('Recipient email is required', 400, 'INVALID_EMAIL');
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const acceptUrl = `${getBaseUrl()}/transfer/accept?token=${token}`;

  if (itemType === 'PROJECT') {
    await assertProjectAccess(session.user.id, itemId, 'ADMIN');

    const existingInvite = await prisma.projectTransferInvite.findFirst({
      where: {
        projectId: itemId,
        status: 'pending',
        expiresAt: { gt: new Date() }
      },
      select: { id: true }
    });

    if (existingInvite) {
      throw new WorkspaceError('Esiste già un invito pendente per questo progetto', 409, 'INVITE_EXISTS');
    }

    const metadata = targetOrganizationId ? JSON.stringify({ targetOrganizationId }) : null;

    await prisma.projectTransferInvite.create({
      data: {
        projectId: itemId,
        partnerId: session.user.id,
        clientEmail: normalizedEmail,
        token,
        expiresAt,
        status: 'pending',
        personalMessage: metadata
      }
    });

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: 'Richiesta trasferimento progetto',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px">
            <h2 style="color:#0f172a">Richiesta trasferimento progetto</h2>
            <p style="color:#334155;line-height:1.5">È stato richiesto il trasferimento di un progetto verso la tua organizzazione.</p>
            <div style="margin:24px 0">
              <a href="${acceptUrl}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
                Apri richiesta
              </a>
            </div>
            <p style="color:#64748b;font-size:12px">Il link scade tra 7 giorni.</p>
          </div>
        `
      });
    } catch (error) {
      console.error('Failed to send project transfer email:', error);
    }

    return { success: true, token };
  }

  const invite = await prisma.itemTransferInvite.create({
    data: {
      itemId,
      itemType,
      recipientEmail: normalizedEmail,
      senderId: session.user.id,
      token,
      expiresAt,
      status: 'PENDING'
    }
  });

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: `Invito trasferimento ${itemType.toLowerCase()}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px">
          <h2 style="color:#0f172a">Invito trasferimento</h2>
          <p style="color:#334155;line-height:1.5">Hai ricevuto una richiesta di trasferimento per un item ${itemType.toLowerCase()}.</p>
          <div style="margin:24px 0">
            <a href="${acceptUrl}" style="display:inline-block;padding:12px 20px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
              Accetta trasferimento
            </a>
          </div>
          <p style="color:#64748b;font-size:12px">Il link scade tra 7 giorni.</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Failed to send transfer email:', error);
  }

  return { success: true, inviteId: invite.id };
}

async function acceptProjectTransferInvite(
  token: string,
  acceptingUserId: string
): Promise<{ success: true }> {
  const invite = await prisma.projectTransferInvite.findUnique({
    where: { token }
  });

  if (!invite) {
    throw new WorkspaceError('Invito non trovato', 404, 'INVITE_NOT_FOUND');
  }

  if (invite.status !== 'pending') {
    throw new WorkspaceError('Invito già utilizzato o non valido', 409, 'INVITE_NOT_PENDING');
  }

  if (new Date() > invite.expiresAt) {
    await prisma.projectTransferInvite.update({
      where: { id: invite.id },
      data: { status: 'expired' }
    });
    throw new WorkspaceError('Invito scaduto', 410, 'INVITE_EXPIRED');
  }

  const acceptingUser = await prisma.user.findUnique({
    where: { id: acceptingUserId },
    select: { email: true }
  });

  if (!acceptingUser?.email || acceptingUser.email.toLowerCase() !== invite.clientEmail.toLowerCase()) {
    throw new WorkspaceError('Questo invito è destinato a un altro utente', 403, 'INVITE_EMAIL_MISMATCH');
  }

  let targetOrganizationId: string | null = null;
  try {
    if (invite.personalMessage) {
      const parsed = JSON.parse(invite.personalMessage) as { targetOrganizationId?: string };
      targetOrganizationId = parsed.targetOrganizationId || null;
    }
  } catch {
    targetOrganizationId = null;
  }

  if (!targetOrganizationId) {
    targetOrganizationId = await resolveDefaultOrganizationIdForUser(acceptingUserId);
  }

  if (!targetOrganizationId) {
    throw new WorkspaceError('Nessuna organizzazione di destinazione disponibile', 422, 'TARGET_ORG_MISSING');
  }

  await assertOrganizationAccess(acceptingUserId, targetOrganizationId, 'ADMIN');

  await moveProjectToOrganization({
    projectId: invite.projectId,
    targetOrganizationId,
    actorUserId: acceptingUserId
  });

  await prisma.projectTransferInvite.update({
    where: { id: invite.id },
    data: {
      status: 'accepted',
      acceptedAt: new Date()
    }
  });

  await syncPartnerAttributionForAcceptedInvite({
    partnerId: invite.partnerId,
    acceptingUserId,
    projectId: invite.projectId
  });

  return { success: true };
}

async function syncPartnerAttributionForAcceptedInvite(params: {
  partnerId: string;
  acceptingUserId: string;
  projectId: string;
}) {
  const { partnerId, acceptingUserId, projectId } = params;

  const partner = await prisma.user.findUnique({
    where: { id: partnerId },
    select: { isPartner: true }
  });

  // Only partner-originated transfers generate partner attribution metadata.
  if (!partner?.isPartner) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existingAttribution = await tx.partnerClientAttribution.findUnique({
      where: { clientUserId: acceptingUserId }
    });

    if (!existingAttribution) {
      await tx.partnerClientAttribution.create({
        data: {
          partnerId,
          clientUserId: acceptingUserId,
          firstProjectId: projectId,
          status: 'active'
        }
      });
    } else if (existingAttribution.partnerId === partnerId && existingAttribution.status !== 'active') {
      await tx.partnerClientAttribution.update({
        where: { id: existingAttribution.id },
        data: {
          status: 'active',
          revokedAt: null,
          revokedReason: null
        }
      });
    }

    await tx.project.updateMany({
      where: {
        id: projectId,
        originPartnerId: null
      },
      data: {
        originPartnerId: partnerId
      }
    });
  });

  await PartnerService.refreshPartnerActiveClientsCount(partnerId);
  await PartnerService.updatePartnerStatus(partnerId);
}

async function acceptGenericItemInvite(
  token: string,
  acceptingUserId: string
): Promise<{ success: true }> {
  const invite = await prisma.itemTransferInvite.findUnique({
    where: { token }
  });

  if (!invite) {
    throw new WorkspaceError('Invito non trovato', 404, 'INVITE_NOT_FOUND');
  }

  if (invite.status !== 'PENDING') {
    throw new WorkspaceError('Invito già utilizzato o scaduto', 409, 'INVITE_NOT_PENDING');
  }

  if (new Date() > invite.expiresAt) {
    await prisma.itemTransferInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' }
    });
    throw new WorkspaceError('Invito scaduto', 410, 'INVITE_EXPIRED');
  }

  const user = await prisma.user.findUnique({
    where: { id: acceptingUserId },
    select: { email: true }
  });

  if (!user?.email || user.email.toLowerCase() !== invite.recipientEmail.toLowerCase()) {
    throw new WorkspaceError('Questo invito è destinato a un altro utente', 403, 'INVITE_EMAIL_MISMATCH');
  }

  if (invite.itemType === 'PROJECT') {
    const targetOrganizationId = await resolveDefaultOrganizationIdForUser(acceptingUserId);
    if (!targetOrganizationId) {
      throw new WorkspaceError('Nessuna organizzazione disponibile', 422, 'TARGET_ORG_MISSING');
    }

    await assertOrganizationAccess(acceptingUserId, targetOrganizationId, 'ADMIN');
    await moveProjectToOrganization({
      projectId: invite.itemId,
      targetOrganizationId,
      actorUserId: acceptingUserId
    });
  } else if (invite.itemType === 'BOT') {
    const targetOrganizationId = await resolveDefaultOrganizationIdForUser(acceptingUserId);
    if (!targetOrganizationId) {
      throw new WorkspaceError('Nessuna organizzazione disponibile', 422, 'TARGET_ORG_MISSING');
    }
    await assertOrganizationAccess(acceptingUserId, targetOrganizationId, 'ADMIN');

    const targetProject = await prisma.project.findFirst({
      where: { organizationId: targetOrganizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });

    if (!targetProject) {
      throw new WorkspaceError('Nessun progetto disponibile nella tua organizzazione', 422, 'TARGET_PROJECT_MISSING');
    }

    await prisma.bot.update({
      where: { id: invite.itemId },
      data: { projectId: targetProject.id }
    });
  } else if (invite.itemType === 'TOOL') {
    const targetOrganizationId = await resolveDefaultOrganizationIdForUser(acceptingUserId);
    if (!targetOrganizationId) {
      throw new WorkspaceError('Nessuna organizzazione disponibile', 422, 'TARGET_ORG_MISSING');
    }
    await assertOrganizationAccess(acceptingUserId, targetOrganizationId, 'ADMIN');

    const targetProject = await prisma.project.findFirst({
      where: { organizationId: targetOrganizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });

    if (!targetProject) {
      throw new WorkspaceError('Nessun progetto disponibile nella tua organizzazione', 422, 'TARGET_PROJECT_MISSING');
    }

    await prisma.mCPConnection.updateMany({
      where: { id: invite.itemId },
      data: { projectId: targetProject.id, organizationId: targetOrganizationId }
    });
    await prisma.googleConnection.updateMany({
      where: { id: invite.itemId },
      data: { projectId: targetProject.id }
    });
    await prisma.cMSConnection.updateMany({
      where: { id: invite.itemId },
      data: { projectId: targetProject.id, organizationId: targetOrganizationId }
    });
  } else if (invite.itemType === 'ORGANIZATION') {
    await assertOrganizationAccess(acceptingUserId, invite.itemId, 'OWNER');
  }

  await prisma.itemTransferInvite.update({
    where: { id: invite.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date()
    }
  });

  return { success: true };
}

export async function acceptTransferInvite(token: string) {
  const session = await auth();
  if (!session?.user?.id) throw new WorkspaceError('Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const genericInvite = await prisma.itemTransferInvite.findUnique({
      where: { token },
      select: { id: true }
    });

    if (genericInvite) {
      await acceptGenericItemInvite(token, session.user.id);
    } else {
      await acceptProjectTransferInvite(token, session.user.id);
    }
  } finally {
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/projects');
  }

  return { success: true };
}
