'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function deleteBotAction(botId: string) {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // Verify ownership
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: {
                project: {
                    include: {
                        organization: {
                            include: {
                                members: {
                                    include: { user: true }
                                }
                            }
                        },
                        owner: true
                    }
                }
            }
        });

        if (!bot) {
            return { success: false, error: "Bot not found" };
        }

        // Check if user is owner of project or admin/member of org
        const userEmail = session.user.email;
        const isProjectOwner = bot.project.owner?.email === userEmail;
        const isOrgMember = bot.project.organization?.members.some(m => m.user.email === userEmail && (m.role === 'ADMIN' || m.role === 'OWNER'));

        if (!isProjectOwner && !isOrgMember) {
            return { success: false, error: "You do not have permission to delete this bot." };
        }

        // Delete the bot
        await prisma.bot.delete({
            where: { id: botId }
        });

        // Revalidate relevant paths
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/interviews');
        revalidatePath(`/dashboard/projects/${bot.projectId}`);

        return { success: true };
    } catch (error) {
        console.error("Error deleting bot:", error);
        return { success: false, error: "Failed to delete bot" };
    }
}
