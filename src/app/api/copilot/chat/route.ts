import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { NextResponse } from 'next/server';
import { buildCopilotSystemPrompt } from '@/lib/copilot/system-prompt';
import { canAccessProjectData } from '@/lib/copilot/permissions';
import { WorkspaceError } from '@/lib/domain/workspace';
import { ProjectIntelligenceContextService } from '@/lib/projects/project-intelligence-context.service';
import { searchPlatformKB } from '@/lib/copilot/platform-kb';
import { PlanType } from '@/config/plans';
import { getConfigValue } from '@/lib/config';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { checkCreditsForAction } from '@/lib/guards/resourceGuard';
import { cookies } from 'next/headers';
import { getDefaultStrategicMarketingKnowledge, getStrategicMarketingKnowledgeByOrg } from '@/lib/marketing/strategic-kb';
import { buildRelatedCopilotPromptSuggestions } from '@/lib/projects/project-tip-related-suggestions';
import {
    createPlatformHelpSearchTool,
    createProjectTranscriptsTool,
    createChatbotConversationsTool,
    createProjectIntegrationsTool,
    createVisibilityInsightsTool,
    createProjectAiTipsTool,
    createExternalAnalyticsTool,
    createStrategicKnowledgeTool,
    createKnowledgeBaseTool,
    createScrapeWebSourceTool,
    createStrategicTipCreationTool,
    createTipRoutingManagerTool,
    createManageCanonicalTipsTool,
    createProjectConnectionsOpsTool,
    createCompetitorAnalysisTool,
    createSeoGeoAeoTool
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

function isAnthropicModelNotFound(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    return (
        message.includes('not_found_error') ||
        (message.includes('model:') && message.includes('not found')) ||
        (message.includes('model') && message.includes('does not exist'))
    );
}

function isAnthropicBillingError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    return (
        message.includes('credit balance is too low') ||
        message.includes('plans & billing') ||
        message.includes('purchase credits') ||
        message.includes('insufficient') && message.includes('credit')
    );
}

function shouldFallbackFromAnthropic(error: unknown): boolean {
    return (
        isConnectionError(error) ||
        isAnthropicModelNotFound(error) ||
        isAnthropicBillingError(error)
    );
}

function isOpenAIModelNotFound(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    return (
        message.includes('model_not_found') ||
        message.includes('does not exist') ||
        message.includes('unknown model') ||
        message.includes('not found')
    );
}

function isGeminiModelNotFound(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    return (
        message.includes('not_found') ||
        message.includes('model not found') ||
        message.includes('unknown model') ||
        message.includes('models/')
    );
}

function isLowSignalUserMessage(text: string): boolean {
    const normalized = String(text || '').toLowerCase().trim();
    if (!normalized) return true;

    const compact = normalized.replace(/[!?.,;:]/g, '').trim();
    const lowSignalSet = new Set([
        'ok', 'va bene', 'perfetto', 'grazie', 'si', 'sì', 'si grazie', 'sì grazie',
        'ottimo', 'chiaro', 'capito', 'yes', 'ok grazie'
    ]);
    if (lowSignalSet.has(compact)) return true;

    const words = compact.split(/\s+/).filter(Boolean);
    return words.length <= 2 && compact.length <= 14;
}

function isAssistantErrorLike(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return (
        normalized.includes('risposta non disponibile') ||
        normalized.includes('si e verificato un errore') ||
        normalized.includes('c\'e stato un problema') ||
        normalized.includes('riprova')
    );
}

function buildPromptContextFromConversation(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
): string | null {
    const userMessages = messages
        .filter((item) => item.role === 'user')
        .map((item) => String(item.content || '').trim())
        .filter((content) => content.length > 0 && !isLowSignalUserMessage(content));

    if (userMessages.length === 0) return null;

    const recent = userMessages.slice(-4);
    const deduped: string[] = [];
    for (const content of recent) {
        if (!deduped.includes(content)) deduped.push(content);
    }

    // Build a compact context window so suggestions are grounded in topic + objective.
    return deduped.join(' | ');
}

