'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

/**
 * Links a Visibility Config to a Project
 */
export async function linkVisibilityConfig(configId: string, projectId: string) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    // In a real app we'd check if user has access to both project and config
    // For now assuming admin/owner access is checked by caller or this is an admin action

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
    if (!session?.user) throw new Error('Unauthorized');

    await prisma.visibilityConfig.update({
        where: { id: configId },
        data: { projectId: null }
    });

    revalidatePath(`/dashboard/admin/projects/${projectId}`);
    return { success: true };
}

/**
 * Transfers a Bot to a Project
 */
export async function transferBotToProject(botId: string, targetProjectId: string, currentProjectId?: string) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');

    await prisma.bot.update({
        where: { id: botId },
        data: { projectId: targetProjectId }
    });

    revalidatePath(`/dashboard/admin/projects/${targetProjectId}`);
    if (currentProjectId) {
        revalidatePath(`/dashboard/admin/projects/${currentProjectId}`);
    }
    return { success: true };
}
