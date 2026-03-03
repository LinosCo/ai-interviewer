import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import Sitemapper from 'sitemapper';
import { scrapeUrl } from '@/lib/scraping';
import { assertOrganizationAccess, assertProjectAccess } from '@/lib/domain/workspace';
import { CMSSuggestionGenerator } from '@/lib/cms/suggestion-generator';
import { TipRoutingExecutor } from '@/lib/cms/tip-routing-executor';
import { N8NDispatcher } from '@/lib/integrations/n8n/dispatcher';
import { buildInsightActionMetadata } from '@/lib/insights/action-metadata';

type ToolContext = {
    userId: string;
    organizationId: string;
    projectId?: string | null;
};

const scopedInputSchema = z.object({
    projectId: z.string().optional().describe('Optional project ID. If omitted, uses the currently selected project or all accessible projects.'),
    limit: z.number().optional().default(5).describe('Maximum number of records to return (hard-capped to 10).')
});

async function resolveAccessibleProjectIds(context: ToolContext, requestedProjectId?: string | null): Promise<string[]> {
    const effectiveProjectId = requestedProjectId || context.projectId || null;

    if (effectiveProjectId) {
        try {
            const access = await assertProjectAccess(context.userId, effectiveProjectId, 'VIEWER');
            return access.organizationId === context.organizationId ? [effectiveProjectId] : [];
        } catch {
            return [];
        }
    }

    await assertOrganizationAccess(context.userId, context.organizationId, 'VIEWER');

    const projects = await prisma.project.findMany({
        where: {
            organizationId: context.organizationId
        },
        select: { id: true }
    });

    return projects.map((project) => project.id);
}

function clampLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) return 5;
    return Math.min(Math.max(1, Math.floor(limit)), 10);
}

