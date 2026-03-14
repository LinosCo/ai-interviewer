import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { NextResponse } from 'next/server';
import { buildCopilotSystemPrompt } from '@/lib/copilot/system-prompt';
import { canAccessProjectData } from '@/lib/copilot/permissions';
import {
    buildCondensedConversationHistory,
    detectCopilotIntent,
    isConnectionFlowContext,
    isConnectionNonAnswer,
    isConnectionTestIntent,
    isConnectionsIntent,
    isDocsIntent,
    isGoogleAnalyticsIntent,
    isLowSignalUserMessage,
    selectCopilotToolNames,
    type CopilotIntentProfile,
    type CopilotToolName
} from '@/lib/copilot/runtime';
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
    createAccountUsageTool,
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

type CopilotLogLevel = 'info' | 'warn' | 'error';

function buildLogTextPreview(value: unknown, maxChars = 180): string {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function serializeErrorForLog(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3).join('\n') || undefined
        };
    }

    return { message: String(error || 'Unknown error') };
}

function logCopilotEvent(
    requestId: string,
    stage: string,
    details: Record<string, unknown> = {},
    level: CopilotLogLevel = 'info'
): void {
    const payload = {
        requestId,
        stage,
        ...details
    };

    if (level === 'warn') {
        console.warn('[Copilot]', payload);
        return;
    }

    if (level === 'error') {
        console.error('[Copilot]', payload);
        return;
    }

    console.info('[Copilot]', payload);
}

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

type ProjectConnectionsSnapshot = {
    projectName: string;
    googleConnection: {
        ga4Enabled: boolean;
        ga4Status: string | null;
        ga4PropertyId: string | null;
        gscEnabled: boolean;
        gscStatus: string | null;
        gscSiteUrl: string | null;
    } | null;
    mcpTotal: number;
    mcpConnected: number;
    cmsTotal: number;
    cmsConnected: number;
    n8nTotal: number;
    n8nConnected: number;
};

type ConnectionStatusLike = {
    success?: boolean;
    operation?: string;
    routingReady?: boolean;
    connections?: {
        mcp?: Array<{ status?: string; name?: string }>;
        google?: {
            ga4Enabled?: boolean;
            ga4Status?: string | null;
            ga4PropertyId?: string | null;
            gscEnabled?: boolean;
            gscStatus?: string | null;
            gscSiteUrl?: string | null;
        } | null;
        cms?: Array<{ status?: string; name?: string }>;
        n8n?: { status?: string | null; name?: string } | null;
    };
    tested?: number;
    tests?: Array<{
        type?: string;
        name?: string;
        result?: Record<string, unknown> | null;
    }>;
    error?: string;
    details?: string;
};

