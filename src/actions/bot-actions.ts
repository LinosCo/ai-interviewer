'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { regenerateInterviewPlan } from '@/lib/interview/plan-service';
import crypto from 'crypto';

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

export async function toggleBotStatusAction(botId: string) {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            select: { id: true, status: true, projectId: true }
        });

        if (!bot) return { success: false, error: "Bot not found" };

        const newStatus = bot.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';

        await prisma.bot.update({
            where: { id: botId },
            data: { status: newStatus }
        });

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/bots');
        revalidatePath('/dashboard/interviews');
        revalidatePath(`/dashboard/bots/${botId}`);

        return { success: true, status: newStatus };
    } catch (error) {
        console.error("Error toggling bot status:", error);
        return { success: false, error: "Failed to toggle status" };
    }
}

function buildBotSlug(name: string) {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `${base}-${crypto.randomUUID().split('-')[0]}`;
}

export async function duplicateBotAction(
    botId: string,
    overrides: { name: string; language?: string }
) {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Unauthorized" };
    }

    try {
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
                },
                topics: { orderBy: { orderIndex: 'asc' } },
                knowledgeSources: true,
                rewardConfig: true
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
            return { success: false, error: "You do not have permission to duplicate this bot." };
        }

        const duplicateName = overrides.name?.trim();
        if (!duplicateName) {
            return { success: false, error: "Name required" };
        }

        const slug = buildBotSlug(duplicateName);
        const newLanguage = overrides.language || bot.language || 'en';

        const created = await prisma.bot.create({
            data: {
                projectId: bot.projectId,
                name: duplicateName,
                slug,
                status: 'DRAFT',
                description: bot.description,
                researchGoal: bot.researchGoal,
                targetAudience: bot.targetAudience,
                language: newLanguage,
                tone: bot.tone,
                introMessage: bot.introMessage,
                maxDurationMins: bot.maxDurationMins,
                maxTurns: bot.maxTurns,
                maxOpenQuestions: bot.maxOpenQuestions,
                modelProvider: bot.modelProvider,
                modelName: bot.modelName,
                openaiApiKey: bot.openaiApiKey,
                anthropicApiKey: bot.anthropicApiKey,
                logoUrl: bot.logoUrl,
                primaryColor: bot.primaryColor,
                backgroundColor: bot.backgroundColor,
                textColor: bot.textColor,
                anonymizationLevel: bot.anonymizationLevel,
                privacyNotice: bot.privacyNotice,
                dataUsageInfo: bot.dataUsageInfo,
                consentText: bot.consentText,
                showAnonymityInfo: bot.showAnonymityInfo,
                showDataUsageInfo: bot.showDataUsageInfo,
                analyticsMetadata: (bot.analyticsMetadata ?? undefined) as any,
                formatExplanation: bot.formatExplanation,
                progressBarStyle: bot.progressBarStyle,
                showProgressBar: bot.showProgressBar,
                showTopicPreview: bot.showTopicPreview,
                welcomeSubtitle: bot.welcomeSubtitle,
                welcomeTitle: bot.welcomeTitle,
                warmupChoices: (bot.warmupChoices ?? undefined) as any,
                warmupContextPrompt: bot.warmupContextPrompt,
                warmupFollowup: bot.warmupFollowup,
                warmupIcebreaker: bot.warmupIcebreaker,
                warmupStyle: bot.warmupStyle,
                useWarmup: bot.useWarmup,
                landingDescription: bot.landingDescription,
                landingImageUrl: bot.landingImageUrl,
                landingTitle: bot.landingTitle,
                landingVideoUrl: bot.landingVideoUrl,
                candidateDataFields: (bot.candidateDataFields ?? undefined) as any,
                collectCandidateData: bot.collectCandidateData,
                allowedDomains: (bot.allowedDomains ?? undefined) as any,
                botType: bot.botType,
                bubbleAnimation: bot.bubbleAnimation,
                bubbleIcon: bot.bubbleIcon,
                bubblePosition: bot.bubblePosition,
                bubbleSize: bot.bubbleSize,
                enablePageContext: bot.enablePageContext,
                fallbackMessage: bot.fallbackMessage,
                leadCaptureMessage: bot.leadCaptureMessage,
                leadCaptureStrategy: bot.leadCaptureStrategy,
                maxMessagesPerSession: bot.maxMessagesPerSession,
                maxTokensPerMessage: bot.maxTokensPerMessage,
                webhookUrl: bot.webhookUrl,
                privacyPolicyUrl: bot.privacyPolicyUrl,
                boundaries: (bot.boundaries ?? undefined) as any,
                topics: {
                    create: bot.topics.map(t => ({
                        orderIndex: t.orderIndex,
                        label: t.label,
                        description: t.description,
                        subGoals: t.subGoals || [],
                        maxTurns: t.maxTurns,
                        keywords: t.keywords
                    }))
                },
                knowledgeSources: {
                    create: bot.knowledgeSources.map(s => ({
                        type: s.type,
                        title: s.title,
                        content: s.content
                    }))
                },
                ...(bot.rewardConfig ? {
                    rewardConfig: {
                        create: {
                            enabled: bot.rewardConfig.enabled,
                            type: bot.rewardConfig.type,
                            payload: bot.rewardConfig.payload,
                            displayText: bot.rewardConfig.displayText,
                            showOnLanding: bot.rewardConfig.showOnLanding
                        }
                    }
                } : {})
            }
        });

        await regenerateInterviewPlan(created.id);

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/bots');
        revalidatePath('/dashboard/interviews');
        revalidatePath(`/dashboard/projects/${bot.projectId}`);

        return { success: true, botId: created.id };
    } catch (error) {
        console.error("Error duplicating bot:", error);
        return { success: false, error: "Failed to duplicate bot" };
    }
}