export function createProjectTranscriptsTool(context: ToolContext) {
    return {
        description: 'Fetch completed interview transcripts, key quotes and sentiment for the selected or accessible projects.',
        inputSchema: scopedInputSchema,
        execute: async ({ projectId, limit }: { projectId?: string; limit?: number }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                const conversations = await prisma.conversation.findMany({
                    where: {
                        bot: {
                            projectId: { in: projectIds },
                            botType: 'interview'
                        },
                        status: 'COMPLETED'
                    },
                    orderBy: { completedAt: 'desc' },
                    take: clampLimit(limit),
                    select: {
                        id: true,
                        completedAt: true,
                        sentimentScore: true,
                        candidateProfile: true,
                        bot: { select: { id: true, name: true, projectId: true, project: { select: { name: true } } } },
                        analysis: {
                            select: {
                                topicCoverage: true,
                                keyQuotes: true
                            }
                        },
                        messages: {
                            where: { role: { not: 'system' } },
                            orderBy: { createdAt: 'asc' },
                            take: 30,
                            select: { role: true, content: true }
                        }
                    }
                });

                if (conversations.length === 0) {
                    return { message: 'No completed interviews found for these projects.' };
                }

                return {
                    scope: { projectIds },
                    interviews: conversations.map((c: any) => ({
                        id: c.id,
                        projectId: c.bot?.projectId,
                        projectName: c.bot?.project?.name || null,
                        botId: c.bot?.id,
                        botName: c.bot?.name || null,
                        candidateName: (c.candidateProfile as any)?.name || 'Anonimo',
                        date: c.completedAt,
                        sentiment: c.sentimentScore,
                        topicCoverage: c.analysis?.topicCoverage,
                        keyQuotes: c.analysis?.keyQuotes,
                        transcriptPreview: c.messages.map((m: any) => `${m.role}: ${m.content}`).join('\n').slice(0, 2000)
                    }))
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching transcripts:', error);
                return { error: 'Failed to fetch interview data', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createChatbotConversationsTool(context: ToolContext) {
    return {
        description: 'Fetch recent chatbot conversations and sentiment for the selected or accessible projects.',
        inputSchema: scopedInputSchema,
        execute: async ({ projectId, limit }: { projectId?: string; limit?: number }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                const conversations = await prisma.conversation.findMany({
                    where: {
                        bot: {
                            projectId: { in: projectIds },
                            botType: 'chatbot'
                        }
                    },
                    orderBy: { startedAt: 'desc' },
                    take: clampLimit(limit),
                    select: {
                        id: true,
                        startedAt: true,
                        sentimentScore: true,
                        bot: { select: { id: true, name: true, projectId: true, project: { select: { name: true } } } },
                        messages: {
                            orderBy: { createdAt: 'asc' },
                            take: 20,
                            select: { role: true, content: true }
                        }
                    }
                });

                if (conversations.length === 0) {
                    return { message: 'No chatbot conversations found for these projects.' };
                }

                return {
                    scope: { projectIds },
                    conversations: conversations.map((c: any) => ({
                        id: c.id,
                        date: c.startedAt,
                        sentiment: c.sentimentScore,
                        botId: c.bot?.id,
                        botName: c.bot?.name || null,
                        projectId: c.bot?.projectId,
                        projectName: c.bot?.project?.name || null,
                        messages: c.messages
                    }))
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching chatbot conversations:', error);
                return { error: 'Failed to fetch chatbot conversations', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createProjectIntegrationsTool(context: ToolContext) {
    return {
        description: 'Fetch integrations and connection health (CMS/MCP/Google) for selected or accessible projects.',
        inputSchema: scopedInputSchema,
        execute: async ({ projectId, limit }: { projectId?: string; limit?: number }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                const limitedProjectIds = projectIds.slice(0, clampLimit(limit));

                const [projects, mcpConnections, googleConnections, cmsConnections] = await Promise.all([
                    prisma.project.findMany({
                        where: { id: { in: limitedProjectIds } },
                        select: { id: true, name: true }
                    }),
                    prisma.mCPConnection.findMany({
                        where: {
                            OR: [
                                { projectId: { in: limitedProjectIds } },
                                { projectShares: { some: { projectId: { in: limitedProjectIds } } } }
                            ]
                        },
                        select: {
                            id: true,
                            projectId: true,
                            type: true,
                            name: true,
                            status: true,
                            lastSyncAt: true,
                            lastError: true
                        }
                    }),
                    prisma.googleConnection.findMany({
                        where: { projectId: { in: limitedProjectIds } },
                        select: {
                            projectId: true,
                            ga4Enabled: true,
                            ga4Status: true,
                            ga4PropertyId: true,
                            ga4LastSyncAt: true,
                            ga4LastError: true,
                            gscEnabled: true,
                            gscStatus: true,
                            gscSiteUrl: true,
                            gscLastSyncAt: true,
                            gscLastError: true
                        }
                    }),
                    prisma.cMSConnection.findMany({
                        where: {
                            OR: [
                                { projectId: { in: limitedProjectIds } },
                                { projectShares: { some: { projectId: { in: limitedProjectIds } } } }
                            ]
                        },
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            projectId: true,
                            googleAnalyticsConnected: true,
                            searchConsoleConnected: true,
                            lastSyncAt: true,
                            lastSyncError: true
                        }
                    })
                ]);

                const projectMap = new Map(projects.map((p) => [p.id, p.name]));

                return {
                    scope: { projectIds: limitedProjectIds },
                    projects: limitedProjectIds.map((pid) => ({
                        projectId: pid,
                        projectName: projectMap.get(pid) || pid,
                        mcpConnections: mcpConnections.filter((c) => c.projectId === pid),
                        googleConnection: googleConnections.find((c) => c.projectId === pid) || null,
                        cmsConnections: cmsConnections.filter((c) => c.projectId === pid)
                    }))
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching integrations:', error);
                return { error: 'Failed to fetch integrations', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createVisibilityInsightsTool(context: ToolContext) {
    return {
        description: 'Fetch latest visibility/brand monitor data, website analysis and AI tips state for selected or accessible projects.',
        inputSchema: scopedInputSchema,
        execute: async ({ projectId, limit }: { projectId?: string; limit?: number }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                const limitedProjectIds = projectIds.slice(0, clampLimit(limit));

                let configs: any[] = [];
                try {
                    configs = await prisma.visibilityConfig.findMany({
                        where: {
                            organizationId: context.organizationId,
                            OR: [
                                { projectId: { in: limitedProjectIds } },
                                { projectShares: { some: { projectId: { in: limitedProjectIds } } } }
                            ]
                        },
                        select: {
                            id: true,
                            brandName: true,
                            projectId: true,
                            isActive: true,
                            updatedAt: true,
                            scans: {
                                orderBy: { startedAt: 'desc' },
                                take: 1,
                                select: { id: true, status: true, startedAt: true, completedAt: true, score: true }
                            },
                            websiteAnalyses: {
                                orderBy: { startedAt: 'desc' },
                                take: 1,
                                select: { id: true, overallScore: true, completedAt: true, recommendations: true }
                            },
                            tipActions: {
                                orderBy: { updatedAt: 'desc' },
                                take: 20,
                                select: { tipTitle: true, tipType: true, status: true, updatedAt: true }
                            }
                        }
                    });
                } catch (err: any) {
                    if (err?.code !== 'P2021') throw err;
                    configs = await prisma.visibilityConfig.findMany({
                        where: {
                            organizationId: context.organizationId,
                            projectId: { in: limitedProjectIds }
                        },
                        select: {
                            id: true,
                            brandName: true,
                            projectId: true,
                            isActive: true,
                            updatedAt: true,
                            scans: {
                                orderBy: { startedAt: 'desc' },
                                take: 1,
                                select: { id: true, status: true, startedAt: true, completedAt: true, score: true }
                            },
                            websiteAnalyses: {
                                orderBy: { startedAt: 'desc' },
                                take: 1,
                                select: { id: true, overallScore: true, completedAt: true, recommendations: true }
                            },
                            tipActions: {
                                orderBy: { updatedAt: 'desc' },
                                take: 20,
                                select: { tipTitle: true, tipType: true, status: true, updatedAt: true }
                            }
                        }
                    });
                }

                return {
                    scope: { projectIds: limitedProjectIds },
                    visibility: configs.map((cfg: any) => ({
                        configId: cfg.id,
                        brandName: cfg.brandName,
                        projectId: cfg.projectId,
                        isActive: cfg.isActive,
                        updatedAt: cfg.updatedAt,
                        latestScan: cfg.scans?.[0] || null,
                        latestWebsiteAnalysis: cfg.websiteAnalyses?.[0]
                            ? {
                                ...cfg.websiteAnalyses[0],
                                recommendationCount: Array.isArray(cfg.websiteAnalyses[0].recommendations)
                                    ? cfg.websiteAnalyses[0].recommendations.length
                                    : 0
                            }
                            : null,
                        tipActionsSummary: {
                            active: cfg.tipActions.filter((t: any) => t.status === 'active').length,
                            completed: cfg.tipActions.filter((t: any) => t.status === 'completed').length,
                            dismissed: cfg.tipActions.filter((t: any) => t.status === 'dismissed').length
                        },
                        latestTipActions: cfg.tipActions.slice(0, 8)
                    }))
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching visibility insights:', error);
                return { error: 'Failed to fetch visibility insights', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createExternalAnalyticsTool(context: ToolContext) {
    return {
        description: 'Fetch external analytics snapshots from Google Analytics (GA4) and Search Console (GSC) for selected or accessible projects.',
        inputSchema: scopedInputSchema,
        execute: async ({ projectId, limit }: { projectId?: string; limit?: number }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                const limitedProjectIds = projectIds.slice(0, clampLimit(limit));
                const connections = await prisma.googleConnection.findMany({
                    where: { projectId: { in: limitedProjectIds } },
                    select: {
                        id: true,
                        projectId: true,
                        ga4Enabled: true,
                        ga4Status: true,
                        ga4PropertyId: true,
                        gscEnabled: true,
                        gscStatus: true,
                        gscSiteUrl: true,
                        analytics: {
                            orderBy: { date: 'desc' },
                            take: 1,
                            select: {
                                date: true,
                                pageviews: true,
                                sessions: true,
                                users: true,
                                bounceRate: true,
                                searchImpressions: true,
                                searchClicks: true,
                                avgPosition: true,
                                topSearchQueries: true
                            }
                        },
                        project: { select: { name: true } }
                    }
                });

                return {
                    scope: { projectIds: limitedProjectIds },
                    externalAnalytics: connections.map((conn: any) => ({
                        projectId: conn.projectId,
                        projectName: conn.project?.name || null,
                        ga4: {
                            enabled: conn.ga4Enabled,
                            status: conn.ga4Status,
                            propertyId: conn.ga4PropertyId || null
                        },
                        gsc: {
                            enabled: conn.gscEnabled,
                            status: conn.gscStatus,
                            siteUrl: conn.gscSiteUrl || null
                        },
                        latestSnapshot: conn.analytics?.[0] || null
                    }))
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching external analytics:', error);
                return { error: 'Failed to fetch external analytics', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createKnowledgeBaseTool(context: ToolContext) {
    return {
        description: 'Fetch chatbot knowledge base corpus and scraping scope (URL/sitemap) from chatbot sources and Brand Monitor settings.',
        inputSchema: scopedInputSchema,
        execute: async ({ projectId, limit }: { projectId?: string; limit?: number }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                const limitedProjectIds = projectIds.slice(0, clampLimit(limit));
                const bots = await prisma.bot.findMany({
                    where: {
                        projectId: { in: limitedProjectIds }
                    },
                    select: {
                        id: true,
                        name: true,
                        botType: true,
                        projectId: true,
                        project: { select: { name: true } },
                        knowledgeSources: {
                            orderBy: { createdAt: 'desc' },
                            take: 100,
                            select: { id: true, type: true, title: true, content: true, createdAt: true }
                        }
                    }
                });

                const visibilityConfigs = await prisma.visibilityConfig.findMany({
                    where: {
                        organizationId: context.organizationId,
                        projectId: { in: limitedProjectIds }
                    },
                    select: {
                        id: true,
                        projectId: true,
                        brandName: true,
                        websiteUrl: true,
                        additionalUrls: true
                    }
                });

                const urlRegex = /https?:\/\/[^\s)\]"']+/gi;
                const parseAdditionalUrls = (value: unknown): Array<{ url: string; label?: string }> => {
                    if (!Array.isArray(value)) return [];
                    return value
                        .map((entry: any) => ({
                            url: typeof entry?.url === 'string' ? entry.url : '',
                            label: typeof entry?.label === 'string' ? entry.label : undefined
                        }))
                        .filter((entry) => entry.url);
                };

                const kbByProject = limitedProjectIds.map((pid) => {
                    const projectBots = bots.filter((b) => b.projectId === pid);
                    const projectConfigs = visibilityConfigs.filter((c) => c.projectId === pid);

                    const botKnowledge = projectBots.map((bot: any) => {
                        const extractedUrls = new Set<string>();
                        for (const source of bot.knowledgeSources || []) {
                            const titleMatches = String(source.title || '').match(urlRegex) || [];
                            const contentMatches = String(source.content || '').match(urlRegex) || [];
                            for (const match of [...titleMatches, ...contentMatches]) {
                                extractedUrls.add(match);
                            }
                        }

                        const sitemapUrls = Array.from(extractedUrls).filter((u) => u.toLowerCase().includes('sitemap') && u.toLowerCase().endsWith('.xml'));

                        return {
                            botId: bot.id,
                            botName: bot.name,
                            botType: bot.botType,
                            knowledgeCount: bot.knowledgeSources.length,
                            knowledgeSources: bot.knowledgeSources.map((s: any) => ({
                                id: s.id,
                                type: s.type,
                                title: s.title,
                                createdAt: s.createdAt,
                                snippet: String(s.content || '').slice(0, 700)
                            })),
                            sourceUrls: Array.from(extractedUrls).slice(0, 50),
                            sitemapUrls
                        };
                    });

                    const visibilityWebScope = projectConfigs.map((cfg: any) => ({
                        configId: cfg.id,
                        brandName: cfg.brandName,
                        websiteUrl: cfg.websiteUrl,
                        additionalUrls: parseAdditionalUrls(cfg.additionalUrls)
                    }));

                    const projectName = projectBots[0]?.project?.name || null;
                    return {
                        projectId: pid,
                        projectName,
                        bots: botKnowledge,
                        visibilityWebScope
                    };
                });

                return {
                    scope: { projectIds: limitedProjectIds },
                    knowledgeBase: kbByProject
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching knowledge base:', error);
                return { error: 'Failed to fetch knowledge base', details: error.message || 'Unknown error' };
            }
        }
    };
}

function getMainLanguageUrls(urls: string[]): string[] {
    const buckets: Record<string, string[]> = { root: [] };

    for (const url of urls) {
        try {
            const pathname = new URL(url).pathname;
            const match = pathname.match(/^\/([a-zA-Z]{2,3}(?:-[a-zA-Z]{2,4})?)(\/|$)/);
            if (match) {
                const lang = match[1].toLowerCase();
                if (!buckets[lang]) buckets[lang] = [];
                buckets[lang].push(url);
            } else {
                buckets.root.push(url);
            }
        } catch {
            buckets.root.push(url);
        }
    }

    let bestLang = 'root';
    let maxCount = buckets.root.length;
    for (const [lang, list] of Object.entries(buckets)) {
        if (lang !== 'root' && list.length > maxCount) {
            bestLang = lang;
            maxCount = list.length;
        }
    }

    return buckets[bestLang] || [];
}

export function createScrapeWebSourceTool(context: ToolContext) {
    return {
        description: 'Scrape a webpage or sitemap URL sent in chat using HTML/shortcode cleaning filters. Optionally save results into chatbot knowledge base.',
        inputSchema: z.object({
            url: z.string().url().describe('URL to scrape. Can be a page URL or a sitemap.xml URL.'),
            projectId: z.string().optional().describe('Optional project ID scope override.'),
            mode: z.enum(['auto', 'single', 'sitemap']).optional().default('auto').describe('Scrape mode: auto detects sitemap URLs.'),
            maxPages: z.number().int().min(1).max(25).optional().default(8).describe('Max pages when scraping a sitemap.'),
            saveToKnowledgeBase: z.boolean().optional().default(false).describe('If true, save scraped content as KnowledgeSource entries.'),
            botId: z.string().optional().describe('Target bot ID for KB save. If omitted and save is enabled, the latest accessible chatbot is used.')
        }),
        execute: async ({
            url,
            projectId,
            mode,
            maxPages,
            saveToKnowledgeBase,
            botId
        }: {
            url: string;
            projectId?: string;
            mode?: 'auto' | 'single' | 'sitemap';
            maxPages?: number;
            saveToKnowledgeBase?: boolean;
            botId?: string;
        }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                let targetBotId: string | null = null;
                if (saveToKnowledgeBase) {
                    if (botId) {
                        const bot = await prisma.bot.findFirst({
                            where: { id: botId, projectId: { in: projectIds } },
                            select: { id: true }
                        });
                        if (!bot) return { error: 'Target bot not found or not accessible.' };
                        targetBotId = bot.id;
                    } else {
                        const fallbackBot = await prisma.bot.findFirst({
                            where: { projectId: { in: projectIds }, botType: 'chatbot' },
                            orderBy: { updatedAt: 'desc' },
                            select: { id: true }
                        });
                        if (!fallbackBot) {
                            return { error: 'No accessible chatbot found to save scraped content.' };
                        }
                        targetBotId = fallbackBot.id;
                    }
                }

                const detectSitemap = url.toLowerCase().includes('sitemap') && url.toLowerCase().endsWith('.xml');
                const effectiveMode = mode === 'auto' ? (detectSitemap ? 'sitemap' : 'single') : mode;

                if (effectiveMode === 'single') {
                    const scraped = await scrapeUrl(url);
                    let savedSourceId: string | null = null;

                    if (saveToKnowledgeBase && targetBotId) {
                        const saved = await prisma.knowledgeSource.create({
                            data: {
                                botId: targetBotId,
                                type: 'url',
                                title: scraped.title,
                                content: `URL: ${scraped.url}\n\nTitle: ${scraped.title}\n\n${scraped.content}`
                            },
                            select: { id: true }
                        });
                        savedSourceId = saved.id;
                    }

                    return {
                        mode: effectiveMode,
                        cleaned: true,
                        source: {
                            url: scraped.url,
                            title: scraped.title,
                            description: scraped.description || null,
                            content: scraped.content.slice(0, 6000)
                        },
                        savedToKnowledgeBase: Boolean(savedSourceId),
                        knowledgeSourceId: savedSourceId
                    };
                }

                const sitemap = new Sitemapper();
                const { sites } = await sitemap.fetch(url);
                if (!sites || sites.length === 0) {
                    return { error: 'No URLs found in sitemap.' };
                }

                const filteredSites = getMainLanguageUrls(sites);
                const limited = filteredSites.slice(0, maxPages || 8);
                const results: Array<{ url: string; title?: string; error?: string; knowledgeSourceId?: string | null }> = [];

                for (const siteUrl of limited) {
                    try {
                        const scraped = await scrapeUrl(siteUrl);
                        let savedSourceId: string | null = null;

                        if (saveToKnowledgeBase && targetBotId) {
                            const saved = await prisma.knowledgeSource.create({
                                data: {
                                    botId: targetBotId,
                                    type: 'url',
                                    title: scraped.title,
                                    content: `URL: ${scraped.url}\n\nTitle: ${scraped.title}\n\n${scraped.content}`
                                },
                                select: { id: true }
                            });
                            savedSourceId = saved.id;
                        }

                        results.push({
                            url: scraped.url,
                            title: scraped.title,
                            knowledgeSourceId: savedSourceId
                        });
                    } catch (err: any) {
                        results.push({
                            url: siteUrl,
                            error: err?.message || 'Scrape failed'
                        });
                    }
                }

                return {
                    mode: effectiveMode,
                    cleaned: true,
                    sitemap: {
                        inputUrl: url,
                        totalFound: sites.length,
                        totalConsidered: limited.length,
                        scrapedOk: results.filter((r) => !r.error).length,
                        scrapedFailed: results.filter((r) => Boolean(r.error)).length
                    },
                    results
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error scraping web source:', error);
                return { error: 'Failed to scrape URL', details: error.message || 'Unknown error' };
            }
        }
    };
}

const strategicTipActionSchema = z.object({
    type: z.enum([
        'add_faq',
        'add_interview_topic',
        'add_visibility_prompt',
        'create_content',
        'modify_content',
        'respond_to_press',
        'monitor_competitor',
        'strategic_recommendation',
        'pricing_change',
        'product_improvement',
        'marketing_campaign'
    ]),
    target: z.enum([
        'chatbot',
        'interview',
        'visibility',
        'website',
        'pr',
        'serp',
        'strategy',
        'product',
        'marketing'
    ]),
    title: z.string().min(3).max(160),
    body: z.string().min(10).max(5000),
    reasoning: z.string().min(6).max(2000),
    strategicAlignment: z.string().min(6).max(1200).optional(),
    coordination: z.string().min(6).max(1200).optional(),
    evidence: z.array(z.object({
        sourceType: z.enum(['interview', 'chatbot', 'visibility', 'serp', 'analytics', 'kb', 'strategy', 'site_analysis']),
        sourceRef: z.string().min(2).max(120),
        detail: z.string().min(6).max(500)
    })).max(4).optional()
});

export function createStrategicTipCreationTool(context: ToolContext) {
    return {
        description: 'Create a new AI Tip in Insights and optionally generate implementable CMS content drafts with routing automation.',
        inputSchema: z.object({
            projectId: z.string().optional().describe('Project ID. If omitted, uses selected project in Copilot context.'),
            topicName: z.string().min(5).max(180).describe('Strategic AI tip title shown in Insights.'),
            reasoning: z.string().min(10).max(4000).describe('Strategic rationale and evidence behind the tip.'),
            priorityScore: z.number().min(0).max(100).optional().default(70),
            actions: z.array(strategicTipActionSchema).min(1).max(6),
            autoCreateContentDrafts: z.boolean().optional().default(true).describe('Generate CMS suggestions from content-related actions.'),
            autoDispatchRouting: z.boolean().optional().default(false).describe('If true, run n8n dispatch and tip routing rules after draft generation.')
        }),
        execute: async ({
            projectId,
            topicName,
            reasoning,
            priorityScore,
            actions,
            autoCreateContentDrafts,
            autoDispatchRouting
        }: {
            projectId?: string;
            topicName: string;
            reasoning: string;
            priorityScore?: number;
            actions: Array<{
                type: string;
                target: string;
                title: string;
                body: string;
                reasoning: string;
                strategicAlignment?: string;
                coordination?: string;
                evidence?: Array<{
                    sourceType: string;
                    sourceRef: string;
                    detail: string;
                }>;
            }>;
            autoCreateContentDrafts?: boolean;
            autoDispatchRouting?: boolean;
        }) => {
            try {
                const scopedProjectIds = await resolveAccessibleProjectIds(context, projectId);
                const targetProjectId = (projectId || context.projectId || scopedProjectIds[0] || null) as string | null;
                if (!targetProjectId) {
                    return { error: 'No accessible project selected. Pass a valid projectId.' };
                }
                if (!scopedProjectIds.includes(targetProjectId)) {
                    return { error: 'Project is not accessible for current user/context.' };
                }

                const enrichedActions = actions.map((action) => ({
                    ...action,
                    reasoning: action.reasoning || reasoning,
                    strategicAlignment: action.strategicAlignment || reasoning,
                    coordination: action.coordination || 'Coordinare questa azione con gli altri canali del piano editoriale.',
                    evidence: Array.isArray(action.evidence) && action.evidence.length > 0
                        ? action.evidence
                        : [{
                            sourceType: 'strategy',
                            sourceRef: 'copilot:user_request',
                            detail: 'Tip creato da richiesta esplicita del team su base strategica del progetto.'
                        }],
                    workflowStatus: 'draft',
                    ...buildInsightActionMetadata(action)
                }));

                const insight = await prisma.crossChannelInsight.create({
                    data: {
                        organizationId: context.organizationId,
                        projectId: targetProjectId,
                        topicName,
                        crossChannelScore: 85,
                        priorityScore: Number(priorityScore ?? 70),
                        status: 'new',
                        interviewData: [],
                        chatbotData: [],
                        visibilityData: {
                            source: 'copilot_strategic',
                            createdBy: context.userId,
                            createdAt: new Date().toISOString(),
                            globalReasoning: reasoning
                        } as any,
                        suggestedActions: enrichedActions as any
                    }
                });

                let suggestionIds: string[] = [];
                if (autoCreateContentDrafts) {
                    suggestionIds = await CMSSuggestionGenerator.generateFromInsight(insight.id);
                }

                const routing = { dispatchedToN8N: false, routedRules: 0, routingFailures: 0 };
                if (autoDispatchRouting && suggestionIds.length > 0) {
                    const suggestions = await prisma.cMSSuggestion.findMany({
                        where: { id: { in: suggestionIds } },
                        select: {
                            id: true,
                            title: true,
                            body: true,
                            type: true,
                            targetSection: true,
                            metaDescription: true,
                            cmsPreviewUrl: true,
                        },
                    });
                    const tipsPayload = suggestions.map((s) => ({
                        id: s.id,
                        title: s.title,
                        content: s.body,
                        contentKind: String(s.type),
                        targetChannel: s.targetSection ?? undefined,
                        metaDescription: s.metaDescription ?? undefined,
                        url: s.cmsPreviewUrl ?? undefined,
                    }));

                    try {
                        await N8NDispatcher.dispatchTips(targetProjectId, tipsPayload);
                        routing.dispatchedToN8N = true;
                    } catch (err) {
                        console.warn('[Copilot Tool] dispatchTips failed:', err);
                    }

                    try {
                        const results = await TipRoutingExecutor.execute(targetProjectId, tipsPayload);
                        routing.routedRules = results.length;
                        routing.routingFailures = results.filter((r) => !r.success).length;
                    } catch (err) {
                        console.warn('[Copilot Tool] TipRoutingExecutor failed:', err);
                    }
                }

                return {
                    success: true,
                    insight: {
                        id: insight.id,
                        projectId: insight.projectId,
                        topicName: insight.topicName,
                        priorityScore: insight.priorityScore,
                        actionsCount: enrichedActions.length
                    },
                    automations: {
                        contentDraftsCreated: suggestionIds.length,
                        suggestionIds,
                        ...routing
                    }
                };
            } catch (error: any) {
                console.error('[Copilot Tool] createStrategicTip error:', error);
                return { error: 'Failed to create AI tip from Copilot', details: error?.message || 'Unknown error' };
            }
        }
    };
}
