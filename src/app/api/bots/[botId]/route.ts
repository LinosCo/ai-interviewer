
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    introMessage: z.string().optional(),
    tone: z.string().optional(),
    leadCaptureStrategy: z.string().optional(),
    fallbackMessage: z.string().optional(),
    boundaries: z.array(z.string()).optional(),
    candidateDataFields: z.array(z.any()).optional(), // Allow full JSON array
    collectCandidateData: z.boolean().optional(), // Explicit override if needed
    primaryColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    logoUrl: z.string().optional(),
    privacyPolicyUrl: z.string().optional(),
    botType: z.string().optional(), // Added to accept botType from client

    // Landing Page Fields
    landingTitle: z.string().optional(),
    landingDescription: z.string().optional(),
    landingImageUrl: z.string().optional(),
    landingVideoUrl: z.string().optional(),
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

        // Remove botType from data before updating (it's not a DB field)
        // Also filter out undefined/null values that could cause issues
        const { botType, backgroundColor, collectCandidateData, ...restData } = data;

        const updateData: Record<string, any> = { ...restData };

        // Only include backgroundColor if it's a non-empty string
        if (backgroundColor && typeof backgroundColor === 'string') {
            updateData.backgroundColor = backgroundColor;
        }

        // Auto-set collectCandidateData based on candidateDataFields presence
        // If candidateDataFields is provided in the request, infer collectCandidateData from it
        if (data.candidateDataFields !== undefined) {
            const hasLeadFields = Array.isArray(data.candidateDataFields) && data.candidateDataFields.length > 0;
            updateData.collectCandidateData = hasLeadFields;
        } else if (collectCandidateData !== undefined) {
            // If explicitly provided without candidateDataFields, use the explicit value
            updateData.collectCandidateData = collectCandidateData;
        }

        const updatedBot = await prisma.bot.update({
            where: { id: botId },
            data: updateData
        });

        return NextResponse.json(updatedBot);

    } catch (error) {
        console.error('[BOT_UPDATE_ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
