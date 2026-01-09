
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
    landingTitle: z.string().optional(),
    landingDescription: z.string().optional(),
    landingImageUrl: z.string().optional(),
    landingVideoUrl: z.string().optional(),
    // Allow other fields in future
});

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { botId } = await params;
        const body = await req.json();

        // Validation
        const data = updateSchema.parse(body);

        // Verify ownership/access
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: { project: { include: { organization: true } } }
        });

        if (!bot) {
            return new NextResponse('Bot not found', { status: 404 });
        }

        // Check if user has access to this project
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                ownedProjects: true,
                projectAccess: true
            }
        });

        const isOwner = user?.ownedProjects.some(p => p.id === bot.projectId);
        const hasAccess = user?.projectAccess.some(pa => pa.projectId === bot.projectId);

        if (!isOwner && !hasAccess) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Check Plan limits if trying to update customization
        if (data.landingImageUrl || data.landingVideoUrl) {
            const plan = bot.project.organization?.plan || 'TRIAL';
            const isPro = ['PRO', 'BUSINESS', 'TRIAL'].includes(plan);
            if (!isPro) {
                return new NextResponse('Upgrade required for customization', { status: 403 });
            }
        }

        const updatedBot = await prisma.bot.update({
            where: { id: botId },
            data: {
                ...data,
                // Only update fields that are present
                landingTitle: data.landingTitle,
                landingDescription: data.landingDescription,
                landingImageUrl: data.landingImageUrl,
                landingVideoUrl: data.landingVideoUrl
            }
        });

        return NextResponse.json(updatedBot);

    } catch (error) {
        console.error('[BOT_UPDATE_ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