function compactSnippet(text: string, maxChars: number): string {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (compact.length <= maxChars) return compact;
    return `${compact.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function buildConnectionsVerificationResponse(snapshot: ProjectConnectionsSnapshot): string {
    const gaLine = snapshot.googleConnection
        ? `Google: GA4 ${snapshot.googleConnection.ga4Enabled ? 'attiva' : 'non attiva'}${snapshot.googleConnection.ga4PropertyId ? ` (Property ${snapshot.googleConnection.ga4PropertyId})` : ''}; Search Console ${snapshot.googleConnection.gscEnabled ? 'attiva' : 'non attiva'}${snapshot.googleConnection.gscSiteUrl ? ` (${snapshot.googleConnection.gscSiteUrl})` : ''}.`
        : 'Google: nessuna connessione configurata per questo progetto.';

    return [
        `Ho verificato ora le connessioni del progetto **${snapshot.projectName}**:`,
        '',
        `- ${gaLine}`,
        `- MCP: ${snapshot.mcpConnected}/${snapshot.mcpTotal} attive.`,
        `- CMS: ${snapshot.cmsConnected}/${snapshot.cmsTotal} attive.`,
        `- n8n: ${snapshot.n8nConnected}/${snapshot.n8nTotal} attive.`,
        '',
        'Se vuoi connettere GA4 adesso, ti guido in 3 campi: Service Account JSON, Property ID GA4, test sincronizzazione.'
    ].join('\n');
}

function buildConnectionsToolResponse(
    result: ConnectionStatusLike | null | undefined,
    snapshot: ProjectConnectionsSnapshot | null
): string {
    if (!result?.success) {
        if (result?.error) {
            return `Non sono riuscito a verificare le connessioni in modo affidabile: ${result.error}${result.details ? ` (${result.details})` : ''}`;
        }
        return snapshot
            ? buildConnectionsVerificationResponse(snapshot)
            : 'Non sono riuscito a verificare le connessioni in modo affidabile. Seleziona un progetto specifico e riprova.';
    }

    if (result.operation === 'test' && Array.isArray(result.tests)) {
        const lines = result.tests.map((test) => {
            const payload = test.result || {};

            if ('ga4' in payload || 'gsc' in payload) {
                const ga4 = payload.ga4 as Record<string, unknown> | undefined;
                const gsc = payload.gsc as Record<string, unknown> | undefined;
                const ga4Label = ga4?.success === true
                    ? 'GA4 OK'
                    : ga4?.skipped
                        ? `GA4 SKIP (${ga4.reason || 'non configurato'})`
                        : `GA4 FAIL (${ga4?.message || ga4?.reason || 'errore'})`;
                const gscLabel = gsc?.success === true
                    ? 'GSC OK'
                    : gsc?.skipped
                        ? `GSC SKIP (${gsc.reason || 'non configurato'})`
                        : `GSC FAIL (${gsc?.message || gsc?.reason || 'errore'})`;
                return `- ${test.name || 'Google'}: ${ga4Label}; ${gscLabel}`;
            }

            const ok = payload.success === true;
            const skipped = payload.skipped === true;
            const detail = skipped
                ? `SKIP (${payload.reason || 'non configurato'})`
                : ok
                    ? 'OK'
                    : `FAIL (${payload.message || payload.reason || 'errore'})`;
            return `- ${test.name || test.type || 'Connessione'}: ${detail}`;
        });

        return [
            'Ho eseguito la verifica tecnica delle connessioni:',
            '',
            ...lines,
            '',
            'Se vuoi, nel prossimo passo ti porto direttamente sulla correzione prioritaria.'
        ].join('\n');
    }

    const connections = result.connections;
    if (connections) {
        const mcp = Array.isArray(connections.mcp) ? connections.mcp : [];
        const cms = Array.isArray(connections.cms) ? connections.cms : [];
        const n8n = connections.n8n;
        const google = connections.google;

        return [
            'Ho verificato lo stato operativo delle connessioni del progetto:',
            '',
            `- Google: GA4 ${google?.ga4Enabled ? (google.ga4Status || 'ENABLED') : 'DISABLED'}${google?.ga4PropertyId ? ` (${google.ga4PropertyId})` : ''}; GSC ${google?.gscEnabled ? (google.gscStatus || 'ENABLED') : 'DISABLED'}${google?.gscSiteUrl ? ` (${google.gscSiteUrl})` : ''}.`,
            `- MCP: ${mcp.filter((item) => item.status === 'CONNECTED' || item.status === 'ACTIVE').length}/${mcp.length} attive.`,
            `- CMS: ${cms.filter((item) => item.status === 'CONNECTED' || item.status === 'ACTIVE').length}/${cms.length} attive.`,
            `- n8n: ${n8n ? (n8n.status || 'PENDING') : 'non configurata'}.`,
            '',
            `Routing pronto: ${result.routingReady ? 'si' : 'no'}.`
        ].join('\n');
    }

    return snapshot
        ? buildConnectionsVerificationResponse(snapshot)
        : 'Non sono riuscito a costruire un riepilogo operativo delle connessioni.';
}

function buildGoogleAnalyticsOperationalFallback(params: {
    ga4Enabled?: boolean;
    ga4Status?: string | null;
    ga4PropertyId?: string | null;
    gscEnabled?: boolean;
    gscStatus?: string | null;
}): string {
    const gaState = params.ga4Enabled
        ? `GA4 risulta attiva${params.ga4PropertyId ? ` (Property ID: ${params.ga4PropertyId})` : ''}.`
        : 'GA4 non risulta ancora attiva su questo progetto.';
    const gscState = params.gscEnabled
        ? 'Search Console risulta attiva.'
        : 'Search Console non risulta ancora attiva.';

    return [
        'Per connettere Google Analytics (GA4) nel progetto:',
        '',
        '1. Vai in Dashboard > Progetto > Connessioni > Google.',
        '2. Incolla le credenziali del Service Account Google (JSON completo).',
        '3. Inserisci il Property ID GA4 (formato numerico, senza prefisso).',
        '4. Salva e avvia una sincronizzazione di test.',
        '5. Verifica stato: deve passare a CONNECTED senza errori.',
        '',
        `Stato attuale: ${gaState} ${gscState}`,
        '',
        'Se vuoi, ti guido adesso con un check puntuale dei campi da compilare uno per uno.'
    ].join('\n');
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

function looksLikeContentPrompt(text: string): boolean {
    const normalized = String(text || '').toLowerCase();
    return [
        'linkedin',
        'email',
        'newsletter',
        'articolo',
        'blog',
        'faq',
        'contenuto',
        'carousel',
        'post',
        'landing',
        'pagina',
        'cta'
    ].some((fragment) => normalized.includes(fragment));
}

function buildCopilotPromptVariants(prompt: string, suggestedFollowUp: string, assistantText: string): string[] {
    if (isLowSignalUserMessage(prompt) || isAssistantErrorLike(assistantText)) {
        return suggestedFollowUp ? [suggestedFollowUp] : [];
    }

    const normalized = prompt.toLowerCase();

    if (isConnectionFlowContext(normalized)) {
        return [
            suggestedFollowUp,
            'Verifica adesso se GA4 e Search Console risultano CONNECTED in questo progetto.',
            'Guidami a compilare i campi minimi richiesti (Service Account JSON e Property ID) senza errori.',
        ].filter(Boolean).slice(0, 3);
    }

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

    if (isDocsIntent(normalized)) {
        return [
            suggestedFollowUp,
            'Dimmi il passaggio esatto in cui ti blocchi e ti guido passo passo.',
            'Verifica se questa funzione è inclusa nel tuo piano attuale.',
        ].filter(Boolean).slice(0, 3);
    }

    if (looksLikeContentPrompt(normalized)) {
        const related = buildRelatedCopilotPromptSuggestions(prompt);
        return [...new Set([suggestedFollowUp, ...related].filter(Boolean))].slice(0, 3);
    }

    return [suggestedFollowUp].filter(Boolean).slice(0, 3);
}

function buildKnowledgeBaseContext(
    results: Array<{ title: string; content: string }>
): string {
    return results
        .slice(0, 1)
        .map((result) => `[${result.title}]: ${compactSnippet(result.content, 700)}`)
        .join('\n\n');
}

function buildCopilotModelPlan(params: {
    intentProfile: CopilotIntentProfile;
    anthropicApiKey: string;
    openaiApiKey: string;
    geminiApiKey: string;
}) {
    const { intentProfile, anthropicApiKey, openaiApiKey, geminiApiKey } = params;
    const budgetFirst =
        intentProfile.primaryArea === 'usage' ||
        intentProfile.primaryArea === 'support' ||
        intentProfile.primaryArea === 'general';
    const operationalFirst =
        intentProfile.needsOperationalExecution ||
        intentProfile.primaryArea === 'analytics' ||
        intentProfile.primaryArea === 'visibility';

    const openAIBudget = Array.from(new Set([
        (process.env.OPENAI_MODEL || '').trim(),
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-4.1',
        'gpt-5-mini',
        'gpt-5',
    ].filter(Boolean)));

    const openAIBalanced = Array.from(new Set([
        (process.env.OPENAI_MODEL || '').trim(),
        'gpt-4.1',
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-5-mini',
        'gpt-5',
    ].filter(Boolean)));

    const anthropicBudget = Array.from(new Set([
        (process.env.ANTHROPIC_MODEL || '').trim(),
        'claude-3-5-haiku-latest',
        'claude-3-5-sonnet-20241022',
        'claude-3-7-sonnet-latest',
        'claude-sonnet-4-5-20250929',
    ].filter(Boolean)));

    const anthropicBalanced = Array.from(new Set([
        (process.env.ANTHROPIC_MODEL || '').trim(),
        'claude-3-5-sonnet-20241022',
        'claude-3-7-sonnet-latest',
        'claude-3-5-haiku-latest',
        'claude-sonnet-4-5-20250929',
    ].filter(Boolean)));

    const geminiBudget = Array.from(new Set([
        (process.env.GEMINI_MODEL || '').trim(),
        'gemini-2.0-flash',
        'gemini-3.0-flash-latest',
        'gemini-1.5-pro-latest',
    ].filter(Boolean)));

    const providerPlan = budgetFirst
        ? [
            ...(openaiApiKey ? [{ provider: 'openai' as const, models: openAIBudget }] : []),
            ...(geminiApiKey ? [{ provider: 'gemini' as const, models: geminiBudget }] : []),
            ...(anthropicApiKey ? [{ provider: 'anthropic' as const, models: anthropicBudget }] : []),
        ]
        : operationalFirst
            ? [
                ...(openaiApiKey ? [{ provider: 'openai' as const, models: openAIBalanced }] : []),
                ...(anthropicApiKey ? [{ provider: 'anthropic' as const, models: anthropicBalanced }] : []),
                ...(geminiApiKey ? [{ provider: 'gemini' as const, models: geminiBudget }] : []),
            ]
            : [
            ...(openaiApiKey ? [{ provider: 'openai' as const, models: openAIBalanced }] : []),
            ...(geminiApiKey ? [{ provider: 'gemini' as const, models: geminiBudget }] : []),
            ...(anthropicApiKey ? [{ provider: 'anthropic' as const, models: anthropicBalanced }] : []),
        ];

    return providerPlan;
}

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    const requestStartedAt = Date.now();
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, conversationId: incomingConversationId, projectId } = await req.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const normalizedProjectId = typeof projectId === 'string' && projectId.trim().length > 0
            ? projectId.trim()
            : null;
        let intentProfile = detectCopilotIntent(message);
        logCopilotEvent(requestId, 'request_received', {
            userId: session.user.id,
            incomingConversationId: incomingConversationId || null,
            normalizedProjectId,
            messagePreview: buildLogTextPreview(message),
            initialIntent: intentProfile.primaryArea
        });

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
            normalizedProjectId || undefined,
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
        let projectConnectionsSnapshot: ProjectConnectionsSnapshot | null = null;
        if (hasProjectAccess && normalizedProjectId) {
            try {
                const ctx = await ProjectIntelligenceContextService.getContext({
                    projectId: normalizedProjectId,
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

                if (isConnectionsIntent(message)) {
                    const [googleConnection, mcpConnections, cmsConnections, n8nConnections] = await Promise.all([
                        prisma.googleConnection.findFirst({
                            where: {
                                projectId: normalizedProjectId,
                                project: { organizationId: organization.id }
                            },
                            select: {
                                ga4Enabled: true,
                                ga4Status: true,
                                ga4PropertyId: true,
                                gscEnabled: true,
                                gscStatus: true,
                                gscSiteUrl: true
                            }
                        }),
                        prisma.mCPConnection.findMany({
                            where: {
                                OR: [
                                    { projectId: normalizedProjectId },
                                    { projectShares: { some: { projectId: normalizedProjectId } } }
                                ]
                            },
                            select: { status: true }
                        }),
                        prisma.cMSConnection.findMany({
                            where: {
                                OR: [
                                    { projectId: normalizedProjectId },
                                    { projectShares: { some: { projectId: normalizedProjectId } } }
                                ]
                            },
                            select: { status: true }
                        }),
                        prisma.n8NConnection.findMany({
                            where: { projectId: normalizedProjectId },
                            select: { status: true }
                        })
                    ]);

                    projectConnectionsSnapshot = {
                        projectName: ctx.projectName,
                        googleConnection: googleConnection ? {
                            ga4Enabled: !!googleConnection.ga4Enabled,
                            ga4Status: googleConnection.ga4Status ?? null,
                            ga4PropertyId: googleConnection.ga4PropertyId ?? null,
                            gscEnabled: !!googleConnection.gscEnabled,
                            gscStatus: googleConnection.gscStatus ?? null,
                            gscSiteUrl: googleConnection.gscSiteUrl ?? null,
                        } : null,
                        mcpTotal: mcpConnections.length,
                        mcpConnected: mcpConnections.filter((c) => (c.status as string) === 'ACTIVE').length,
                        cmsTotal: cmsConnections.length,
                        cmsConnected: cmsConnections.filter((c) => (c.status as string) === 'ACTIVE').length,
                        n8nTotal: n8nConnections.length,
                        n8nConnected: n8nConnections.filter((c) => (c.status as string) === 'ACTIVE').length,
                    };
                }
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

        if (!normalizedProjectId && (intentProfile.needsOperationalExecution || isConnectionsIntent(message))) {
            logCopilotEvent(requestId, 'project_context_missing', {
                tier,
                hasProjectAccess,
                intent: intentProfile.primaryArea,
                messagePreview: buildLogTextPreview(message)
            }, 'warn');
        }

        // 5. Search platform KB only when it is likely to help.
        const kbResults = intentProfile.prefetchKb || !hasProjectAccess
            ? await searchPlatformKB(message, intentProfile.kbCategory)
            : [];
        const kbContext = buildKnowledgeBaseContext(kbResults);

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
                where: {
                    id: incomingConversationId,
                    userId: session.user.id,
                    organizationId: organization.id,
                    projectId: normalizedProjectId
                },
                include: {
                    messages: { orderBy: { createdAt: 'asc' }, take: 30 }
                }
            });
        }
        if (!conversation) {
            conversation = await prisma.copilotConversation.create({
                data: {
                    userId: session.user.id,
                    organizationId: organization.id,
                    projectId: normalizedProjectId
                },
                include: { messages: true }
            });
        }
        const conversationId = conversation.id;

        const recentRelevantUserMessage = [...conversation.messages]
            .reverse()
            .find((messageItem) => (
                messageItem.role === 'user' &&
                !isLowSignalUserMessage(messageItem.content)
            ));
        const asksForProjectContext =
            /progett/i.test(message) &&
            (
                /non vedi/i.test(message) ||
                /quale progetto/i.test(message) ||
                /che progetto/i.test(message)
            );
        if ((isLowSignalUserMessage(message) || asksForProjectContext) && recentRelevantUserMessage) {
            intentProfile = detectCopilotIntent(recentRelevantUserMessage.content);
            logCopilotEvent(requestId, 'intent_inherited_from_context', {
                inheritedFromMessagePreview: buildLogTextPreview(recentRelevantUserMessage.content),
                finalIntent: intentProfile.primaryArea,
                triggerMessagePreview: buildLogTextPreview(message)
            });
        }

        const condensedHistory = buildCondensedConversationHistory(
            conversation.messages.map((messageItem) => ({
                role: messageItem.role as 'user' | 'assistant',
                content: messageItem.content,
                toolsUsed: messageItem.toolsUsed
            }))
        );
        logCopilotEvent(requestId, 'context_resolved', {
            organizationId: organization.id,
            organizationName: organization.name,
            tier,
            hasProjectAccess,
            normalizedProjectId,
            projectName: projectContext?.projectName || null,
            conversationId,
            historyMessagesLoaded: conversation.messages.length,
            condensedRecentMessages: condensedHistory.recentMessages.length,
            hasCondensedSummary: Boolean(condensedHistory.summary),
            kbCategory: intentProfile.kbCategory,
            kbResultsCount: kbResults.length,
            intent: intentProfile.primaryArea,
            intentAreas: intentProfile.areas
        });
        if (condensedHistory.summary) {
            systemPrompt += `\n\n## Stato conversazione in corso\n${condensedHistory.summary}`;
        }

        const inputMessages = [
            ...condensedHistory.recentMessages,
            { role: 'user' as const, content: message }
        ];

        // 8. Generate response (Anthropic primary, OpenAI fallback on recoverable provider failures)

        const toolContext = {
            userId: session.user.id,
            organizationId: organization.id,
            projectId: normalizedProjectId
        };

        const toolRegistry: Record<CopilotToolName, any> = {
            searchPlatformHelp: {
                ...createPlatformHelpSearchTool(),
            },
            getAccountUsage: {
                ...createAccountUsageTool(toolContext),
            },
            getStrategicKnowledge: {
                ...createStrategicKnowledgeTool(toolContext),
            },
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

        const selectedToolNames = selectCopilotToolNames(intentProfile, hasProjectAccess);
        const toolSet = Object.fromEntries(
            selectedToolNames.map((toolName) => [toolName, toolRegistry[toolName]])
        ) as any;

        const SYSTEM_SUFFIX = "\n\nCRITICAL: Never respond with placeholder messages like 'I'm searching' as a final answer. Always complete tool calls and give a full markdown answer. Optionally end with a natural Italian follow-up question on a new line prefixed with 'FOLLOW_UP: '.";

        const buildLLM = (provider: 'anthropic' | 'openai' | 'gemini', model: string) =>
            provider === 'anthropic'
                ? createAnthropic({ apiKey: anthropicApiKey })(model)
                : provider === 'openai'
                    ? createOpenAI({ apiKey: openaiApiKey })(model)
                    : createGoogleGenerativeAI({ apiKey: geminiApiKey })(model);

        const modelPlan = buildCopilotModelPlan({
            intentProfile,
            anthropicApiKey,
            openaiApiKey,
            geminiApiKey
        });
        let modelUsed = modelPlan[0]?.models[0] || 'gpt-4o-mini';
        logCopilotEvent(requestId, 'execution_plan', {
            selectedToolNames,
            maxSteps: intentProfile.maxSteps,
            modelPlan: modelPlan.map((candidateGroup) => ({
                provider: candidateGroup.provider,
                models: candidateGroup.models.slice(0, 4)
            }))
        });

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
                maxSteps: intentProfile.maxSteps,
                temperature: 0.3,
                abortSignal: AbortSignal.timeout(55000),
                onFinish: ({ usage, steps }) => {
                    capturedUsage = usage;
                    capturedToolsUsed = Array.from(new Set(
                        steps?.flatMap((step: any) => step.toolCalls?.map((toolCall: any) => toolCall.toolName) ?? []) ?? []
                    ));
                }
            });
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let streamResult: Awaited<ReturnType<typeof attemptStream>> | undefined;
        let lastProviderError: unknown = null;

        providerLoop:
        for (const candidateGroup of modelPlan) {
            for (const candidateModel of candidateGroup.models) {
                try {
                    streamResult = await attemptStream(candidateGroup.provider, candidateModel);
                    lastProviderError = null;
                    logCopilotEvent(requestId, 'provider_selected', {
                        provider: candidateGroup.provider,
                        model: candidateModel
                    });
                    break providerLoop;
                } catch (error) {
                    lastProviderError = error;
                    const retryable =
                        isConnectionError(error) ||
                        (candidateGroup.provider === 'anthropic' && shouldFallbackFromAnthropic(error)) ||
                        (candidateGroup.provider === 'openai' && isOpenAIModelNotFound(error)) ||
                        (candidateGroup.provider === 'gemini' && isGeminiModelNotFound(error));

                    logCopilotEvent(requestId, 'provider_attempt_failed', {
                        provider: candidateGroup.provider,
                        model: candidateModel,
                        retryable,
                        error: serializeErrorForLog(error)
                    }, retryable ? 'warn' : 'error');
                    if (!retryable) throw error;
                    if (candidateGroup.provider === 'anthropic' && isAnthropicBillingError(error)) {
                        break;
                    }
                }
            }
        }

        if (!streamResult) {
            throw lastProviderError instanceof Error
                ? lastProviderError
                : new Error('No configured LLM provider responded successfully.');
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

                if (
                    isConnectionsIntent(message) &&
                    isConnectionNonAnswer(fullText)
                ) {
                    logCopilotEvent(requestId, 'connection_non_answer_detected', {
                        fullTextPreview: buildLogTextPreview(fullText),
                        normalizedProjectId,
                        hasSnapshot: Boolean(projectConnectionsSnapshot)
                    }, 'warn');
                    let fallbackResult: ConnectionStatusLike | null = null;
                    if (normalizedProjectId) {
                        const connectionTypes = isGoogleAnalyticsIntent(message)
                            ? ['google' as const]
                            : undefined;
                        const fallbackOperation = isConnectionTestIntent(message) || isGoogleAnalyticsIntent(message)
                            ? 'test'
                            : 'status';
                        fallbackResult = await toolRegistry.manageProjectConnections.execute({
                            operation: fallbackOperation,
                            projectId: normalizedProjectId,
                            connectionTypes
                        });
                        capturedToolsUsed = Array.from(new Set([
                            ...capturedToolsUsed,
                            'manageProjectConnections'
                        ]));
                    }

                    logCopilotEvent(requestId, 'connection_fallback_result', {
                        normalizedProjectId,
                        fallbackOperation: isConnectionTestIntent(message) || isGoogleAnalyticsIntent(message)
                            ? 'test'
                            : 'status',
                        fallbackResult
                    });

                    const deterministic = buildConnectionsToolResponse(
                        fallbackResult,
                        projectConnectionsSnapshot
                    );
                    await writer.write(enc.encode('\x00' + deterministic));
                    fullText = deterministic;
                }

                // KB fallback only when the model produced no usable output at all.
                // Avoid replacing valid answers with hardcoded KB excerpts.
                let usedKnowledgeBase = false;
                if (!fullText.trim()) {
                    let fallback = 'Non sono riuscito a completare la risposta. Riprova con la stessa richiesta e includi il progetto selezionato.';

                    if (isGoogleAnalyticsIntent(message)) {
                        let googleConnection: {
                            ga4Enabled?: boolean;
                            ga4Status?: string | null;
                            ga4PropertyId?: string | null;
                            gscEnabled?: boolean;
                            gscStatus?: string | null;
                        } | null = null;
                        if (normalizedProjectId) {
                            googleConnection = await prisma.googleConnection.findFirst({
                                where: {
                                    projectId: normalizedProjectId,
                                    project: { organizationId: organization.id }
                                },
                                select: {
                                    ga4Enabled: true,
                                    ga4Status: true,
                                    ga4PropertyId: true,
                                    gscEnabled: true,
                                    gscStatus: true
                                }
                            });
                        }
                        fallback = buildGoogleAnalyticsOperationalFallback({
                            ga4Enabled: googleConnection?.ga4Enabled,
                            ga4Status: googleConnection?.ga4Status ?? null,
                            ga4PropertyId: googleConnection?.ga4PropertyId ?? null,
                            gscEnabled: googleConnection?.gscEnabled,
                            gscStatus: googleConnection?.gscStatus ?? null,
                        });
                    } else if (kbResults.length > 0 && isDocsIntent(message)) {
                        const top = kbResults[0];
                        fallback = `Ho trovato contenuti rilevanti nella documentazione: **${top.title}**.\n\nPosso riassumerli in modo operativo sul tuo caso in 3 passi.`;
                        usedKnowledgeBase = true;
                    }

                    logCopilotEvent(requestId, 'empty_output_fallback', {
                        normalizedProjectId,
                        intent: intentProfile.primaryArea,
                        isGoogleAnalyticsIntent: isGoogleAnalyticsIntent(message),
                        usedKnowledgeBase,
                        fallbackPreview: buildLogTextPreview(fallback)
                    }, 'warn');

                    await writer.write(enc.encode('\x00' + fallback)); // replace signal
                    fullText = fallback;
                }

                // Track token usage
                if (capturedUsage) {
                    try {
                        await TokenTrackingService.logTokenUsage({
                            userId: session.user!.id,
                            organizationId: organization?.id,
                            projectId: normalizedProjectId || undefined,
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
                            projectId: normalizedProjectId,
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
                logCopilotEvent(requestId, 'completed', {
                    conversationId,
                    normalizedProjectId,
                    modelUsed,
                    toolsUsed: capturedToolsUsed,
                    usage: capturedUsage || null,
                    usedKnowledgeBase,
                    suggestedFollowUp: suggestedFollowUp || null,
                    suggestedPromptVariants,
                    responseChars: fullText.length,
                    responsePreview: buildLogTextPreview(fullText),
                    durationMs: Date.now() - requestStartedAt
                });
            } catch (err) {
                logCopilotEvent(requestId, 'stream_error', {
                    normalizedProjectId,
                    error: serializeErrorForLog(err),
                    durationMs: Date.now() - requestStartedAt
                }, 'error');
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
        logCopilotEvent(requestId, 'fatal_error', {
            error: serializeErrorForLog(error),
            durationMs: Date.now() - requestStartedAt
        }, 'error');
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
        const organizationId = searchParams.get('organizationId');
        const projectId = searchParams.get('projectId');
        if (!conversationId) {
            return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
        }
        const conversation = await prisma.copilotConversation.findFirst({
            where: {
                id: conversationId,
                userId: session.user.id,
                ...(organizationId ? { organizationId } : {}),
                ...(projectId !== null ? { projectId: projectId || null } : {})
            },
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
