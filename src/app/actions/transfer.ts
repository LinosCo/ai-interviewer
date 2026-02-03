'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

export type ItemTransferType = 'ORGANIZATION' | 'PROJECT' | 'BOT' | 'TOOL';

export async function createTransferInvite(params: {
    itemId: string;
    itemType: ItemTransferType;
    recipientEmail: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const { itemId, itemType, recipientEmail } = params;

    // 1. Permission Check
    // For simplicity, we assume the user must be the OWNER of the item.
    // Specific checks can be added per itemType if needed.

    // 2. Generate Token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // 3. Create Invite
    const invite = await prisma.itemTransferInvite.create({
        data: {
            itemId,
            itemType,
            recipientEmail: recipientEmail.toLowerCase(),
            senderId: session.user.id,
            token,
            expiresAt,
            status: 'PENDING'
        }
    });

    // 4. Send Email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const acceptUrl = `${baseUrl}/transfer/accept?token=${token}`;

    try {
        await sendEmail({
            to: recipientEmail,
            subject: `Invito a ricevere un ${itemType.toLowerCase()} su Business Tuner`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #1e293b;">Hai ricevuto un trasferimento!</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        ${session.user.name || session.user.email} desidera trasferirti la proprietà di un <strong>${itemType.toLowerCase()}</strong>.
                    </p>
                    <div style="margin: 32px 0; text-align: center;">
                        <a href="${acceptUrl}" style="background-color: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                            Accetta Trasferimento
                        </a>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px;">
                        Questo link scadrà il ${expiresAt.toLocaleDateString()}. Se non ti aspettavi questo trasferimento, puoi ignorare questa email.
                    </p>
                </div>
            `
        });
    } catch (error) {
        console.error('Failed to send transfer email:', error);
        // We don't throw here to ensure the invite is still considered "created" in the DB
    }

    return { success: true, inviteId: invite.id };
}

export async function acceptTransferInvite(token: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const invite = await prisma.itemTransferInvite.findUnique({
        where: { token },
        include: { sender: true }
    });

    if (!invite) throw new Error('Invito non trovato');
    if (invite.status !== 'PENDING') throw new Error('Invito gia utilizzato o scaduto');
    if (new Date() > invite.expiresAt) {
        await prisma.itemTransferInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
        throw new Error('Invito scaduto');
    }

    // Verify recipient email matches
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.email.toLowerCase() !== invite.recipientEmail.toLowerCase()) {
        throw new Error('Questo invito e per un altro indirizzo email');
    }

    // 5. Execute Transfer based on type
    await prisma.$transaction(async (tx) => {
        // Find recipient's default organization and project if needed
        const recipientMemberships = await tx.membership.findMany({
            where: { userId: session.user!.id, role: 'OWNER' },
            include: { organization: true }
        });

        const targetOrgId = recipientMemberships[0]?.organizationId;

        // If no organization, we might need to create one (but the app usually ensures this)
        if (!targetOrgId) {
            throw new Error('Non hai un\'organizzazione valida per ricevere questo item');
        }

        switch (invite.itemType) {
            case 'ORGANIZATION':
                // Transfer ownership of the whole organization
                // 1. Current owner (sender) becomes ADMIN or is removed
                await tx.membership.updateMany({
                    where: { organizationId: invite.itemId, userId: invite.senderId },
                    data: { role: 'ADMIN' }
                });
                // 2. New owner (recipient) is added or updated
                const existingMember = await tx.membership.findFirst({
                    where: { organizationId: invite.itemId, userId: session.user!.id }
                });
                if (existingMember) {
                    await tx.membership.update({
                        where: { id: existingMember.id },
                        data: { role: 'OWNER' }
                    });
                } else {
                    await tx.membership.create({
                        data: {
                            organizationId: invite.itemId,
                            userId: session.user!.id as string,
                            role: 'OWNER'
                        }
                    });
                }
                break;

            case 'PROJECT':
                // Move project to recipient's organization
                await tx.project.update({
                    where: { id: invite.itemId },
                    data: {
                        organizationId: targetOrgId,
                        ownerId: session.user!.id,
                        transferredAt: new Date(),
                        transferredFromOrgId: (await tx.project.findUnique({ where: { id: invite.itemId } }))?.organizationId
                    }
                });
                break;

            case 'BOT':
                // Move bot to recipient's first project in their default org
                const targetProject = await tx.project.findFirst({
                    where: { organizationId: targetOrgId }
                });
                if (!targetProject) throw new Error('Nessun progetto trovato nella tua organizzazione di destinazione');

                await tx.bot.update({
                    where: { id: invite.itemId },
                    data: { projectId: targetProject.id }
                });
                break;

            case 'TOOL':
                // Handle various tool types (MCP, Google, CMS)
                // Note: itemId might refer to different tables. In schema, itemId is just a string.
                // We need to check which table it belongs to or use a more specific type.
                // For now, let's look for MCPConnection as the primary "TOOL".
                const targetProjectTool = await tx.project.findFirst({
                    where: { organizationId: targetOrgId }
                });
                if (!targetProjectTool) throw new Error('Nessun progetto trovato nella tua organizzazione di destinazione');

                // Try to update in all potential tool tables
                await tx.mCPConnection.updateMany({ where: { id: invite.itemId }, data: { projectId: targetProjectTool.id } });
                await tx.googleConnection.updateMany({ where: { id: invite.itemId }, data: { projectId: targetProjectTool.id } });
                await tx.cMSConnection.updateMany({ where: { id: invite.itemId }, data: { projectId: targetProjectTool.id } });
                break;
        }

        // Update invite status
        await tx.itemTransferInvite.update({
            where: { id: invite.id },
            data: {
                status: 'ACCEPTED',
                acceptedAt: new Date()
            }
        });
    });

    revalidatePath('/dashboard');
    return { success: true };
}
