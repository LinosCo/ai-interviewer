import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildCopilotSystemPrompt } from '@/lib/copilot/system-prompt';
import { canAccessProjectData } from '@/lib/copilot/permissions';
import { searchPlatformKB } from '@/lib/copilot/platform-kb';
import { PLANS, PlanType, isUnlimited } from '@/config/plans';
import { TokenTrackingService } from '@/services/tokenTrackingService';

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, history = [], projectId } = await req.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // 1. Get user with organization info
        const userWithMembership = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                role: true,
                memberships: {
                    take: 1,
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                plan: true,
                                monthlyCreditsLimit: true,
                                monthlyCreditsUsed: true,
                                packCreditsAvailable: true
                            }
                        }
                    }
                }
            }
        });

        if (!userWithMembership || !userWithMembership.memberships[0]) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
        }

        const organization = userWithMembership.memberships[0].organization;

        // Use organization's plan (admin has unlimited access)
        const isAdmin = userWithMembership.role === 'ADMIN' || organization.plan === 'ADMIN';
        const tier = (organization.plan as PlanType) || 'TRIAL';

        // 2. Check credits limits (skip for admin)
        if (!isAdmin) {
            const creditsLimit = Number(organization.monthlyCreditsLimit);
            const creditsUsed = Number(organization.monthlyCreditsUsed);
            const packCredits = Number(organization.packCreditsAvailable);

            const totalAvailable = (creditsLimit === -1) ? Infinity : (creditsLimit - creditsUsed + packCredits);

            if (creditsLimit !== -1 && totalAvailable <= 0) {
                return NextResponse.json({
                    error: 'Credit limit reached',
                    message: 'La tua organizzazione ha raggiunto il limite di crediti per questo mese. Effettua l\'upgrade per continuare.'
                }, { status: 429 });
            }
        }

        // 3. Get organization's strategic plan from platform settings
        const platformSettings = await prisma.platformSettings.findUnique({
            where: { organizationId: organization.id }
        });
        const strategicPlan = platformSettings?.strategicPlan || null;

        // 4. Determine if user can access project data
        const hasProjectAccess = canAccessProjectData(tier);

        let projectContext = null;
        if (hasProjectAccess && projectId) {
            // Verify project access
            const project = await prisma.project.findFirst({
                where: {
                    id: projectId,
                    organizationId: organization.id
                },
                include: {
                    bots: {
                        include: {
                            conversations: {
                                where: {
                                    startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                                },
                                include: {
                                    analysis: true,
                                    themeOccurrences: { include: { theme: true } }
                                },
                                take: 100
                            }
                        }
                    }
                }
            });

            if (project) {
                projectContext = await buildProjectContext(project);
            }
        }

        // 5. Search platform KB for relevant content
        const kbResults = await searchPlatformKB(message, 'all');
        const kbContext = kbResults.slice(0, 2).map(r => `[${r.title}]: ${r.content}`).join('\n\n');

        // 6. Get API key (Anthropic for Claude 4.5 Opus)
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' }
        });

        const apiKey = globalConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';

        if (!apiKey) {
            return NextResponse.json({
                error: 'API key not configured',
                message: 'Chiave API Anthropic non configurata. Contatta l\'amministratore.'
            }, { status: 500 });
        }

        const anthropic = createAnthropic({ apiKey });

        // 7. Build enhanced system prompt with KB context and strategic plan
        let systemPrompt = buildCopilotSystemPrompt({
            userName: session.user.name || 'utente',
            organizationName: organization.name,
            tier,
            hasProjectAccess,
            projectContext,
            strategicPlan
        });

        if (kbContext) {
            systemPrompt += `\n\n## Informazioni dalla Knowledge Base\n${kbContext}`;
        }

        // 8. Generate response with Claude 4.5 Opus
        const result = await generateObject({
            model: anthropic('claude-opus-4-5-20251101'),
            schema: z.object({
                response: z.string().describe('La risposta completa per l\'utente in markdown'),
                usedKnowledgeBase: z.boolean().describe('Se la risposta usa informazioni dalla knowledge base'),
                suggestedFollowUp: z.string().optional().describe('Domanda di follow-up suggerita (opzionale)')
            }),
            system: systemPrompt,
            messages: [
                ...history.slice(-10).map((m: any) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content
                })),
                { role: 'user' as const, content: message }
            ],
            temperature: 0.3
        });

        // 9. Track token usage with new credits system
        if (result.usage) {
            TokenTrackingService.logTokenUsage({
                userId: session.user.id,
                organizationId: organization?.id,
                projectId: projectId || undefined,
                inputTokens: result.usage.inputTokens || 0,
                outputTokens: result.usage.outputTokens || 0,
                category: 'SUGGESTION', // COPILOT uses SUGGESTION category
                model: 'claude-opus-4-5-20251101',
                operation: 'copilot-chat',
                resourceType: 'copilot',
                resourceId: session.user.id
            }).catch(err => console.error('[Copilot] Credit tracking failed:', err));
        }

        // 10. Log copilot session
        const estimatedTokens = Math.ceil((message.length + result.object.response.length) / 4);
        const sessionDate = new Date().toISOString().split('T')[0];
        const sessionKey = `${session.user.id}-${sessionDate}`;

        try {
            await prisma.copilotSession.upsert({
                where: { id: sessionKey },
                update: {
                    messagesCount: { increment: 1 },
                    tokensUsed: { increment: estimatedTokens }
                },
                create: {
                    id: sessionKey,
                    userId: session.user.id,
                    organizationId: organization.id,
                    projectId: projectId || null,
                    messagesCount: 1,
                    tokensUsed: estimatedTokens
                }
            });
        } catch (e) {
            // Ignore session logging errors
            console.error('[Copilot] Session logging error:', e);
        }

        return NextResponse.json({
            response: result.object.response,
            hasProjectAccess,
            suggestedFollowUp: result.object.suggestedFollowUp
        });

    } catch (error: any) {
        console.error('[Copilot] Error:', error);
        return NextResponse.json(
            { error: 'Internal error', message: error.message },
            { status: 500 }
        );
    }
}

// Helper to build project context
async function buildProjectContext(project: any) {
    const allConversations = project.bots.flatMap((b: any) => b.conversations);

    const themes = new Map<string, { count: number; sentimentSum: number }>();
    allConversations.forEach((c: any) => {
        c.themeOccurrences?.forEach((to: any) => {
            const existing = themes.get(to.theme.name) || { count: 0, sentimentSum: 0 };
            themes.set(to.theme.name, {
                count: existing.count + 1,
                sentimentSum: existing.sentimentSum + (c.analysis?.sentimentScore || 0)
            });
        });
    });

    const topThemes = Array.from(themes.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, data]) => ({
            name,
            count: data.count,
            sentiment: data.count > 0 ? data.sentimentSum / data.count : 0
        }));

    const conversationsWithAnalysis = allConversations.filter((c: any) => c.analysis?.sentimentScore != null);
    const avgSentiment = conversationsWithAnalysis.length > 0
        ? conversationsWithAnalysis.reduce((acc: number, c: any) =>
            acc + c.analysis.sentimentScore, 0) / conversationsWithAnalysis.length
        : 0;

    return {
        projectId: project.id,
        projectName: project.name,
        botsCount: project.bots.length,
        conversationsCount: allConversations.length,
        topThemes,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        period: 'ultimi 30 giorni'
    };
}
