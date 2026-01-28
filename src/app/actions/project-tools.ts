'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

/**
 * Links a Visibility Config to a Project
 */
export async function linkVisibilityConfig(configId: string, projectId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    await prisma.visibilityConfig.update({
        where: { id: configId },
        data: { projectId }
    });

    revalidatePath(`/dashboard/admin/projects/${projectId}`);
    return { success: true };
}

/**
 * Unlinks a Visibility Config from a Project
 */
export async function unlinkVisibilityConfig(configId: string, projectId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    await prisma.visibilityConfig.update({
        where: { id: configId },
        data: { projectId: null }
    });

    revalidatePath(`/dashboard/admin/projects/${projectId}`);
    return { success: true };
}

/**
 * Common permission check for transferring items between projects
 */
async function verifyTransferPermissions(sourceProjectId: string, targetProjectId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { projectAccess: true }
    });

    if (!user) throw new Error('User not found');

    const isAdmin = user.role === 'ADMIN';
    const hasSourceAccess = isAdmin || user.projectAccess.some(pa => pa.projectId === sourceProjectId && pa.role === 'OWNER');
    const hasTargetAccess = isAdmin || user.projectAccess.some(pa => pa.projectId === targetProjectId && pa.role === 'OWNER');

    if (!hasSourceAccess || !hasTargetAccess) {
        throw new Error('Insufficient permissions. You must be the owner of both projects to transfer items.');
    }

    return user;
}

/**
 * Transfers a Bot to a Project
 */
export async function transferBotToProject(botId: string, targetProjectId: string) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new Error('Bot not found');

    await verifyTransferPermissions(bot.projectId, targetProjectId);

    await prisma.bot.update({
        where: { id: botId },
        data: { projectId: targetProjectId }
    });

    revalidatePath(`/dashboard/bots/${botId}`);
    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Transfers an MCP Connection (Tool) to a Project
 */
export async function transferMCPConnectionToProject(connectionId: string, targetProjectId: string) {
    const connection = await prisma.mCPConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new Error('Connection not found');

    await verifyTransferPermissions(connection.projectId, targetProjectId);

    await prisma.mCPConnection.update({
        where: { id: connectionId },
        data: { projectId: targetProjectId }
    });

    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Transfers a Google Connection to a Project
 */
export async function transferGoogleConnectionToProject(connectionId: string, targetProjectId: string) {
    const connection = await prisma.googleConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new Error('Connection not found');

    await verifyTransferPermissions(connection.projectId, targetProjectId);

    await prisma.googleConnection.update({
        where: { id: connectionId },
        data: { projectId: targetProjectId }
    });

    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Transfers a CMS Connection to a Project
 */
export async function transferCMSConnectionToProject(connectionId: string, targetProjectId: string) {
    const connection = await prisma.cMSConnection.findUnique({ where: { id: connectionId } });
    if (!connection) throw new Error('Connection not found');

    await verifyTransferPermissions(connection.projectId, targetProjectId);

    await prisma.cMSConnection.update({
        where: { id: connectionId },
        data: { projectId: targetProjectId }
    });

    revalidatePath('/dashboard');
    return { success: true };
}

/**
 * Transfers a Project to another Organization
 */
export async function transferProjectToOrganization(projectId: string, targetOrgId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { projectAccess: true, memberships: true }
    });
    if (!user) throw new Error('User not found');

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const isAdmin = user.role === 'ADMIN';
    const hasProjectOwnerAccess = isAdmin || user.projectAccess.some(pa => pa.projectId === projectId && pa.role === 'OWNER');
    const hasTargetOrgAccess = isAdmin || user.memberships.some(m => m.organizationId === targetOrgId && ['OWNER', 'ADMIN'].includes(m.role));

    if (!hasProjectOwnerAccess || !hasTargetOrgAccess) {
        throw new Error('Insufficient permissions. You must be the project owner and an admin of the target organization.');
    }

    await prisma.project.update({
        where: { id: projectId },
        data: { organizationId: targetOrgId }
    });

    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath('/dashboard');
    return { success: true };
}
