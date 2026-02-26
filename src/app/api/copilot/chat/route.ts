import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateObject, generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildCopilotSystemPrompt } from '@/lib/copilot/system-prompt';
import { canAccessProjectData } from '@/lib/copilot/permissions';
import { searchPlatformKB } from '@/lib/copilot/platform-kb';
import { PLANS, PlanType, isUnlimited } from '@/config/plans';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { checkCreditsForAction } from '@/lib/guards/resourceGuard';
import { cookies } from 'next/headers';
import {
    createProjectTranscriptsTool,
    createChatbotConversationsTool,
    createProjectIntegrationsTool,
    createVisibilityInsightsTool,
    createExternalAnalyticsTool,
    createKnowledgeBaseTool,
    createScrapeWebSourceTool
} from '@/lib/copilot/chat-tools';

export const maxDuration = 60;

function isConnectionError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    return (
        message.includes('econnreset') ||
        message.includes('cannot connect to api') ||
        message.includes('fetch failed') ||
        message.includes('socket hang up') ||
        message.includes('timeout')
    );
}

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

        if (!userWithMembership || userWithMembership.memberships.length === 0) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const selectedOrgId = cookieStore.get('bt_selected_org_id')?.value;
        const activeMembership = userWithMembership.memberships.find(
            m => m.organizationId === selectedOrgId && m.status === 'ACTIVE'
        ) || userWithMembership.memberships.find(m => m.status === 'ACTIVE');

        if (!activeMembership) {
            return NextResponse.json({ error: 'No active organization found' }, { status: 400 });
        }

        const organization = activeMembership.organization;

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

        const creditsCheck = await checkCreditsForAction(
            'copilot_message',
            undefined,
            projectId,
            organization.id
        );
        if (!creditsCheck.allowed) {
            return NextResponse.json({
                code: (creditsCheck as any).code || 'ACCESS_DENIED',
                error: creditsCheck.error,
                creditsNeeded: creditsCheck.creditsNeeded,
                creditsAvailable: creditsCheck.creditsAvailable
            }, { status: creditsCheck.status || 403 });
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
            where: { id: 'default' },
            select: {
                anthropicApiKey: true,
                openaiApiKey: true
            }
        });

        const anthropicApiKey = globalConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';
        const openaiApiKey = globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY || '';

        if (!anthropicApiKey && !openaiApiKey) {
            return NextResponse.json({
                error: 'API key not configured',
                message: 'Nessuna chiave API LLM configurata (Anthropic/OpenAI). Contatta l\'amministratore.'
            }, { status: 500 });
        }

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

        const schema = z.object({
            response: z.string().describe('La risposta completa per l\'utente in markdown'),
            usedKnowledgeBase: z.boolean().describe('Se la risposta usa informazioni dalla knowledge base'),
            suggestedFollowUp: z.string().optional().describe('Domanda di follow-up suggerita (opzionale)')
        });

        const inputMessages = [
            ...history.slice(-10).map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            })),
            { role: 'user' as const, content: message }
        ];

        const runWithAnthropic = (apiKey: string, model: string) => {
            const anthropic = createAnthropic({ apiKey });
            return generateObject({
                model: anthropic(model),
                schema,
                system: systemPrompt,
                messages: inputMessages,
                temperature: 0.3
            });
        };

        const runWithOpenAI = (apiKey: string, model: string) => {
            const openai = createOpenAI({ apiKey });
            return generateObject({
                model: openai(model),
                schema,
                system: systemPrompt,
                messages: inputMessages,
                temperature: 0.3
            });
        };

        // 8. Generate response (Anthropic primary, OpenAI fallback on network failures)

        const toolContext = {
            userId: session.user.id,
            organizationId: organization.id,
            projectId: projectId || null
        };

        const tools = {
            getProjectTranscripts: {
                ...createProjectTranscriptsTool(toolContext),
            },
            getChatbotConversations: {
                ...createChatbotConversationsTool(toolContext),
            },
            getProjectIntegrations: {
                ...createProjectIntegrationsTool(toolContext),
            },
            getVisibilityInsights: {
                ...createVisibilityInsightsTool(toolContext),
            },
            getExternalAnalytics: {
                ...createExternalAnalyticsTool(toolContext),
            },
            getKnowledgeBase: {
                ...createKnowledgeBaseTool(toolContext),
            },
            scrapeWebSource: {
                ...createScrapeWebSourceTool(toolContext),
            }
        };

        const runLLM = async (provider: 'anthropic' | 'openai', model: string) => {
            const llm = provider === 'anthropic'
                ? createAnthropic({ apiKey: anthropicApiKey })(model)
                : createOpenAI({ apiKey: openaiApiKey })(model);

            const toolSet = hasProjectAccess ? (tools as any) : undefined;

            return generateText({
                model: llm as any,
                system: systemPrompt + "\n\nCRITICAL: Your final response MUST be a JSON object with this structure: { \"response\": \"your markdown response\", \"usedKnowledgeBase\": true/false, \"suggestedFollowUp\": \"optional question\" }. Do not include any other text in the final output step.",
                messages: inputMessages,
                tools: toolSet,
                ...(toolSet ? { maxSteps: 3 } : {}), // Reduced steps to prevent long execution
                temperature: 0.3,
                abortSignal: AbortSignal.timeout(45000) // 45s Timeout to leave buffer for Vercel 60s limit
            });
        };

        let modelUsed = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'; // configurable via env, fallback to broadly-available sonnet
        let result: any;

        try {
            if (anthropicApiKey) {
                result = await runLLM('anthropic', modelUsed);
            } else {
                modelUsed = 'gpt-4o';
                result = await runLLM('openai', modelUsed);
            }
        } catch (error) {
            if (isConnectionError(error) && openaiApiKey) {
                console.warn('[Copilot] Fallback to OpenAI due to connection error');
                modelUsed = 'gpt-4o';
                result = await runLLM('openai', modelUsed);
            } else {
                throw error;
            }
        }

        // Parse JSON from result.text
        let finalObject = { response: result.text, usedKnowledgeBase: false, suggestedFollowUp: '' };
        try {
            // Find JSON block if it exists
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                finalObject = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('[Copilot] Failed to parse JSON from LLM response:', e);
            finalObject = { response: result.text, usedKnowledgeBase: false, suggestedFollowUp: '' };
        }

        // 9. Track token usage with new credits system
        if (result.usage) {
            try {
                await TokenTrackingService.logTokenUsage({
                    userId: session.user.id,
                    organizationId: organization?.id,
                    projectId: projectId || undefined,
                    inputTokens: result.usage.inputTokens || 0,
                    outputTokens: result.usage.outputTokens || 0,
                    category: 'SUGGESTION',
                    model: modelUsed,
                    operation: 'copilot-chat',
                    resourceType: 'copilot',
                    resourceId: session.user.id,
                    actionOverride: 'copilot_message'
                });
            } catch (err) {
                console.error('[Copilot] Credit tracking failed:', err);
            }
        }

        const responseText = typeof finalObject?.response === 'string'
            ? finalObject.response
            : String(finalObject?.response ?? result.text ?? '');

        // 10. Log copilot session
        const estimatedTokens = Math.ceil((message.length + responseText.length) / 4);
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
            response: responseText || 'Non sono riuscito a generare una risposta valida. Riprova tra poco.',
            hasProjectAccess,
            usedKnowledgeBase: finalObject.usedKnowledgeBase,
            suggestedFollowUp: finalObject.suggestedFollowUp,
            toolsUsed: result.steps?.flatMap((s: any) => s.toolCalls?.map((tc: any) => tc.toolName)) || []
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
// Helper to build project context (Optimized)
async function buildProjectContext(project: any) {
    // Top themes query - optimized to only fetch themes and analysis
    const bots = await prisma.bot.findMany({
        where: { projectId: project.id },
        select: {
            id: true,
            conversations: {
                where: {
                    startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                },
                select: {
                    analysis: {
                        select: { sentimentScore: true }
                    },
                    themeOccurrences: {
                        select: {
                            theme: { select: { name: true } }
                        }
                    }
                },
                take: 50 // Reduced from 100 to prevent OOM
            }
        }
    });

    const allConversations = bots.flatMap((b: any) => b.conversations);

    const themes = new Map<string, { count: number; sentimentSum: number }>();
    let totalSentiment = 0;
    let sentimentCount = 0;

    allConversations.forEach((c: any) => {
        // Calculate sentiment
        if (c.analysis?.sentimentScore != null) {
            totalSentiment += c.analysis.sentimentScore;
            sentimentCount++;
        }

        // Aggregate themes
        c.themeOccurrences?.forEach((to: any) => {
            if (to.theme?.name) {
                const existing = themes.get(to.theme.name) || { count: 0, sentimentSum: 0 };
                themes.set(to.theme.name, {
                    count: existing.count + 1,
                    sentimentSum: existing.sentimentSum + (c.analysis?.sentimentScore || 0)
                });
            }
        });
    });

    const topThemes = Array.from(themes.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5) // Top 5 is enough for context
        .map(([name, data]) => ({
            name,
            count: data.count,
            sentiment: data.count > 0 ? Math.round((data.sentimentSum / data.count) * 100) / 100 : 0
        }));

    const avgSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;

    return {
        projectId: project.id,
        projectName: project.name,
        botsCount: project.bots.length, // From previous query or passed prop
        conversationsCount: allConversations.length,
        topThemes,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        period: 'ultimi 30 giorni',
        strategicVision: project.strategicVision,
        valueProposition: project.valueProposition
    };
}