function buildCopilotPromptVariants(prompt: string, suggestedFollowUp: string, assistantText: string): string[] {
    if (isLowSignalUserMessage(prompt) || isAssistantErrorLike(assistantText)) {
        return suggestedFollowUp ? [suggestedFollowUp] : [];
    }

    const normalized = prompt.toLowerCase();

    if (
        normalized.includes('connession') ||
        normalized.includes('routing') ||
        normalized.includes('n8n') ||
        normalized.includes('wordpress') ||
        normalized.includes('woocommerce') ||
        normalized.includes('cms')
    ) {
        return [
            suggestedFollowUp,
            'Verifica quali connections sono gia attive e quali mancano per questo progetto.',
            'Suggerisci la prima regola di routing coerente con i tip piu pronti.',
        ].filter(Boolean).slice(0, 3);
    }

    if (
        normalized.includes('tema') ||
        normalized.includes('segnal') ||
        normalized.includes('insight') ||
        normalized.includes('tip')
    ) {
        return [
            suggestedFollowUp,
            'Quale tip canonico dovrei rivedere per primo e perché?',
            'Suggerisci 2 azioni collegate da eseguire intorno al tip principale.',
        ].filter(Boolean).slice(0, 3);
    }

    if (
        normalized.includes('analytics') ||
        normalized.includes('risultat') ||
        normalized.includes('metric') ||
        normalized.includes('trend')
    ) {
        return [
            suggestedFollowUp,
            'Quale metrica merita attenzione immediata e quale azione suggerisce?',
            'Confronta i segnali piu forti e dimmi dove intervenire prima.',
        ].filter(Boolean).slice(0, 3);
    }

    const related = buildRelatedCopilotPromptSuggestions(prompt);
    return [...new Set([suggestedFollowUp, ...related].filter(Boolean))].slice(0, 3);
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, conversationId: incomingConversationId, projectId } = await req.json();

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

        // 3. Get organization's strategic context from platform settings
        const platformSettings = await prisma.platformSettings.findUnique({
            where: { organizationId: organization.id }
        });
        const marketingKnowledge = await getStrategicMarketingKnowledgeByOrg(organization.id);
        const strategicMarketingKnowledge = marketingKnowledge.knowledge || getDefaultStrategicMarketingKnowledge() || null;
        const strategicPlan = platformSettings?.strategicPlan || null;

        // 4. Determine if user can access project data
        const hasProjectAccess = canAccessProjectData(tier);

        let projectContext = null;
        if (hasProjectAccess && projectId) {
            try {
                const ctx = await ProjectIntelligenceContextService.getContext({
                    projectId,
                    viewerUserId: session.user.id,
                    limitPerSource: 10,
                });
                projectContext = {
                    projectId: ctx.projectId,
                    projectName: ctx.projectName,
                    strategy: ctx.strategy ? {
                        positioning: ctx.strategy.positioning,
                        valueProposition: ctx.strategy.valueProposition,
                        targetAudiences: ctx.strategy.targetAudiences,
                        strategicGoals: ctx.strategy.strategicGoals,
                        toneGuidelines: ctx.strategy.toneGuidelines,
                    } : null,
                    methodologies: ctx.methodologies.map(m => ({ name: m.name, category: m.category, role: m.role, knowledge: m.knowledge ?? null })),
                    tips: ctx.tips.slice(0, 10).map(t => ({
                        title: t.title,
                        summary: t.summary,
                        status: t.status,
                        priority: t.priority,
                        category: t.category,
                    })),
                    routingCapabilities: ctx.routingCapabilities.filter(r => r.enabled),
                };
            } catch (err) {
                if (err instanceof WorkspaceError) {
                    return NextResponse.json(
                        { error: err.message, code: err.code },
                        { status: err.status }
                    );
                }
                throw err;
            }
        }

        // 5. Search platform KB for relevant content
        const kbResults = await searchPlatformKB(message, 'all');
        const kbContext = kbResults.slice(0, 2).map(r => `[${r.title}]: ${r.content}`).join('\n\n');

        // 6. Get API keys
        const anthropicApiKey = await getConfigValue('anthropicApiKey') || '';
        const openaiApiKey = await getConfigValue('openaiApiKey') || '';
        const geminiApiKey = await getConfigValue('geminiApiKey') || '';

        if (!anthropicApiKey && !openaiApiKey && !geminiApiKey) {
            return NextResponse.json({
                error: 'API key not configured',
                message: 'Nessuna chiave API LLM configurata (Anthropic/OpenAI/Gemini). Contatta l\'amministratore.'
            }, { status: 500 });
        }

        // 7. Build enhanced system prompt with KB context and strategic plan
        let systemPrompt = buildCopilotSystemPrompt({
            userName: session.user.name || 'utente',
            organizationName: organization.name,
            tier,
            hasProjectAccess,
            projectContext,
            strategicMarketingKnowledge,
            strategicPlan
        });

        if (kbContext) {
            systemPrompt += `\n\n## Informazioni dalla Knowledge Base\n${kbContext}`;
        }

        // Load or create persistent conversation
        let conversation: { id: string; messages: { role: string; content: string; toolsUsed: string[] }[] } | null = null;
        if (incomingConversationId) {
            conversation = await prisma.copilotConversation.findFirst({
                where: { id: incomingConversationId, userId: session.user.id },
                include: {
                    messages: { orderBy: { createdAt: 'asc' }, take: 20 }
                }
            });
        }
        if (!conversation) {
            conversation = await prisma.copilotConversation.create({
                data: {
                    userId: session.user.id,
                    organizationId: organization.id,
                    projectId: projectId || null
                },
                include: { messages: true }
            });
        }
        const conversationId = conversation.id;

        const inputMessages = [
            ...conversation.messages.map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            })),
            { role: 'user' as const, content: message }
        ];

        // 8. Generate response (Anthropic primary, OpenAI fallback on recoverable provider failures)

        const toolContext = {
            userId: session.user.id,
            organizationId: organization.id,
            projectId: projectId || null
        };

        const supportTools = {
            searchPlatformHelp: {
                ...createPlatformHelpSearchTool(),
            },
            getStrategicKnowledge: {
                ...createStrategicKnowledgeTool(toolContext),
            }
        };

        const projectTools = {
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
            getProjectAiTips: {
                ...createProjectAiTipsTool(toolContext),
            },
            getExternalAnalytics: {
                ...createExternalAnalyticsTool(toolContext),
            },
            getKnowledgeBase: {
                ...createKnowledgeBaseTool(toolContext),
            },
            scrapeWebSource: {
                ...createScrapeWebSourceTool(toolContext),
            },
            createStrategicTip: {
                ...createStrategicTipCreationTool(toolContext),
            },
            manageTipRouting: {
                ...createTipRoutingManagerTool(toolContext),
            },
            manageCanonicalTips: {
                ...createManageCanonicalTipsTool(toolContext),
            },
            manageProjectConnections: {
                ...createProjectConnectionsOpsTool(toolContext),
            },
            getCompetitorIntelligence: {
                ...createCompetitorAnalysisTool(toolContext),
            },
            analyzeSeoGeoAeo: {
                ...createSeoGeoAeoTool(toolContext),
            }
        };

        const toolSet = hasProjectAccess
            ? ({ ...supportTools, ...projectTools } as any)
            : (supportTools as any);

        const SYSTEM_SUFFIX = "\n\nCRITICAL: Never respond with placeholder messages like 'I'm searching' as a final answer. Always complete tool calls and give a full markdown answer. Optionally end with a natural Italian follow-up question on a new line prefixed with 'FOLLOW_UP: '.";

        const buildLLM = (provider: 'anthropic' | 'openai' | 'gemini', model: string) =>
            provider === 'anthropic'
                ? createAnthropic({ apiKey: anthropicApiKey })(model)
                : provider === 'openai'
                    ? createOpenAI({ apiKey: openaiApiKey })(model)
                    : createGoogleGenerativeAI({ apiKey: geminiApiKey })(model);

        // Prefer highest-capability configured models, then graceful degradation.
        const anthropicModelCandidates = Array.from(new Set([
            'claude-sonnet-4-5-20250929',
            (process.env.ANTHROPIC_MODEL || '').trim(),
            'claude-sonnet-4-5',
            'claude-3-7-sonnet-latest',
            'claude-3-5-sonnet-20241022',
            'claude-3-7-sonnet-20250219',
            'claude-3-5-sonnet-latest',
        ].filter(Boolean)));

        const openAIModelCandidates = Array.from(new Set([
            (process.env.OPENAI_MODEL || '').trim(),
            'gpt-5.2',
            'gpt-5',
            'gpt-5-mini',
            'gpt-4.1',
            'gpt-4o',
        ].filter(Boolean)));

        const geminiModelCandidates = Array.from(new Set([
            (process.env.GEMINI_MODEL || '').trim(),
            'gemini-3.0-flash-latest',
            'gemini-1.5-pro-latest',
            'gemini-2.0-flash',
        ].filter(Boolean)));

        let modelUsed = anthropicModelCandidates[0] || 'claude-sonnet-4-5-20250929';

        // Metadata captured in onFinish — shared across attempts
        let capturedUsage: any = null;
        let capturedToolsUsed: string[] = [];

        const attemptStream = async (provider: 'anthropic' | 'openai' | 'gemini', model: string) => {
            modelUsed = model;
            return streamText({
                model: buildLLM(provider, model) as any,
                system: systemPrompt + SYSTEM_SUFFIX,
                messages: inputMessages,
                tools: toolSet,
                // @ts-expect-error maxSteps is valid in ai v5 but TS overload resolution fails when tools is typed as any
                maxSteps: 4,
                temperature: 0.3,
                abortSignal: AbortSignal.timeout(55000),
                onFinish: ({ usage, steps }) => {
                    capturedUsage = usage;
                    capturedToolsUsed = steps?.flatMap((s: any) => s.toolCalls?.map((tc: any) => tc.toolName) ?? []) ?? [];
                }
            });
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let streamResult: Awaited<ReturnType<typeof attemptStream>> | undefined;

        try {
            if (anthropicApiKey) {
                let lastError: unknown = null;
                for (const candidate of anthropicModelCandidates) {
                    try {
                        streamResult = await attemptStream('anthropic', candidate);
                        lastError = null;
                        break;
                    } catch (error) {
                        lastError = error;
                        if (!shouldFallbackFromAnthropic(error)) throw error;
                        if (isAnthropicBillingError(error)) break;
                    }
                }
                if (lastError) throw lastError;
            } else {
                const openAIHeadCandidates = openAIModelCandidates.filter((model) => model === 'gpt-5.2' || model === 'gpt-5');
                const openAITailCandidates = openAIModelCandidates.filter((model) => model !== 'gpt-5.2' && model !== 'gpt-5');
                const mixedCandidates: Array<{ provider: 'openai' | 'gemini'; model: string }> = [
                    ...(openaiApiKey ? openAIHeadCandidates.map((model) => ({ provider: 'openai' as const, model })) : []),
                    ...(geminiApiKey ? geminiModelCandidates.map((model) => ({ provider: 'gemini' as const, model })) : []),
                    ...(openaiApiKey ? openAITailCandidates.map((model) => ({ provider: 'openai' as const, model })) : []),
                ];
                let mixedLastError: unknown = null;
                for (const candidate of mixedCandidates) {
                    try {
                        streamResult = await attemptStream(candidate.provider, candidate.model);
                        mixedLastError = null;
                        break;
                    } catch (error) {
                        mixedLastError = error;
                        const retryable =
                            isConnectionError(error) ||
                            (candidate.provider === 'openai' && isOpenAIModelNotFound(error)) ||
                            (candidate.provider === 'gemini' && isGeminiModelNotFound(error));
                        if (!retryable) throw error;
                    }
                }
                if (mixedLastError) throw mixedLastError;
            }
        } catch (error) {
            if (shouldFallbackFromAnthropic(error) && (openaiApiKey || geminiApiKey)) {
                console.warn('[Copilot] Fallback from Anthropic to OpenAI/Gemini due to provider failure');
                const openAIHeadCandidates = openAIModelCandidates.filter((model) => model === 'gpt-5.2' || model === 'gpt-5');
                const openAITailCandidates = openAIModelCandidates.filter((model) => model !== 'gpt-5.2' && model !== 'gpt-5');
                const mixedCandidates: Array<{ provider: 'openai' | 'gemini'; model: string }> = [
                    ...(openaiApiKey ? openAIHeadCandidates.map((model) => ({ provider: 'openai' as const, model })) : []),
                    ...(geminiApiKey ? geminiModelCandidates.map((model) => ({ provider: 'gemini' as const, model })) : []),
                    ...(openaiApiKey ? openAITailCandidates.map((model) => ({ provider: 'openai' as const, model })) : []),
                ];
                let mixedLastError: unknown = null;
                for (const candidate of mixedCandidates) {
                    try {
                        streamResult = await attemptStream(candidate.provider, candidate.model);
                        mixedLastError = null;
                        break;
                    } catch (providerError) {
                        mixedLastError = providerError;
                        const retryable =
                            isConnectionError(providerError) ||
                            (candidate.provider === 'openai' && isOpenAIModelNotFound(providerError)) ||
                            (candidate.provider === 'gemini' && isGeminiModelNotFound(providerError));
                        if (!retryable) throw providerError;
                    }
                }
                if (mixedLastError) throw mixedLastError;
            } else {
                throw error;
            }
        }

        // Stream the text to the client using Server-Sent Events.
        // After the LLM finishes we append a JSON metadata frame so the client
        // can extract suggestedFollowUp / toolsUsed without a second round-trip.
        const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
        const writer = writable.getWriter();
        const enc = new TextEncoder();

        (async () => {
            let fullText = '';
            try {
                for await (const chunk of streamResult!.textStream) {
                    fullText += chunk;
                    await writer.write(enc.encode(chunk));
                }

                // Extract and strip FOLLOW_UP line from streamed text
                let suggestedFollowUp = '';
                const followUpMatch = fullText.match(/\nFOLLOW_UP:\s*(.+)$/m);
                if (followUpMatch) {
                    suggestedFollowUp = followUpMatch[1].trim();
                }
                const promptContext = buildPromptContextFromConversation(inputMessages);
                const suggestedPromptVariants = promptContext
                    ? buildCopilotPromptVariants(promptContext, suggestedFollowUp, fullText)
                    : (suggestedFollowUp ? [suggestedFollowUp] : []);

                // KB fallback only when the model produced no usable output at all.
                // Avoid replacing valid answers with hardcoded KB excerpts.
                let usedKnowledgeBase = false;
                if (!fullText.trim() && kbResults.length > 0) {
                    const top = kbResults[0];
                    const fallback = `Posso aiutarti su questo tema. Dalla documentazione interna risulta utile iniziare da **${top.title}**.\n\nSe vuoi, ti guido passo-passo in modo operativo sul tuo progetto.`;
                    await writer.write(enc.encode('\x00' + fallback)); // replace signal
                    fullText = fallback;
                    usedKnowledgeBase = true;
                }

                // Track token usage
                if (capturedUsage) {
                    try {
                        await TokenTrackingService.logTokenUsage({
                            userId: session.user!.id,
                            organizationId: organization?.id,
                            projectId: projectId || undefined,
                            inputTokens: capturedUsage.promptTokens || capturedUsage.inputTokens || 0,
                            outputTokens: capturedUsage.completionTokens || capturedUsage.outputTokens || 0,
                            category: 'SUGGESTION',
                            model: modelUsed,
                            operation: 'copilot-chat',
                            resourceType: 'copilot',
                            resourceId: session.user!.id,
                            actionOverride: 'copilot_message'
                        });
                    } catch (err) {
                        console.error('[Copilot] Credit tracking failed:', err);
                    }
                }

                // Persist conversation messages
                try {
                    await prisma.copilotMessage.createMany({
                        data: [
                            { conversationId, role: 'user', content: message, toolsUsed: [] },
                            { conversationId, role: 'assistant', content: fullText, toolsUsed: capturedToolsUsed }
                        ]
                    });
                    await prisma.copilotConversation.update({
                        where: { id: conversationId },
                        data: { updatedAt: new Date() }
                    });
                } catch (e) {
                    console.error('[Copilot] Conversation persistence error:', e);
                }

                // Log copilot session
                const estimatedTokens = Math.ceil((message.length + fullText.length) / 4);
                const sessionDate = new Date().toISOString().split('T')[0];
                const sessionKey = `${session.user!.id}-${sessionDate}`;
                try {
                    await prisma.copilotSession.upsert({
                        where: { id: sessionKey },
                        update: { messagesCount: { increment: 1 }, tokensUsed: { increment: estimatedTokens } },
                        create: {
                            id: sessionKey,
                            userId: session.user!.id as string,
                            organizationId: organization.id,
                            projectId: projectId || null,
                            messagesCount: 1,
                            tokensUsed: estimatedTokens
                        }
                    });
                } catch (e) {
                    console.error('[Copilot] Session logging error:', e);
                }

                // Append metadata as a special JSON frame delimited by \x01
                const meta = JSON.stringify({
                    conversationId,
                    hasProjectAccess,
                    usedKnowledgeBase,
                    suggestedFollowUp,
                    suggestedPromptVariants,
                    toolsUsed: capturedToolsUsed
                });
                await writer.write(enc.encode('\x01' + meta));
            } catch (err) {
                console.error('[Copilot] Stream error:', err);
            } finally {
                await writer.close();
            }
        })();

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        });

    } catch (error: any) {
        console.error('[Copilot] Error:', error);
        return NextResponse.json(
            { error: 'Internal error', message: error.message },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(req.url);
        const conversationId = searchParams.get('conversationId');
        if (!conversationId) {
            return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
        }
        const conversation = await prisma.copilotConversation.findFirst({
            where: { id: conversationId, userId: session.user.id },
            include: {
                messages: { orderBy: { createdAt: 'asc' }, take: 40 }
            }
        });
        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }
        return NextResponse.json({
            conversationId: conversation.id,
            messages: conversation.messages.map(m => ({
                role: m.role,
                content: m.content,
                toolsUsed: m.toolsUsed,
                createdAt: m.createdAt
            }))
        });
    } catch (error: any) {
        console.error('[Copilot GET] Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
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
                take: 20 // Only most recent 20 conversations needed for context
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
