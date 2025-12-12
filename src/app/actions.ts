'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const BotSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    researchGoal: z.string().optional(),
    targetAudience: z.string().optional(),
    language: z.string().default("en"),
    tone: z.string().optional(),
    maxDurationMins: z.coerce.number().default(10),
    introMessage: z.string().optional(),
})

export async function startInterviewAction(botId: string) {
    // Generate anonymous participant ID or use session if present (but session is admin usually)
    const participantId = `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const conversation = await prisma.conversation.create({
        data: {
            botId,
            participantId,
            status: 'STARTED',
            startedAt: new Date(),
        }
    });

    redirect(`/i/chat/${conversation.id}`);
}

export async function createBotAction(projectId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (!name) throw new Error("Name required");

    const bot = await prisma.bot.create({
        data: {
            projectId,
            name,
            description,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000),
            topics: {
                create: [
                    { orderIndex: 0, label: "Introduction", description: "Welcome the user and explain the context." },
                    { orderIndex: 1, label: "Main Questions", description: "Core research questions." }
                ]
            }
        }
    });

    revalidatePath('/dashboard');
    redirect(`/dashboard/bots/${bot.id}`);
}

export async function createProjectAction(formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    const name = formData.get('name') as string;
    if (!name) throw new Error("Name required");

    await prisma.project.create({
        data: {
            name,
            ownerId: user.id
        }
    });

    revalidatePath('/dashboard');
    redirect('/dashboard');
}

export async function updateBotAction(botId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    const data = {
        name: formData.get('name') as string,
        researchGoal: formData.get('researchGoal') as string,
        targetAudience: formData.get('targetAudience') as string,
        language: formData.get('language') as string,
        tone: formData.get('tone') as string,
        maxDurationMins: Number(formData.get('maxDurationMins')),
        modelProvider: formData.get('modelProvider') as string,
        modelName: formData.get('modelName') as string,
        openaiApiKey: formData.get('openaiApiKey') ? (formData.get('openaiApiKey') as string) : undefined,
        anthropicApiKey: formData.get('anthropicApiKey') ? (formData.get('anthropicApiKey') as string) : undefined,
    };

    // Filter out undefined keys so we don't overwrite with null if they were just left empty
    // But here optional fields should be update-able to empty. 
    // If user leaves empty, should we delete? 
    // UI logic: defaultValue uses existing. If user clears it, it sends empty string.
    // If empty string, we should save null or empty string?
    // Let's rely on standard Prisma behavior, but if user inputs nothing (and it was previously set), 
    // we want to keep it? No, if user clears input, they want to clear key.
    // The Input has defaultValue={bot.key}. So if unchanged, it sends key.
    // If changed to empty, it sends empty string.
    // We should probably convert empty string to null.

    if (data.openaiApiKey === '') data.openaiApiKey = null as any;
    if (data.anthropicApiKey === '') data.anthropicApiKey = null as any;

    await prisma.bot.update({
        where: { id: botId },
        data
    });

    revalidatePath(`/dashboard/bots/${botId}`);
    return { success: true };
}

export async function addTopicAction(botId: string, orderIndex: number) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    await prisma.topicBlock.create({
        data: {
            botId,
            orderIndex,
            label: "New Topic",
            description: "Describe what to ask here.",
            subGoals: [],
        }
    });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function updateTopicAction(topicId: string, botId: string, data: any) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");

    let subGoals = data.subGoals;
    if (typeof subGoals === 'string') {
        subGoals = subGoals.split('\n').filter((s: string) => s.trim().length > 0);
    }

    await prisma.topicBlock.update({
        where: { id: topicId },
        data: {
            label: data.label,
            description: data.description,
            subGoals: subGoals,
            maxTurns: Number(data.maxTurns || 5)
        }
    });
    revalidatePath(`/dashboard/bots/${botId}`);
}

export async function deleteTopicAction(topicId: string, botId: string) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Unauthorized");
    await prisma.topicBlock.delete({ where: { id: topicId } });
    revalidatePath(`/dashboard/bots/${botId}`);
}
