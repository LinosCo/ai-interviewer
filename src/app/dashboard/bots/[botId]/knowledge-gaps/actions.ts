'use server'

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function approveGap(botId: string, gapId: string, question: string, answer: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Verify ownership
    const bot = await prisma.bot.findUnique({
        where: { id: botId, project: { organization: { members: { some: { userId: session.user.id } } } } }
    });
    if (!bot) throw new Error("Unauthorized");

    // Convert to Knowledge Source (FAQ)
    await prisma.knowledgeSource.create({
        data: {
            botId,
            type: 'text',
            title: `FAQ: ${question.slice(0, 50)}...`,
            content: `Q: ${question}\nA: ${answer}`
        }
    });

    // Update Gap Status
    await (prisma as any).knowledgeGap.update({
        where: { id: gapId },
        data: { status: 'approved' }
    });

    revalidatePath(`/dashboard/bots/${botId}/knowledge-gaps`);
}

export async function dismissGap(botId: string, gapId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const bot = await prisma.bot.findUnique({
        where: { id: botId, project: { organization: { members: { some: { userId: session.user.id } } } } }
    });
    if (!bot) throw new Error("Unauthorized");

    await (prisma as any).knowledgeGap.update({
        where: { id: gapId },
        data: { status: 'dismissed' }
    });

    revalidatePath(`/dashboard/bots/${botId}/knowledge-gaps`);
}
