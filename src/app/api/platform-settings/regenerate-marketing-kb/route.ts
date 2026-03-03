import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { checkCreditsForAction } from '@/lib/guards/resourceGuard';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { sanitizeConfig } from '@/lib/llm/prompt-sanitizer';
import {
    getDefaultStrategicMarketingKnowledge,
    getStrategicMarketingKnowledgeByOrg,
    setStrategicMarketingKnowledgeByOrg
} from '@/lib/marketing/strategic-kb';

function safeJson(value: unknown, maxLen = 5000): string {
    try {
        return JSON.stringify(value).slice(0, maxLen);
    } catch {
        return '';
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const organizationId = typeof body?.organizationId === 'string' ? body.organizationId : '';
        if (!organizationId) {
            return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
        }

        const [user, membership] = await Promise.all([
            prisma.user.findUnique({
                where: { id: session.user.id },
                select: { id: true, role: true }
            }),
            prisma.membership.findUnique({
                where: {
                    userId_organizationId: {
                        userId: session.user.id,
                        organizationId
                    }
                },
                select: { status: true }
            })
        ]);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isAdmin = user.role === 'ADMIN';
        if (!isAdmin && membership?.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const creditsCheck = await checkCreditsForAction(
            'copilot_analysis',
            undefined,
            undefined,
            organizationId
        );
        if (!creditsCheck.allowed) {
            return NextResponse.json({
                code: (creditsCheck as any).code || 'ACCESS_DENIED',
                error: creditsCheck.error,
                creditsNeeded: creditsCheck.creditsNeeded,
                creditsAvailable: creditsCheck.creditsAvailable
            }, { status: creditsCheck.status || 403 });
        }
        const chargedOrganizationId = (creditsCheck as { organizationId?: string | null }).organizationId || organizationId;

        const [organization, platformSettings, previousMarketingKb, projects, insights, visibilityConfigs, knowledgeGaps, analyticsConnections, globalConfig] = await Promise.all([
            prisma.organization.findUnique({
                where: { id: organizationId },
                select: { id: true, name: true, plan: true }
            }),
            prisma.platformSettings.findUnique({
                where: { organizationId },
                select: { strategicPlan: true }
            }),
            getStrategicMarketingKnowledgeByOrg(organizationId),
            prisma.project.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    name: true,
                    strategicVision: true,
                    valueProposition: true,
                    updatedAt: true
                },
                orderBy: { updatedAt: 'desc' },
                take: 12
            }),
            prisma.crossChannelInsight.findMany({
                where: { organizationId },
                select: {
                    topicName: true,
                    status: true,
                    priorityScore: true,
                    crossChannelScore: true,
                    updatedAt: true,
                    project: { select: { name: true } }
                },
                orderBy: [{ priorityScore: 'desc' }, { updatedAt: 'desc' }],
                take: 15
            }),
            prisma.visibilityConfig.findMany({
                where: { organizationId },
                select: {
                    id: true,
                    brandName: true,
                    websiteUrl: true,
                    updatedAt: true,
                    project: { select: { name: true } },
                    websiteAnalyses: {
                        orderBy: { startedAt: 'desc' },
                        take: 1,
                        select: {
                            overallScore: true,
                            structuredDataScore: true,
                            keywordCoverageScore: true,
                            contentClarityScore: true,
                            pagesScraped: true,
                            recommendations: true,
                            completedAt: true
                        }
                    },
                    tipActions: {
                        where: { status: 'active' },
                        take: 10,
                        orderBy: { updatedAt: 'desc' },
                        select: {
                            tipTitle: true,
                            tipType: true,
                            updatedAt: true
                        }
                    }
                },
                take: 8
            }),
            prisma.knowledgeGap.findMany({
                where: {
                    bot: {
                        project: { organizationId }
                    },
                    status: {
                        notIn: ['resolved', 'completed', 'dismissed']
                    }
                },
                select: {
                    topic: true,
                    priority: true,
                    status: true,
                    createdAt: true,
                    bot: {
                        select: {
                            name: true,
                            project: { select: { name: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 12
            }),
            prisma.googleConnection.findMany({
                where: {
                    project: { organizationId }
                },
                select: {
                    ga4Enabled: true,
                    gscEnabled: true,
                    project: { select: { name: true } },
                    analytics: {
                        orderBy: { date: 'desc' },
                        take: 1,
                        select: {
                            date: true,
                            users: true,
                            sessions: true,
                            pageviews: true,
                            searchImpressions: true,
                            searchClicks: true,
                            avgPosition: true,
                            topSearchQueries: true
                        }
                    }
                },
                take: 8
            }),
            prisma.globalConfig.findUnique({
                where: { id: 'default' },
                select: {
                    openaiApiKey: true,
                    anthropicApiKey: true
                }
            })
        ]);

        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const signalsSummary = {
            organization: {
                id: organization.id,
                name: organization.name,
                plan: organization.plan
            },
            projects: projects.map((p) => ({
                name: p.name,
                strategicVision: p.strategicVision || null,
                valueProposition: p.valueProposition || null,
                updatedAt: p.updatedAt
            })),
            crossChannelInsights: insights.map((i) => ({
                projectName: i.project?.name || null,
                topicName: i.topicName,
                status: i.status,
                priorityScore: i.priorityScore,
                crossChannelScore: i.crossChannelScore,
                updatedAt: i.updatedAt
            })),
            visibility: visibilityConfigs.map((cfg) => ({
                brandName: cfg.brandName,
                projectName: cfg.project?.name || null,
                websiteUrl: cfg.websiteUrl || null,
                latestAnalysis: cfg.websiteAnalyses[0] || null,
                activeTipActions: cfg.tipActions
            })),
            chatbotKnowledgeGaps: knowledgeGaps.map((gap) => ({
                topic: gap.topic,
                priority: gap.priority,
                status: gap.status,
                projectName: gap.bot?.project?.name || null,
                botName: gap.bot?.name || null
            })),
            analytics: analyticsConnections.map((conn) => ({
                projectName: conn.project?.name || null,
                ga4Enabled: conn.ga4Enabled,
                gscEnabled: conn.gscEnabled,
                latest: conn.analytics[0] || null
            }))
        };

        const strategicPlan = sanitizeConfig(platformSettings?.strategicPlan || '', 4000);
        const oldKb = sanitizeConfig(previousMarketingKb.knowledge || '', 5000);
        const baseKb = sanitizeConfig(getDefaultStrategicMarketingKnowledge(), 5000);
        const dataContext = sanitizeConfig(safeJson(signalsSummary, 12000), 12000);

        const openaiApiKey = globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY || '';
        const anthropicApiKey = globalConfig?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '';

        if (!openaiApiKey && !anthropicApiKey) {
            return NextResponse.json({
                error: 'API key not configured',
                message: 'Nessuna chiave API LLM configurata (OpenAI/Anthropic).'
            }, { status: 500 });
        }

        const systemPrompt = `Sei un Head of Strategic Marketing B2B/B2C digitale.
Genera una knowledge base operativa in italiano per un Copilot marketing.

Vincoli:
- Focus: marketing strategico, SEO, GEO/LLMO, digital trends, business development.
- Non includere didattica formativa/interviste come metodologia di insegnamento.
- Ogni sezione deve essere orientata all'azione e al decision-making.
- Mantieni struttura markdown chiara con titoli e bullet concreti.
- Inserisci una sezione finale "Regole operative del Copilot" con:
  1) citazione fonti,
  2) domande chiarificatrici,
  3) priorita 20/80,
  4) piano azione multicanale.`;

        const prompt = `Rigenera la KB Marketing Strategico per l'organizzazione.

PIANO STRATEGICO (se presente):
${strategicPlan || 'Non disponibile'}

KB BASE (template):
${baseKb}

KB PRECEDENTE (se presente):
${oldKb || 'Non disponibile'}

SEGNALI DATI REALI (JSON sintetico):
${dataContext}

Output richiesto:
- Documento markdown completo e aggiornato.
- Sezioni minime:
  1. Posizionamento e Value Proposition
  2. Priorita Marketing (prossimi 90 giorni)
  3. SEO (on-page + tecnico)
  4. GEO/LLMO e AI Visibility
  5. Strategia contenuti multi-canale
  6. Business development e opportunita
  7. KPI e governance operativa
  8. Regole operative del Copilot`;

        let modelUsed = 'gpt-4o-mini';
        let result: Awaited<ReturnType<typeof generateText>>;

        try {
            if (openaiApiKey) {
                const openai = createOpenAI({ apiKey: openaiApiKey });
                result = await generateText({
                    model: openai(modelUsed),
                    system: systemPrompt,
                    prompt,
                    temperature: 0.3
                });
            } else {
                modelUsed = 'claude-3-5-sonnet-20241022';
                const anthropic = createAnthropic({ apiKey: anthropicApiKey });
                result = await generateText({
                    model: anthropic(modelUsed),
                    system: systemPrompt,
                    prompt,
                    temperature: 0.3
                });
            }
        } catch (error) {
            if (!anthropicApiKey || !openaiApiKey) throw error;
            modelUsed = 'claude-3-5-sonnet-20241022';
            const anthropic = createAnthropic({ apiKey: anthropicApiKey });
            result = await generateText({
                model: anthropic(modelUsed),
                system: systemPrompt,
                prompt,
                temperature: 0.3
            });
        }

        const knowledge = String(result.text || '').trim();
        if (!knowledge) {
            return NextResponse.json({ error: 'KB generation returned empty output.' }, { status: 502 });
        }

        await setStrategicMarketingKnowledgeByOrg(organizationId, knowledge);

        if (result.usage) {
            try {
                await TokenTrackingService.logTokenUsage({
                    organizationId: chargedOrganizationId,
                    userId: session.user.id,
                    inputTokens: result.usage.inputTokens || 0,
                    outputTokens: result.usage.outputTokens || 0,
                    category: 'COPILOT',
                    model: modelUsed,
                    operation: 'regenerate-marketing-kb',
                    resourceType: 'settings_marketing_kb',
                    resourceId: organizationId,
                    actionOverride: 'copilot_analysis'
                });
            } catch (trackingError) {
                console.error('[Marketing KB] credit tracking failed:', trackingError);
            }
        }

        return NextResponse.json({
            success: true,
            knowledge,
            modelUsed,
            tokens: {
                input: result.usage?.inputTokens || 0,
                output: result.usage?.outputTokens || 0
            },
            sourcesUsed: {
                projects: projects.length,
                insights: insights.length,
                visibilityConfigs: visibilityConfigs.length,
                knowledgeGaps: knowledgeGaps.length,
                analyticsSources: analyticsConnections.length
            }
        });
    } catch (error: any) {
        console.error('[Marketing KB] regenerate error:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to regenerate marketing KB' },
            { status: 500 }
        );
    }
}
