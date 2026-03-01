
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { WorkspaceError, assertProjectAccess } from '@/lib/domain/workspace';

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { botId } = await params;

        // Fetch bot to verify it exists and get its project
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            select: { id: true, projectId: true, name: true }
        });

        if (!bot) {
            return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
        }

        // Require ADMIN role on the project's organization to delete
        try {
            await assertProjectAccess(session.user.id, bot.projectId, 'ADMIN');
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return NextResponse.json({ error: error.message }, { status: error.status });
            }
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete the bot inside a transaction.
        // All child tables (Conversation, Message, KnowledgeSource, InterviewPlan,
        // TopicBlock, RewardConfig, QuestionDefinition, Theme, ThemeOccurrence,
        // Insight, HotIdea, Report, ChatbotSession, ChatbotAnalytics,
        // KnowledgeGap, FaqSuggestion) carry onDelete: Cascade in the schema,
        // so a single bot.delete() will cascade everything automatically.
        // The transaction provides atomicity and an explicit audit trail.
        await prisma.$transaction(async (tx) => {
            // Explicitly delete child rows that may not cascade through
            // intermediate relations (belt-and-suspenders safety).
            // StructuredAnswer cascades via Conversation -> StructuredAnswer (Cascade).
            // ConversationAnalysis, ConversationMemory, RewardGrant, Message,
            // ThemeOccurrence all cascade via Conversation (Cascade).
            // ChatbotSession cascades via Bot (Cascade).
            // All others cascade via Bot (Cascade) directly.

            // Delete bot — all FK children cascade.
            await tx.bot.delete({ where: { id: botId } });
        });

        console.log(`[BOT_DELETE] Bot ${botId} ("${bot.name}") deleted by user ${session.user.id}`);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[BOT_DELETE_ERROR]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

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
        if (!session?.user?.id) {
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

        try {
            await assertProjectAccess(session.user.id, bot.projectId, 'MEMBER');
        } catch (error) {
            if (error instanceof WorkspaceError) {
                return new NextResponse(error.message, { status: error.status });
            }
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
