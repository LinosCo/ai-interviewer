import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { scrapeUrl } from '@/lib/scraping';
import { assertOrganizationAccess, assertProjectAccess } from '@/lib/domain/workspace';
import { TipRoutingExecutor } from '@/lib/cms/tip-routing-executor';
import { N8NDispatcher } from '@/lib/integrations/n8n/dispatcher';
import { MCPGatewayService } from '@/lib/integrations/mcp/gateway.service';
import { GoogleService } from '@/lib/integrations/google/google.service';
import { CMSConnectionService } from '@/lib/cms/connection.service';
import { encrypt } from '@/lib/integrations/encryption';
import { normalizeMcpEndpoint } from '@/lib/integrations/mcp/endpoint';
import { checkIntegrationCreationAllowed } from '@/lib/trial-limits';
import { buildInsightActionMetadata } from '@/lib/insights/action-metadata';
import { getKBCategories, searchPlatformKB } from '@/lib/copilot/platform-kb';
import { getDefaultStrategicMarketingKnowledge, getStrategicMarketingKnowledgeByOrg } from '@/lib/marketing/strategic-kb';
import { ProjectTipService } from '@/lib/projects/project-tip.service';
import { parseProvidedSitemap } from '@/lib/visibility/site-crawler-engine';
import { indexKnowledgeSource } from '@/lib/kb/semantic-search';

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

async function resolveSingleProjectId(context: ToolContext, requestedProjectId?: string | null): Promise<string | null> {
    const projectIds = await resolveAccessibleProjectIds(context, requestedProjectId);
    return projectIds[0] || null;
}

function clampLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit)) return 5;
    return Math.min(Math.max(1, Math.floor(limit)), 10);
}

function parseAdditionalUrls(value: unknown): Array<{ url: string; label?: string }> {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry: any) => ({
            url: typeof entry?.url === 'string' ? entry.url : '',
            label: typeof entry?.label === 'string' ? entry.label : undefined
        }))
        .filter((entry) => entry.url);
}

type StrategicTipAction = {
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
    contentKind?: string | null;
};

export function buildStrategicTipRoutingPayload(
    canonicalTipId: string,
    actions: StrategicTipAction[]
): Array<{
    id: string;
    title: string;
    content: string;
    contentKind: string;
    targetChannel: string;
}> {
    return actions
        .filter((action) => typeof action.contentKind === 'string' && action.contentKind.length > 0)
        .map((action) => ({
            id: canonicalTipId,
            title: action.title,
            content: action.body,
            contentKind: action.contentKind as string,
            targetChannel: action.target,
        }));
}

export function createPlatformHelpSearchTool() {
    return {
        description: 'Search the Business Tuner product help knowledge base by keyword and category.',
        inputSchema: z.object({
            query: z.string().min(2).describe('Help search query in Italian or English.'),
            category: z.string().optional().default('all').describe('Optional category filter. Use "all" for global search.'),
            limit: z.number().optional().default(5).describe('Maximum help entries to return (hard-capped to 10).')
        }),
        execute: async ({ query, category, limit }: { query: string; category?: string; limit?: number }) => {
            try {
                const safeLimit = clampLimit(limit);
                const kbCategory = typeof category === 'string' && category.trim().length > 0 ? category.trim() : 'all';
                const allCategories = getKBCategories();
                const effectiveCategory = kbCategory === 'all' || allCategories.includes(kbCategory) ? kbCategory : 'all';
                const results = await searchPlatformKB(query, effectiveCategory);

                return {
                    query,
                    category: effectiveCategory,
                    categories: allCategories,
                    totalMatches: results.length,
                    entries: results.slice(0, safeLimit).map((entry) => ({
                        id: entry.id,
                        title: entry.title,
                        category: entry.category,
                        contentPreview: entry.content.slice(0, 1200)
                    }))
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error searching platform help:', error);
                return { error: 'Failed to search platform help', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createProjectTranscriptsTool(context: ToolContext) {
    return {
        description: 'Fetch completed interview transcripts, key quotes and sentiment for the selected or accessible projects. Supports optional date range filtering.',
        inputSchema: z.object({
            projectId: z.string().optional().describe('Optional project ID. If omitted, uses the currently selected project or all accessible projects.'),
            limit: z.number().optional().default(5).describe('Maximum number of records to return (hard-capped to 10).'),
            dateFrom: z.string().optional().describe('ISO date string (YYYY-MM-DD) to filter interviews completed on or after this date.'),
            dateTo: z.string().optional().describe('ISO date string (YYYY-MM-DD) to filter interviews completed on or before this date.')
        }),
        execute: async ({ projectId, limit, dateFrom, dateTo }: { projectId?: string; limit?: number; dateFrom?: string; dateTo?: string }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                const dateFilter: Record<string, Date> = {};
                if (dateFrom) dateFilter.gte = new Date(dateFrom);
                if (dateTo) {
                    const end = new Date(dateTo);
                    end.setHours(23, 59, 59, 999);
                    dateFilter.lte = end;
                }

                const conversations = await prisma.conversation.findMany({
                    where: {
                        bot: {
                            projectId: { in: projectIds },
                            botType: 'interview'
                        },
                        status: 'COMPLETED',
                        ...(Object.keys(dateFilter).length > 0 ? { completedAt: dateFilter } : {})
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
                    scope: { projectIds, dateFrom: dateFrom || null, dateTo: dateTo || null },
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

export function createManageCanonicalTipsTool(context: ToolContext) {
    return {
        description: 'List, view, update, duplicate or change status of canonical AI tips (ProjectTip). Use this for all tip management operations.',
        inputSchema: z.object({
            operation: z.enum(['list', 'get', 'update', 'duplicate', 'set_status']).default('list')
                .describe('Operation: list (all tips), get (single tip detail), update (edit fields), duplicate (copy tip), set_status (change status).'),
            projectId: z.string().optional().describe('Project ID. If omitted, uses selected/current project.'),
            tipId: z.string().optional().describe('Required for get, update, duplicate, set_status.'),
            // Filters for list operation
            status: z.string().optional().describe('Filter by status for list operation (NEW, REVIEWED, APPROVED, DRAFTED, ROUTED, AUTOMATED).'),
            starred: z.boolean().optional().describe('Filter by starred flag for list operation.'),
            // Fields for update operation
            title: z.string().optional().describe('New title (update only).'),
            summary: z.string().optional().describe('New summary (update only).'),
            priority: z.number().optional().describe('New priority 0-100 (update only).'),
            category: z.string().optional().describe('New category (update only).'),
            contentKind: z.string().optional().describe('New contentKind (update only).'),
            executionClass: z.string().optional().describe('New executionClass (update only).'),
            isStarred: z.boolean().optional().describe('Set starred flag (update only).'),
            reasoning: z.string().optional().describe('Updated reasoning (update only).'),
            strategicAlignment: z.string().optional().describe('Updated strategic alignment (update only).'),
            // For set_status operation
            newStatus: z.string().optional().describe('Target status for set_status (NEW, REVIEWED, APPROVED, DRAFTED, ROUTED, AUTOMATED).')
        }),
        execute: async ({
            operation,
            projectId,
            tipId,
            status,
            starred,
            title,
            summary,
            priority,
            category,
            contentKind,
            executionClass,
            isStarred,
            reasoning,
            strategicAlignment,
            newStatus
        }: {
            operation?: 'list' | 'get' | 'update' | 'duplicate' | 'set_status';
            projectId?: string;
            tipId?: string;
            status?: string;
            starred?: boolean;
            title?: string;
            summary?: string;
            priority?: number;
            category?: string;
            contentKind?: string;
            executionClass?: string;
            isStarred?: boolean;
            reasoning?: string;
            strategicAlignment?: string;
            newStatus?: string;
        }) => {
            try {
                const op = operation || 'list';
                const targetProjectId = await resolveSingleProjectId(context, projectId);
                if (!targetProjectId) {
                    return { error: 'No accessible project found for this request.' };
                }

                if (op === 'list') {
                    const tips = await ProjectTipService.listProjectTips({
                        projectId: targetProjectId,
                        viewerUserId: context.userId,
                        ...(status ? { status: status as any } : {}),
                        ...(starred !== undefined ? { starred } : {}),
                    });
                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        count: tips.length,
                        tips
                    };
                }

                if (!tipId) {
                    return { error: 'tipId is required for this operation.' };
                }

                if (op === 'get') {
                    const tip = await ProjectTipService.getProjectTip({
                        projectId: targetProjectId,
                        tipId,
                        viewerUserId: context.userId,
                    });
                    if (!tip) {
                        return { error: 'Tip not found in this project.' };
                    }
                    return { success: true, operation: op, projectId: targetProjectId, tip };
                }

                if (op === 'duplicate') {
                    const duplicated = await ProjectTipService.duplicateTip({
                        projectId: targetProjectId,
                        tipId,
                        actorUserId: context.userId,
                        createdBy: context.userId,
                    });
                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        originalTipId: tipId,
                        duplicatedTip: { id: duplicated.id, title: duplicated.title, status: duplicated.status }
                    };
                }

                if (op === 'set_status') {
                    if (!newStatus) {
                        return { error: 'newStatus is required for set_status operation.' };
                    }
                    const updated = await ProjectTipService.updateTip({
                        projectId: targetProjectId,
                        tipId,
                        actorUserId: context.userId,
                        status: newStatus as any,
                        lastEditedBy: context.userId,
                    });
                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        tip: { id: updated.id, title: updated.title, status: updated.status }
                    };
                }

                // op === 'update'
                const updateFields: Record<string, unknown> = {};
                if (title !== undefined) updateFields.title = title;
                if (summary !== undefined) updateFields.summary = summary;
                if (priority !== undefined) updateFields.priority = priority;
                if (category !== undefined) updateFields.category = category;
                if (contentKind !== undefined) updateFields.contentKind = contentKind;
                if (executionClass !== undefined) updateFields.executionClass = executionClass;
                if (isStarred !== undefined) updateFields.starred = isStarred;
                if (reasoning !== undefined) updateFields.reasoning = reasoning;
                if (strategicAlignment !== undefined) updateFields.strategicAlignment = strategicAlignment;
                if (status !== undefined) updateFields.status = status as any;

                if (Object.keys(updateFields).length === 0) {
                    return { error: 'No update fields provided for update operation.' };
                }

                const updated = await ProjectTipService.updateTip({
                    projectId: targetProjectId,
                    tipId,
                    actorUserId: context.userId,
                    lastEditedBy: context.userId,
                    ...updateFields,
                } as any);

                return {
                    success: true,
                    operation: op,
                    projectId: targetProjectId,
                    tip: {
                        id: updated.id,
                        title: updated.title,
                        summary: updated.summary,
                        status: updated.status,
                        priority: updated.priority,
                        category: updated.category,
                        contentKind: updated.contentKind,
                        starred: updated.starred,
                    }
                };
            } catch (error: any) {
                console.error('[Copilot Tool] manageCanonicalTips error:', error);
                return { error: 'Failed to manage canonical tips', details: error?.message || 'Unknown error' };
            }
        }
    };
}

const routingDestinationSchema = z.enum(['mcp', 'cms', 'n8n']);

export function createTipRoutingManagerTool(context: ToolContext) {
    return {
        description: 'List, create, update, toggle or delete AI routing rules for a project.',
        inputSchema: z.object({
            operation: z.enum(['list', 'create', 'update', 'toggle', 'delete']).default('list'),
            projectId: z.string().optional().describe('Project ID. If omitted, uses selected/current project.'),
            ruleId: z.string().optional().describe('Required for update/toggle/delete.'),
            contentKind: z.string().optional().describe('Content kind (es. BLOG_ARTICLE, META_DESCRIPTION, SCHEMA_PATCH).'),
            behavior: z.string().optional().default('create_post'),
            label: z.string().optional(),
            mcpTool: z.string().optional(),
            destinationType: routingDestinationSchema.optional(),
            destinationConnectionId: z.string().optional(),
            enabled: z.boolean().optional(),
            priority: z.number().optional()
        }),
        execute: async ({
            operation,
            projectId,
            ruleId,
            contentKind,
            behavior,
            label,
            mcpTool,
            destinationType,
            destinationConnectionId,
            enabled,
            priority
        }: {
            operation?: 'list' | 'create' | 'update' | 'toggle' | 'delete';
            projectId?: string;
            ruleId?: string;
            contentKind?: string;
            behavior?: string;
            label?: string;
            mcpTool?: string;
            destinationType?: 'mcp' | 'cms' | 'n8n';
            destinationConnectionId?: string;
            enabled?: boolean;
            priority?: number;
        }) => {
            try {
                const op = operation || 'list';
                const targetProjectId = await resolveSingleProjectId(context, projectId);
                if (!targetProjectId) {
                    return { error: 'No accessible project found for this request.' };
                }

                if (op === 'list') {
                    await assertProjectAccess(context.userId, targetProjectId, 'VIEWER');
                    const rules = await prisma.tipRoutingRule.findMany({
                        where: { projectId: targetProjectId },
                        include: {
                            mcpConnection: { select: { id: true, name: true, type: true, status: true } },
                            cmsConnection: { select: { id: true, name: true, status: true } },
                            n8nConnection: { select: { id: true, name: true, status: true } }
                        },
                        orderBy: { priority: 'desc' }
                    });
                    return { success: true, projectId: targetProjectId, count: rules.length, rules };
                }

                await assertProjectAccess(context.userId, targetProjectId, 'ADMIN');

                const resolveDestinationData = async () => {
                    if (!destinationType && !destinationConnectionId) {
                        return null;
                    }
                    if (!destinationType || !destinationConnectionId) {
                        throw new Error('destinationType and destinationConnectionId are both required when setting destination.');
                    }

                    if (destinationType === 'mcp') {
                        const conn = await prisma.mCPConnection.findFirst({
                            where: {
                                id: destinationConnectionId,
                                OR: [
                                    { projectId: targetProjectId },
                                    { projectShares: { some: { projectId: targetProjectId } } }
                                ]
                            },
                            select: { id: true }
                        });
                        if (!conn) throw new Error('MCP connection not found for this project.');
                        return {
                            mcpConnectionId: conn.id,
                            cmsConnectionId: null,
                            n8nConnectionId: null
                        };
                    }

                    if (destinationType === 'cms') {
                        const conn = await prisma.cMSConnection.findFirst({
                            where: {
                                id: destinationConnectionId,
                                OR: [
                                    { projectId: targetProjectId },
                                    { projectShares: { some: { projectId: targetProjectId } } }
                                ]
                            },
                            select: { id: true }
                        });
                        if (!conn) throw new Error('CMS connection not found for this project.');
                        return {
                            mcpConnectionId: null,
                            cmsConnectionId: conn.id,
                            n8nConnectionId: null
                        };
                    }

                    const conn = await prisma.n8NConnection.findFirst({
                        where: { id: destinationConnectionId, projectId: targetProjectId },
                        select: { id: true }
                    });
                    if (!conn) throw new Error('n8n connection not found for this project.');
                    return {
                        mcpConnectionId: null,
                        cmsConnectionId: null,
                        n8nConnectionId: conn.id
                    };
                };

                if (op === 'create') {
                    if (!contentKind) return { error: 'contentKind is required for create.' };
                    const destinationData = await resolveDestinationData();
                    if (!destinationData) return { error: 'Destination is required for create.' };

                    const rule = await prisma.tipRoutingRule.create({
                        data: {
                            projectId: targetProjectId,
                            contentKind: String(contentKind),
                            behavior: String(behavior || 'create_post'),
                            mcpTool: mcpTool ? String(mcpTool) : null,
                            label: label ? String(label) : null,
                            priority: typeof priority === 'number' ? Number(priority) : 0,
                            enabled: enabled !== false,
                            ...destinationData
                        },
                        include: {
                            mcpConnection: { select: { id: true, name: true, type: true, status: true } },
                            cmsConnection: { select: { id: true, name: true, status: true } },
                            n8nConnection: { select: { id: true, name: true, status: true } }
                        }
                    });
                    return { success: true, operation: op, projectId: targetProjectId, rule };
                }

                if (!ruleId) return { error: 'ruleId is required for this operation.' };

                const existing = await prisma.tipRoutingRule.findFirst({
                    where: { id: ruleId, projectId: targetProjectId }
                });
                if (!existing) {
                    return { error: 'Rule not found for this project.' };
                }

                if (op === 'delete') {
                    await prisma.tipRoutingRule.delete({ where: { id: ruleId } });
                    return { success: true, operation: op, projectId: targetProjectId, ruleId };
                }

                if (op === 'toggle') {
                    const nextEnabled = typeof enabled === 'boolean' ? enabled : !existing.enabled;
                    const updated = await prisma.tipRoutingRule.update({
                        where: { id: ruleId },
                        data: { enabled: nextEnabled },
                        include: {
                            mcpConnection: { select: { id: true, name: true, type: true, status: true } },
                            cmsConnection: { select: { id: true, name: true, status: true } },
                            n8nConnection: { select: { id: true, name: true, status: true } }
                        }
                    });
                    return { success: true, operation: op, projectId: targetProjectId, rule: updated };
                }

                const updateData: Record<string, unknown> = {};
                if (typeof contentKind === 'string') updateData.contentKind = contentKind;
                if (typeof behavior === 'string') updateData.behavior = behavior;
                if (typeof label !== 'undefined') updateData.label = label ? String(label) : null;
                if (typeof mcpTool !== 'undefined') updateData.mcpTool = mcpTool ? String(mcpTool) : null;
                if (typeof enabled === 'boolean') updateData.enabled = enabled;
                if (typeof priority === 'number' && !Number.isNaN(priority)) updateData.priority = Number(priority);

                const destinationData = await resolveDestinationData();
                if (destinationData) {
                    Object.assign(updateData, destinationData);
                }

                if (Object.keys(updateData).length === 0) {
                    return { error: 'No update fields provided.' };
                }

                const updated = await prisma.tipRoutingRule.update({
                    where: { id: ruleId },
                    data: updateData,
                    include: {
                        mcpConnection: { select: { id: true, name: true, type: true, status: true } },
                        cmsConnection: { select: { id: true, name: true, status: true } },
                        n8nConnection: { select: { id: true, name: true, status: true } }
                    }
                });

                return { success: true, operation: op, projectId: targetProjectId, rule: updated };
            } catch (error: any) {
                console.error('[Copilot Tool] manageTipRouting error:', error);
                return { error: 'Failed to manage routing rules', details: error?.message || 'Unknown error' };
            }
        }
    };
}

export function createProjectConnectionsOpsTool(context: ToolContext) {
    return {
        description: 'Inspect, test and configure project connections (MCP, Google, CMS, n8n) and verify routing readiness.',
        inputSchema: z.object({
            operation: z.enum([
                'status',
                'test',
                'create_mcp',
                'update_mcp',
                'create_google',
                'update_google',
                'upsert_n8n',
                'associate_cms'
            ]).default('status'),
            projectId: z.string().optional(),
            connectionTypes: z.array(z.enum(['mcp', 'google', 'cms', 'n8n'])).optional(),
            connectionId: z.string().optional(),
            mcpType: z.enum(['WORDPRESS', 'WOOCOMMERCE']).optional(),
            type: z.enum(['WORDPRESS', 'WOOCOMMERCE']).optional().describe('Alias of mcpType'),
            name: z.string().optional(),
            endpoint: z.string().optional(),
            credentials: z.any().optional(),
            serviceAccountJson: z.string().optional(),
            ga4PropertyId: z.string().nullable().optional(),
            gscSiteUrl: z.string().nullable().optional(),
            webhookUrl: z.string().optional(),
            triggerOnTips: z.boolean().optional(),
            cmsConnectionId: z.string().optional(),
            shareRole: z.enum(['OWNER', 'EDITOR', 'VIEWER']).optional().default('VIEWER'),
            testAfterSave: z.boolean().optional().default(false)
        }),
        execute: async ({
            operation,
            projectId,
            connectionTypes,
            connectionId,
            mcpType,
            type,
            name,
            endpoint,
            credentials,
            serviceAccountJson,
            ga4PropertyId,
            gscSiteUrl,
            webhookUrl,
            triggerOnTips,
            cmsConnectionId,
            shareRole,
            testAfterSave
        }: {
            operation?: 'status' | 'test' | 'create_mcp' | 'update_mcp' | 'create_google' | 'update_google' | 'upsert_n8n' | 'associate_cms';
            projectId?: string;
            connectionTypes?: Array<'mcp' | 'google' | 'cms' | 'n8n'>;
            connectionId?: string;
            mcpType?: 'WORDPRESS' | 'WOOCOMMERCE';
            type?: 'WORDPRESS' | 'WOOCOMMERCE';
            name?: string;
            endpoint?: string;
            credentials?: unknown;
            serviceAccountJson?: string;
            ga4PropertyId?: string | null;
            gscSiteUrl?: string | null;
            webhookUrl?: string;
            triggerOnTips?: boolean;
            cmsConnectionId?: string;
            shareRole?: 'OWNER' | 'EDITOR' | 'VIEWER';
            testAfterSave?: boolean;
        }) => {
            try {
                const op = operation || 'status';
                const targetProjectId = await resolveSingleProjectId(context, projectId);
                if (!targetProjectId) {
                    return { error: 'No accessible project found for this request.' };
                }

                const isWriteOp = op !== 'status';
                await assertProjectAccess(context.userId, targetProjectId, isWriteOp ? 'ADMIN' : 'VIEWER');

                const project = await prisma.project.findUnique({
                    where: { id: targetProjectId },
                    select: {
                        id: true,
                        name: true,
                        organizationId: true,
                        organization: { select: { plan: true } }
                    }
                });
                if (!project) {
                    return { error: 'Project not found.' };
                }

                const shouldTestAfterSave = Boolean(testAfterSave);

                const ensureIntegrationAllowed = async () => {
                    if (!project.organizationId) {
                        throw new Error('Project organization not found.');
                    }
                    const integrationCheck = await checkIntegrationCreationAllowed(project.organizationId);
                    if (!integrationCheck.allowed) {
                        throw new Error(integrationCheck.reason || 'Integration creation unavailable on this plan.');
                    }
                };

                const parseCredentials = () => {
                    if (credentials == null) return null;
                    if (typeof credentials === 'string') {
                        try {
                            return JSON.parse(credentials);
                        } catch {
                            throw new Error('credentials must be valid JSON when passed as string.');
                        }
                    }
                    if (typeof credentials === 'object') return credentials;
                    throw new Error('credentials must be an object or JSON string.');
                };

                const runN8NTest = async (conn: { id: string; name: string; webhookUrl: string }) => {
                    await prisma.n8NConnection.update({
                        where: { id: conn.id },
                        data: { status: 'TESTING' }
                    });

                    try {
                        const response = await fetch(conn.webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                event: 'test',
                                timestamp: new Date().toISOString(),
                                projectId: targetProjectId,
                                source: 'copilot'
                            })
                        });

                        if (response.ok) {
                            await prisma.n8NConnection.update({
                                where: { id: conn.id },
                                data: {
                                    status: 'ACTIVE',
                                    lastTriggerAt: new Date(),
                                    lastError: null
                                }
                            });
                            return { success: true, message: 'Webhook test successful' };
                        }

                        const errorText = await response.text();
                        await prisma.n8NConnection.update({
                            where: { id: conn.id },
                            data: {
                                status: 'ERROR',
                                lastError: `HTTP ${response.status}: ${errorText.slice(0, 200)}`
                            }
                        });
                        return { success: false, message: `Webhook returned ${response.status}` };
                    } catch (err: any) {
                        const errMessage = err?.message || 'Failed to connect to webhook';
                        await prisma.n8NConnection.update({
                            where: { id: conn.id },
                            data: {
                                status: 'ERROR',
                                lastError: errMessage
                            }
                        });
                        return { success: false, message: errMessage };
                    }
                };

                if (op === 'create_mcp') {
                    const finalType = mcpType || type;
                    if (!finalType || !name || !endpoint) {
                        return { error: 'create_mcp requires mcpType/type, name and endpoint.' };
                    }
                    const parsedCredentials = parseCredentials();
                    if (!parsedCredentials) {
                        return { error: 'create_mcp requires credentials.' };
                    }

                    await ensureIntegrationAllowed();

                    const existing = await prisma.mCPConnection.findFirst({
                        where: { projectId: targetProjectId, type: finalType }
                    });
                    if (existing) {
                        return { error: `A ${finalType} connection already exists for this project.` };
                    }

                    const created = await prisma.mCPConnection.create({
                        data: {
                            projectId: targetProjectId,
                            type: finalType,
                            name: String(name),
                            endpoint: normalizeMcpEndpoint(finalType, String(endpoint)),
                            credentials: encrypt(JSON.stringify(parsedCredentials)),
                            status: 'PENDING',
                            createdBy: context.userId,
                            organizationId: project.organizationId || null,
                            availableTools: []
                        },
                        select: {
                            id: true,
                            projectId: true,
                            type: true,
                            name: true,
                            endpoint: true,
                            status: true,
                            availableTools: true,
                            lastError: true,
                            lastSyncAt: true
                        }
                    });

                    const testResult = shouldTestAfterSave
                        ? await MCPGatewayService.testConnection(created.id)
                        : null;

                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        connection: created,
                        testResult
                    };
                }

                if (op === 'update_mcp') {
                    if (!connectionId) {
                        return { error: 'update_mcp requires connectionId.' };
                    }

                    const existing = await prisma.mCPConnection.findUnique({
                        where: { id: connectionId },
                        select: {
                            id: true,
                            projectId: true,
                            type: true
                        }
                    });
                    if (!existing) return { error: 'MCP connection not found.' };
                    if (existing.projectId !== targetProjectId) {
                        return { error: 'This MCP connection is not directly owned by the selected project.' };
                    }

                    const updateData: Record<string, unknown> = {};
                    if (typeof name === 'string' && name.trim()) updateData.name = name.trim();
                    if (typeof endpoint === 'string' && endpoint.trim()) {
                        updateData.endpoint = normalizeMcpEndpoint(existing.type, endpoint);
                        updateData.status = 'PENDING';
                    }
                    if (credentials != null) {
                        const parsed = parseCredentials();
                        updateData.credentials = encrypt(JSON.stringify(parsed));
                        updateData.status = 'PENDING';
                    }

                    if (Object.keys(updateData).length === 0) {
                        return { error: 'No update fields provided for update_mcp.' };
                    }

                    const updated = await prisma.mCPConnection.update({
                        where: { id: connectionId },
                        data: updateData,
                        select: {
                            id: true,
                            projectId: true,
                            type: true,
                            name: true,
                            endpoint: true,
                            status: true,
                            availableTools: true,
                            lastError: true,
                            lastSyncAt: true
                        }
                    });

                    const testResult = shouldTestAfterSave
                        ? await MCPGatewayService.testConnection(updated.id)
                        : null;

                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        connection: updated,
                        testResult
                    };
                }

                if (op === 'create_google') {
                    if (!serviceAccountJson) {
                        return { error: 'create_google requires serviceAccountJson.' };
                    }
                    await ensureIntegrationAllowed();

                    let serviceAccount: { client_email?: string };
                    try {
                        serviceAccount = JSON.parse(serviceAccountJson);
                    } catch {
                        return { error: 'Invalid serviceAccountJson format.' };
                    }
                    if (!serviceAccount.client_email) {
                        return { error: 'Invalid serviceAccountJson: missing client_email.' };
                    }

                    const existing = await prisma.googleConnection.findUnique({
                        where: { projectId: targetProjectId },
                        select: { id: true }
                    });
                    if (existing) {
                        return { error: 'A Google connection already exists for this project.' };
                    }

                    const ga4Value = ga4PropertyId && String(ga4PropertyId).trim() ? String(ga4PropertyId).trim() : null;
                    const gscValue = gscSiteUrl && String(gscSiteUrl).trim() ? String(gscSiteUrl).trim() : null;

                    const created = await prisma.googleConnection.create({
                        data: {
                            projectId: targetProjectId,
                            serviceAccountEmail: serviceAccount.client_email,
                            serviceAccountJson: encrypt(serviceAccountJson),
                            ga4Enabled: Boolean(ga4Value),
                            ga4PropertyId: ga4Value,
                            ga4Status: ga4Value ? 'PENDING' : 'DISABLED',
                            gscEnabled: Boolean(gscValue),
                            gscSiteUrl: gscValue,
                            gscStatus: gscValue ? 'PENDING' : 'DISABLED',
                            createdBy: context.userId
                        },
                        select: {
                            id: true,
                            projectId: true,
                            serviceAccountEmail: true,
                            ga4Enabled: true,
                            ga4PropertyId: true,
                            ga4Status: true,
                            ga4LastError: true,
                            gscEnabled: true,
                            gscSiteUrl: true,
                            gscStatus: true,
                            gscLastError: true
                        }
                    });

                    let testResult: Record<string, unknown> | null = null;
                    if (shouldTestAfterSave) {
                        testResult = {
                            ga4: created.ga4Enabled && created.ga4PropertyId
                                ? await GoogleService.testGA4(created.id)
                                : { success: false, skipped: true, reason: 'GA4 non configurato' },
                            gsc: created.gscEnabled && created.gscSiteUrl
                                ? await GoogleService.testGSC(created.id)
                                : { success: false, skipped: true, reason: 'GSC non configurato' }
                        };
                    }

                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        connection: created,
                        testResult
                    };
                }

                if (op === 'update_google') {
                    if (!connectionId) return { error: 'update_google requires connectionId.' };

                    const existing = await prisma.googleConnection.findUnique({
                        where: { id: connectionId },
                        select: {
                            id: true,
                            projectId: true,
                            ga4Enabled: true,
                            gscEnabled: true
                        }
                    });
                    if (!existing) return { error: 'Google connection not found.' };
                    if (existing.projectId !== targetProjectId) {
                        return { error: 'This Google connection is not owned by the selected project.' };
                    }

                    const updateData: Record<string, unknown> = {};

                    if (typeof serviceAccountJson === 'string' && serviceAccountJson.trim()) {
                        let parsed: { client_email?: string };
                        try {
                            parsed = JSON.parse(serviceAccountJson);
                        } catch {
                            return { error: 'Invalid serviceAccountJson format.' };
                        }
                        if (!parsed.client_email) {
                            return { error: 'Invalid serviceAccountJson: missing client_email.' };
                        }
                        updateData.serviceAccountEmail = parsed.client_email;
                        updateData.serviceAccountJson = encrypt(serviceAccountJson);
                        updateData.ga4Status = existing.ga4Enabled ? 'PENDING' : 'DISABLED';
                        updateData.gscStatus = existing.gscEnabled ? 'PENDING' : 'DISABLED';
                    }

                    if (ga4PropertyId !== undefined) {
                        const normalizedGa4 = ga4PropertyId && String(ga4PropertyId).trim()
                            ? String(ga4PropertyId).trim()
                            : null;
                        if (normalizedGa4) {
                            updateData.ga4Enabled = true;
                            updateData.ga4PropertyId = normalizedGa4;
                            updateData.ga4Status = 'PENDING';
                        } else {
                            updateData.ga4Enabled = false;
                            updateData.ga4PropertyId = null;
                            updateData.ga4Status = 'DISABLED';
                        }
                    }

                    if (gscSiteUrl !== undefined) {
                        const normalizedGsc = gscSiteUrl && String(gscSiteUrl).trim()
                            ? String(gscSiteUrl).trim()
                            : null;
                        if (normalizedGsc) {
                            updateData.gscEnabled = true;
                            updateData.gscSiteUrl = normalizedGsc;
                            updateData.gscStatus = 'PENDING';
                        } else {
                            updateData.gscEnabled = false;
                            updateData.gscSiteUrl = null;
                            updateData.gscStatus = 'DISABLED';
                        }
                    }

                    if (Object.keys(updateData).length === 0) {
                        return { error: 'No update fields provided for update_google.' };
                    }

                    const updated = await prisma.googleConnection.update({
                        where: { id: connectionId },
                        data: updateData,
                        select: {
                            id: true,
                            projectId: true,
                            serviceAccountEmail: true,
                            ga4Enabled: true,
                            ga4PropertyId: true,
                            ga4Status: true,
                            ga4LastError: true,
                            gscEnabled: true,
                            gscSiteUrl: true,
                            gscStatus: true,
                            gscLastError: true
                        }
                    });

                    let testResult: Record<string, unknown> | null = null;
                    if (shouldTestAfterSave) {
                        testResult = {
                            ga4: updated.ga4Enabled && updated.ga4PropertyId
                                ? await GoogleService.testGA4(updated.id)
                                : { success: false, skipped: true, reason: 'GA4 non configurato' },
                            gsc: updated.gscEnabled && updated.gscSiteUrl
                                ? await GoogleService.testGSC(updated.id)
                                : { success: false, skipped: true, reason: 'GSC non configurato' }
                        };
                    }

                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        connection: updated,
                        testResult
                    };
                }

                if (op === 'upsert_n8n') {
                    if (webhookUrl) {
                        try {
                            new URL(webhookUrl);
                        } catch {
                            return { error: 'Invalid webhookUrl format.' };
                        }
                    }

                    const current = await prisma.n8NConnection.findUnique({
                        where: { projectId: targetProjectId },
                        select: {
                            id: true,
                            projectId: true,
                            name: true,
                            webhookUrl: true,
                            status: true,
                            triggerOnTips: true,
                            lastTriggerAt: true,
                            lastError: true
                        }
                    });

                    if (!current) {
                        await ensureIntegrationAllowed();
                    }

                    const plan = String(project.organization?.plan || '').toUpperCase();
                    if (!['BUSINESS', 'PARTNER', 'ENTERPRISE', 'ADMIN'].includes(plan)) {
                        return { error: 'Upgrade to BUSINESS required for n8n integration.' };
                    }

                    const nextWebhookUrl = webhookUrl || current?.webhookUrl;
                    if (!nextWebhookUrl) {
                        return { error: 'upsert_n8n requires webhookUrl when no connection exists.' };
                    }

                    const upserted = await prisma.n8NConnection.upsert({
                        where: { projectId: targetProjectId },
                        create: {
                            projectId: targetProjectId,
                            name: name?.trim() || 'n8n Automation',
                            webhookUrl: nextWebhookUrl,
                            triggerOnTips: typeof triggerOnTips === 'boolean' ? triggerOnTips : true,
                            createdBy: context.userId,
                            status: 'PENDING'
                        },
                        update: {
                            name: name?.trim() || current?.name || 'n8n Automation',
                            webhookUrl: nextWebhookUrl,
                            triggerOnTips: typeof triggerOnTips === 'boolean'
                                ? triggerOnTips
                                : (current?.triggerOnTips ?? true),
                            status: 'PENDING'
                        },
                        select: {
                            id: true,
                            projectId: true,
                            name: true,
                            webhookUrl: true,
                            status: true,
                            triggerOnTips: true,
                            lastTriggerAt: true,
                            lastError: true
                        }
                    });

                    const testResult = shouldTestAfterSave
                        ? await runN8NTest({
                            id: upserted.id,
                            name: upserted.name,
                            webhookUrl: upserted.webhookUrl
                        })
                        : null;

                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        connection: upserted,
                        testResult
                    };
                }

                if (op === 'associate_cms') {
                    if (!cmsConnectionId) {
                        return { error: 'associate_cms requires cmsConnectionId.' };
                    }

                    const result = await CMSConnectionService.associateProject(
                        cmsConnectionId,
                        targetProjectId,
                        context.userId,
                        shareRole || 'VIEWER'
                    );

                    if (!result.success) {
                        return { error: result.error || 'Failed to associate CMS connection.' };
                    }

                    const associated = await prisma.cMSConnection.findUnique({
                        where: { id: cmsConnectionId },
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            cmsApiUrl: true,
                            lastSyncAt: true,
                            lastSyncError: true
                        }
                    });

                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        connection: associated
                    };
                }

                const typeFilter = new Set(connectionTypes && connectionTypes.length > 0
                    ? connectionTypes
                    : ['mcp', 'google', 'cms', 'n8n']);

                const [mcpConnections, googleConnection, cmsConnections, n8nConnection] = await Promise.all([
                    typeFilter.has('mcp')
                        ? prisma.mCPConnection.findMany({
                            where: {
                                OR: [
                                    { projectId: targetProjectId },
                                    { projectShares: { some: { projectId: targetProjectId } } }
                                ]
                            },
                            select: {
                                id: true,
                                type: true,
                                name: true,
                                status: true,
                                endpoint: true,
                                lastSyncAt: true,
                                lastError: true
                            }
                        })
                        : Promise.resolve([]),
                    typeFilter.has('google')
                        ? prisma.googleConnection.findUnique({
                            where: { projectId: targetProjectId },
                            select: {
                                id: true,
                                ga4Enabled: true,
                                ga4Status: true,
                                ga4PropertyId: true,
                                ga4LastError: true,
                                gscEnabled: true,
                                gscStatus: true,
                                gscSiteUrl: true,
                                gscLastError: true
                            }
                        })
                        : Promise.resolve(null),
                    typeFilter.has('cms')
                        ? prisma.cMSConnection.findMany({
                            where: {
                                OR: [
                                    { projectId: targetProjectId },
                                    { projectShares: { some: { projectId: targetProjectId } } }
                                ]
                            },
                            select: {
                                id: true,
                                name: true,
                                status: true,
                                cmsApiUrl: true,
                                lastSyncAt: true,
                                lastSyncError: true
                            }
                        })
                        : Promise.resolve([]),
                    typeFilter.has('n8n')
                        ? prisma.n8NConnection.findUnique({
                            where: { projectId: targetProjectId },
                            select: {
                                id: true,
                                name: true,
                                webhookUrl: true,
                                status: true,
                                lastTriggerAt: true,
                                lastError: true
                            }
                        })
                        : Promise.resolve(null)
                ]);

                if (op === 'status') {
                    return {
                        success: true,
                        operation: op,
                        projectId: targetProjectId,
                        routingReady: (mcpConnections.length > 0) || Boolean(cmsConnections.length > 0) || Boolean(n8nConnection),
                        connections: {
                            mcp: mcpConnections,
                            google: googleConnection,
                            cms: cmsConnections,
                            n8n: n8nConnection
                        }
                    };
                }

                const tests: Array<Record<string, unknown>> = [];

                for (const conn of mcpConnections) {
                    if (connectionId && conn.id !== connectionId) continue;
                    const result = await MCPGatewayService.testConnection(conn.id);
                    tests.push({ type: 'mcp', connectionId: conn.id, name: conn.name, result });
                }

                if (googleConnection && (!connectionId || googleConnection.id === connectionId)) {
                    const results: Record<string, unknown> = {};
                    if (googleConnection.ga4Enabled && googleConnection.ga4PropertyId) {
                        results.ga4 = await GoogleService.testGA4(googleConnection.id);
                    } else {
                        results.ga4 = { success: false, skipped: true, reason: 'GA4 non configurato' };
                    }
                    if (googleConnection.gscEnabled && googleConnection.gscSiteUrl) {
                        results.gsc = await GoogleService.testGSC(googleConnection.id);
                    } else {
                        results.gsc = { success: false, skipped: true, reason: 'GSC non configurato' };
                    }
                    tests.push({ type: 'google', connectionId: googleConnection.id, name: 'Google', result: results });
                }

                for (const conn of cmsConnections) {
                    if (connectionId && conn.id !== connectionId) continue;
                    const result = await CMSConnectionService.testConnection(conn.id);
                    tests.push({ type: 'cms', connectionId: conn.id, name: conn.name, result });
                }

                if (n8nConnection && (!connectionId || n8nConnection.id === connectionId)) {
                    const result = await runN8NTest({
                        id: n8nConnection.id,
                        name: n8nConnection.name,
                        webhookUrl: n8nConnection.webhookUrl
                    });
                    tests.push({
                        type: 'n8n',
                        connectionId: n8nConnection.id,
                        name: n8nConnection.name,
                        result
                    });
                }

                if (connectionId && tests.length === 0) {
                    return { error: 'Connection not found for this project or filtered types.' };
                }

                return {
                    success: true,
                    operation: op,
                    projectId: targetProjectId,
                    tested: tests.length,
                    tests
                };
            } catch (error: any) {
                console.error('[Copilot Tool] manageProjectConnections error:', error);
                return { error: 'Failed to manage connections', details: error?.message || 'Unknown error' };
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
                            websiteUrl: true,
                            additionalUrls: true,
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
                                select: {
                                    id: true,
                                    websiteUrl: true,
                                    overallScore: true,
                                    structuredDataScore: true,
                                    valuePropositionScore: true,
                                    keywordCoverageScore: true,
                                    contentClarityScore: true,
                                    promptsAddressed: true,
                                    pagesScraped: true,
                                    structuredDataFound: true,
                                    valuePropositions: true,
                                    keywordAnalysis: true,
                                    contentAnalysis: true,
                                    status: true,
                                    startedAt: true,
                                    completedAt: true,
                                    errorMessage: true,
                                    recommendations: true
                                }
                            },
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
                            websiteUrl: true,
                            additionalUrls: true,
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
                                select: {
                                    id: true,
                                    websiteUrl: true,
                                    overallScore: true,
                                    structuredDataScore: true,
                                    valuePropositionScore: true,
                                    keywordCoverageScore: true,
                                    contentClarityScore: true,
                                    promptsAddressed: true,
                                    pagesScraped: true,
                                    structuredDataFound: true,
                                    valuePropositions: true,
                                    keywordAnalysis: true,
                                    contentAnalysis: true,
                                    status: true,
                                    startedAt: true,
                                    completedAt: true,
                                    errorMessage: true,
                                    recommendations: true
                                }
                            },
                        }
                    });
                }

                return {
                    scope: { projectIds: limitedProjectIds },
                    visibility: configs.map((cfg: any) => ({
                        scrapingScope: {
                            primaryWebsiteUrl: cfg.websiteUrl || null,
                            additionalUrls: parseAdditionalUrls(cfg.additionalUrls)
                        },
                        latestWebsiteAnalysis: cfg.websiteAnalyses?.[0]
                            ? (() => {
                                const recs = Array.isArray(cfg.websiteAnalyses[0].recommendations)
                                    ? cfg.websiteAnalyses[0].recommendations as Array<Record<string, unknown>>
                                    : [];
                                const prompts = cfg.websiteAnalyses[0].promptsAddressed as Record<string, unknown> | null;
                                const keywordAnalysis = cfg.websiteAnalyses[0].keywordAnalysis as Record<string, unknown> | null;
                                const structuredData = cfg.websiteAnalyses[0].structuredDataFound as Record<string, unknown> | null;
                                const contentAnalysis = cfg.websiteAnalyses[0].contentAnalysis as Record<string, unknown> | null;
                                return {
                                    id: cfg.websiteAnalyses[0].id,
                                    websiteUrl: cfg.websiteAnalyses[0].websiteUrl || null,
                                    status: cfg.websiteAnalyses[0].status,
                                    overallScore: cfg.websiteAnalyses[0].overallScore,
                                    structuredDataScore: cfg.websiteAnalyses[0].structuredDataScore,
                                    valuePropositionScore: cfg.websiteAnalyses[0].valuePropositionScore,
                                    keywordCoverageScore: cfg.websiteAnalyses[0].keywordCoverageScore,
                                    contentClarityScore: cfg.websiteAnalyses[0].contentClarityScore,
                                    pagesScraped: cfg.websiteAnalyses[0].pagesScraped || 0,
                                    startedAt: cfg.websiteAnalyses[0].startedAt,
                                    completedAt: cfg.websiteAnalyses[0].completedAt,
                                    errorMessage: cfg.websiteAnalyses[0].errorMessage || null,
                                    recommendationCount: recs.length,
                                    topRecommendations: recs.slice(0, 5).map((r) => ({
                                        type: typeof r.type === 'string' ? r.type : 'N/D',
                                        title: typeof r.title === 'string' ? r.title : 'N/D',
                                        priority: typeof r.priority === 'string' ? r.priority : null,
                                        impact: typeof r.impact === 'string' ? r.impact : null
                                    })),
                                    structuredDataSummary: structuredData
                                        ? {
                                            schemaTypes: Array.isArray(structuredData.schemaTypes) ? structuredData.schemaTypes.slice(0, 10) : [],
                                            hasFaq: Boolean((structuredData as any).hasFaq),
                                            hasOrganization: Boolean((structuredData as any).hasOrganization)
                                        }
                                        : null,
                                    keywordSummary: keywordAnalysis
                                        ? {
                                            opportunities: Array.isArray((keywordAnalysis as any).opportunities)
                                                ? ((keywordAnalysis as any).opportunities as Array<Record<string, unknown>>).slice(0, 5)
                                                : [],
                                            coveredKeywords: Array.isArray((keywordAnalysis as any).coveredKeywords)
                                                ? ((keywordAnalysis as any).coveredKeywords as string[]).slice(0, 12)
                                                : []
                                        }
                                        : null,
                                    contentSummary: contentAnalysis
                                        ? {
                                            readability: (contentAnalysis as any).readability || null,
                                            clarityIssues: Array.isArray((contentAnalysis as any).clarityIssues)
                                                ? ((contentAnalysis as any).clarityIssues as unknown[]).slice(0, 6)
                                                : []
                                        }
                                        : null,
                                    promptsCoverage: prompts
                                        ? {
                                            addressed: Array.isArray(prompts.addressed) ? prompts.addressed.length : 0,
                                            gaps: Array.isArray(prompts.gaps) ? prompts.gaps.length : 0
                                        }
                                        : null
                                };
                            })()
                            : null,
                        configId: cfg.id,
                        brandName: cfg.brandName,
                        projectId: cfg.projectId,
                        isActive: cfg.isActive,
                        updatedAt: cfg.updatedAt,
                        latestScan: cfg.scans?.[0] || null
                    }))
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching visibility insights:', error);
                return { error: 'Failed to fetch visibility insights', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createProjectAiTipsTool(context: ToolContext) {
    return {
        description: 'Fetch canonical AI tips (ProjectTip) for the project. Returns only canonical ProjectTip records — use manageCanonicalTips for editing.',
        inputSchema: z.object({
            projectId: z.string().optional().describe('Optional project ID. If omitted, uses selected/current project or all accessible projects.'),
            limit: z.number().optional().default(10).describe('Maximum records to return (hard-capped to 10).'),
            statuses: z.array(z.string()).optional().describe('Optional status filter (NEW, REVIEWED, APPROVED, DRAFTED, ROUTED, AUTOMATED).')
        }),
        execute: async ({
            projectId,
            limit,
            statuses
        }: {
            projectId?: string;
            limit?: number;
            statuses?: string[];
        }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                // --- Canonical tips (primary source) ---
                const canonicalWhere: Record<string, unknown> = {
                    organizationId: context.organizationId,
                    projectId: { in: projectIds },
                };
                if (Array.isArray(statuses) && statuses.length > 0) {
                    // Map any legacy status names to canonical equivalents
                    const canonicalStatuses = statuses.map(s => {
                        const upper = s.toUpperCase();
                        if (upper === 'NEW' || upper === 'STARRED') return 'ACTIVE';
                        if (upper === 'COMPLETED') return 'ARCHIVED';
                        return upper;
                    });
                    canonicalWhere.status = { in: [...new Set(canonicalStatuses)] };
                }
                const canonicalTips = await prisma.projectTip.findMany({
                    where: canonicalWhere as any,
                    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
                    take: clampLimit(limit),
                    select: {
                        id: true,
                        projectId: true,
                        title: true,
                        summary: true,
                        status: true,
                        priority: true,
                        category: true,
                        contentKind: true,
                        approvalMode: true,
                        draftStatus: true,
                        routingStatus: true,
                        publishStatus: true,
                        starred: true,
                        reasoning: true,
                        strategicAlignment: true,
                        methodologySummary: true,
                        recommendedActions: true,
                        originType: true,
                        createdAt: true,
                        updatedAt: true,
                        project: { select: { name: true } },
                        _count: { select: { evidence: true, routes: true, executions: true } }
                    }
                });

                const formattedCanonicalTips = canonicalTips.map((tip: any) => ({
                    _source: 'canonical' as const,
                    id: tip.id,
                    projectId: tip.projectId,
                    projectName: tip.project?.name || null,
                    title: tip.title,
                    summary: tip.summary,
                    status: tip.status,
                    priority: tip.priority,
                    category: tip.category,
                    contentKind: tip.contentKind,
                    approvalMode: tip.approvalMode,
                    draftStatus: tip.draftStatus,
                    routingStatus: tip.routingStatus,
                    publishStatus: tip.publishStatus,
                    starred: tip.starred,
                    reasoning: tip.reasoning,
                    strategicAlignment: tip.strategicAlignment,
                    methodologySummary: tip.methodologySummary,
                    recommendedActions: tip.recommendedActions,
                    originType: tip.originType,
                    evidenceCount: tip._count?.evidence ?? 0,
                    routeCount: tip._count?.routes ?? 0,
                    executionCount: tip._count?.executions ?? 0,
                    createdAt: tip.createdAt,
                    updatedAt: tip.updatedAt,
                }));

                return {
                    scope: { projectIds },
                    canonicalTips: formattedCanonicalTips,
                    summary: {
                        canonicalTipCount: formattedCanonicalTips.length,
                    }
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching AI tips:', error);
                return { error: 'Failed to fetch AI tips', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createExternalAnalyticsTool(context: ToolContext) {
    return {
        description: 'Fetch external analytics snapshots from Google Analytics (GA4) and Search Console (GSC) for selected or accessible projects. Supports optional date range and period comparison (current vs previous period).',
        inputSchema: z.object({
            projectId: z.string().optional().describe('Optional project ID. If omitted, uses the currently selected project or all accessible projects.'),
            limit: z.number().optional().default(5).describe('Maximum number of projects to return (hard-capped to 10).'),
            dateFrom: z.string().optional().describe('ISO date string (YYYY-MM-DD) for the start of the period to analyze.'),
            dateTo: z.string().optional().describe('ISO date string (YYYY-MM-DD) for the end of the period to analyze.'),
            comparePreviousPeriod: z.boolean().optional().default(false).describe('If true, also fetches the previous equivalent period for week-over-week or month-over-month comparison.')
        }),
        execute: async ({ projectId, limit, dateFrom, dateTo, comparePreviousPeriod }: { projectId?: string; limit?: number; dateFrom?: string; dateTo?: string; comparePreviousPeriod?: boolean }) => {
            try {
                const projectIds = await resolveAccessibleProjectIds(context, projectId);
                if (projectIds.length === 0) {
                    return { error: 'No accessible project found for this request.' };
                }

                const limitedProjectIds = projectIds.slice(0, clampLimit(limit));

                // Build date filter for current period
                const analyticsWhere: Record<string, any> = {};
                if (dateFrom || dateTo) {
                    analyticsWhere.date = {};
                    if (dateFrom) analyticsWhere.date.gte = new Date(dateFrom);
                    if (dateTo) {
                        const end = new Date(dateTo);
                        end.setHours(23, 59, 59, 999);
                        analyticsWhere.date.lte = end;
                    }
                }

                // Compute previous period window for comparison
                let prevPeriodWhere: Record<string, any> | null = null;
                if (comparePreviousPeriod && dateFrom && dateTo) {
                    const from = new Date(dateFrom);
                    const to = new Date(dateTo);
                    const periodMs = to.getTime() - from.getTime();
                    const prevTo = new Date(from.getTime() - 1);
                    const prevFrom = new Date(prevTo.getTime() - periodMs);
                    prevPeriodWhere = { date: { gte: prevFrom, lte: prevTo } };
                }

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
                            where: Object.keys(analyticsWhere).length > 0 ? analyticsWhere : undefined,
                            orderBy: { date: 'desc' },
                            take: dateFrom || dateTo ? 90 : 1,
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

                // Fetch previous period snapshots if comparison requested
                const prevSnapshotsByProject: Record<string, any[]> = {};
                if (prevPeriodWhere) {
                    const prevConnections = await prisma.googleConnection.findMany({
                        where: { projectId: { in: limitedProjectIds } },
                        select: {
                            projectId: true,
                            analytics: {
                                where: prevPeriodWhere,
                                orderBy: { date: 'desc' },
                                take: 90,
                                select: {
                                    date: true,
                                    pageviews: true,
                                    sessions: true,
                                    users: true,
                                    bounceRate: true,
                                    searchImpressions: true,
                                    searchClicks: true,
                                    avgPosition: true
                                }
                            }
                        }
                    });
                    for (const pc of prevConnections) {
                        prevSnapshotsByProject[pc.projectId] = pc.analytics || [];
                    }
                }

                return {
                    scope: { projectIds: limitedProjectIds, dateFrom: dateFrom || null, dateTo: dateTo || null, comparePreviousPeriod: Boolean(comparePreviousPeriod) },
                    externalAnalytics: connections.map((conn: any) => {
                        const snapshots: any[] = conn.analytics || [];
                        const prevSnapshots: any[] = prevSnapshotsByProject[conn.projectId] || [];

                        // Aggregate current period totals
                        const aggregated = snapshots.length > 0 ? {
                            periodSnapshots: snapshots.length,
                            totalPageviews: snapshots.reduce((s: number, r: any) => s + (r.pageviews || 0), 0),
                            totalSessions: snapshots.reduce((s: number, r: any) => s + (r.sessions || 0), 0),
                            totalUsers: snapshots.reduce((s: number, r: any) => s + (r.users || 0), 0),
                            totalSearchImpressions: snapshots.reduce((s: number, r: any) => s + (r.searchImpressions || 0), 0),
                            totalSearchClicks: snapshots.reduce((s: number, r: any) => s + (r.searchClicks || 0), 0),
                            avgBounceRate: snapshots.filter((r: any) => r.bounceRate != null).length > 0
                                ? snapshots.reduce((s: number, r: any) => s + (r.bounceRate || 0), 0) / snapshots.filter((r: any) => r.bounceRate != null).length
                                : null,
                            avgPosition: snapshots.filter((r: any) => r.avgPosition != null).length > 0
                                ? snapshots.reduce((s: number, r: any) => s + (r.avgPosition || 0), 0) / snapshots.filter((r: any) => r.avgPosition != null).length
                                : null,
                            latestSnapshot: snapshots[0] || null
                        } : null;

                        // Aggregate previous period totals
                        const prevAggregated = prevSnapshots.length > 0 ? {
                            periodSnapshots: prevSnapshots.length,
                            totalPageviews: prevSnapshots.reduce((s: number, r: any) => s + (r.pageviews || 0), 0),
                            totalSessions: prevSnapshots.reduce((s: number, r: any) => s + (r.sessions || 0), 0),
                            totalUsers: prevSnapshots.reduce((s: number, r: any) => s + (r.users || 0), 0),
                            totalSearchImpressions: prevSnapshots.reduce((s: number, r: any) => s + (r.searchImpressions || 0), 0),
                            totalSearchClicks: prevSnapshots.reduce((s: number, r: any) => s + (r.searchClicks || 0), 0)
                        } : null;

                        return {
                            projectId: conn.projectId,
                            projectName: conn.project?.name || null,
                            ga4: { enabled: conn.ga4Enabled, status: conn.ga4Status, propertyId: conn.ga4PropertyId || null },
                            gsc: { enabled: conn.gscEnabled, status: conn.gscStatus, siteUrl: conn.gscSiteUrl || null },
                            currentPeriod: aggregated,
                            previousPeriod: prevAggregated
                        };
                    })
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching external analytics:', error);
                return { error: 'Failed to fetch external analytics', details: error.message || 'Unknown error' };
            }
        }
    };
}

export function createStrategicKnowledgeTool(context: ToolContext) {
    return {
        description: 'Fetch organization-level strategic marketing knowledge base and strategic plan (updatable from settings) for contextual marketing decisions.',
        inputSchema: z.object({
            query: z.string().optional().describe('Optional query to extract relevant sections from strategic marketing knowledge.'),
            limit: z.number().optional().default(5).describe('Max matched sections to return (hard-capped to 10).')
        }),
        execute: async ({ query, limit }: { query?: string; limit?: number }) => {
            try {
                await assertOrganizationAccess(context.userId, context.organizationId, 'VIEWER');

                const settings = await prisma.platformSettings.findFirst({
                    where: { organizationId: context.organizationId },
                    select: {
                        updatedAt: true,
                        strategicPlan: true
                    }
                });

                const strategicMarketing = await getStrategicMarketingKnowledgeByOrg(context.organizationId);
                const methodology = String(strategicMarketing.knowledge || getDefaultStrategicMarketingKnowledge() || '').trim();
                const strategicPlan = String(settings?.strategicPlan || '').trim();
                const safeLimit = clampLimit(limit);

                const rawSections = methodology
                    .split(/\n{2,}/)
                    .map((section) => section.trim())
                    .filter(Boolean);

                const queryWords = String(query || '')
                    .toLowerCase()
                    .split(/\s+/)
                    .map((w) => w.trim())
                    .filter((w) => w.length > 2);

                const rankedSections = queryWords.length === 0
                    ? rawSections.map((section, idx) => ({ section, score: rawSections.length - idx }))
                    : rawSections
                        .map((section) => {
                            const lc = section.toLowerCase();
                            let score = 0;
                            for (const word of queryWords) {
                                const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                                score += (lc.match(regex) || []).length;
                            }
                            return { section, score };
                        })
                        .filter((item) => item.score > 0)
                        .sort((a, b) => b.score - a.score);

                return {
                    hasKnowledge: Boolean(methodology || strategicPlan),
                    updatedAt: settings?.updatedAt || strategicMarketing.updatedAt || null,
                    strategicMarketingKnowledgeLength: methodology.length,
                    strategicPlanLength: strategicPlan.length,
                    strategicMarketingKnowledgePreview: methodology.slice(0, 2000),
                    strategicPlanPreview: strategicPlan.slice(0, 2000),
                    matchedSections: rankedSections.slice(0, safeLimit).map((item) => ({
                        text: item.section.slice(0, 1200),
                        score: item.score
                    }))
                };
            } catch (error: any) {
                console.error('[Copilot Tool] Error fetching strategic knowledge:', error);
                return { error: 'Failed to fetch strategic knowledge', details: error.message || 'Unknown error' };
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
                        sitemapUrl: true,
                        additionalUrls: true
                    }
                });

                const urlRegex = /https?:\/\/[^\s)\]"']+/gi;

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
                        sitemapUrl: cfg.sitemapUrl || null,
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
                        indexKnowledgeSource(saved.id, scraped.title, `URL: ${scraped.url}\n\nTitle: ${scraped.title}\n\n${scraped.content}`)
                            .catch(err => console.error('[copilot scrapeWebSource] embedding failed:', err));
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

                const { urls: sites } = await parseProvidedSitemap(url);
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
                            indexKnowledgeSource(saved.id, scraped.title, `URL: ${scraped.url}\n\nTitle: ${scraped.title}\n\n${scraped.content}`)
                                .catch(err => console.error('[copilot scrapeWebSource] embedding failed:', err));
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
        description: 'Create a new canonical AI Tip (ProjectTip) and optionally dispatch its routing-ready actions to routing rules and n8n automation.',
        inputSchema: z.object({
            projectId: z.string().optional().describe('Project ID. If omitted, uses selected project in Copilot context.'),
            topicName: z.string().min(5).max(180).describe('Strategic AI tip title shown in Insights.'),
            reasoning: z.string().min(10).max(4000).describe('Strategic rationale and evidence behind the tip.'),
            priorityScore: z.number().min(0).max(100).optional().default(70),
            actions: z.array(strategicTipActionSchema).min(1).max(6),
            autoCreateContentDrafts: z.boolean().optional().default(false).describe('Deprecated compatibility flag. Phase 5 no longer creates CMS draft records from this tool.'),
            autoDispatchRouting: z.boolean().optional().default(false).describe('If true, run n8n dispatch and tip routing rules using the canonical tip actions.')
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

                const canonicalTip = await ProjectTipService.createCopilotTip({
                    projectId: targetProjectId,
                    organizationId: context.organizationId,
                    title: topicName,
                    summary: reasoning.slice(0, 280),
                    priority: Number(priorityScore ?? 70),
                    category: 'copilot_strategic',
                    contentKind: 'STRATEGIC_RECOMMENDATION',
                    executionClass: 'COPILOT',
                    reasoning,
                    strategicAlignment: reasoning,
                    actions: enrichedActions as any,
                    evidence: enrichedActions.flatMap((action) => action.evidence ?? []) as any,
                    createdBy: context.userId,
                });
                const canonicalTipId = canonicalTip.id;

                const routing = { dispatchedToN8N: false, routedRules: 0, routingFailures: 0 };
                const tipsPayload = buildStrategicTipRoutingPayload(canonicalTipId, enrichedActions);

                if (autoDispatchRouting && tipsPayload.length > 0) {

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
                    canonicalTipId,
                    tip: {
                        id: canonicalTipId,
                        projectId: targetProjectId,
                        topicName,
                        priorityScore: Number(priorityScore ?? 70),
                        actionsCount: enrichedActions.length,
                    },
                    automations: {
                        contentDraftsCreated: 0,
                        draftGenerationSupported: false,
                        routableActionsCount: tipsPayload.length,
                        ignoredAutoCreateContentDrafts: Boolean(autoCreateContentDrafts),
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

export function createCompetitorAnalysisTool(context: ToolContext) {
    return {
        description: 'Aggregate competitor intelligence from LLM visibility scans: positions, mention frequency, platform coverage, and content gaps per competitor. Returns a competitive landscape overview.',
        inputSchema: z.object({
            projectId: z.string().optional().describe('Optional project ID. If omitted, uses all accessible projects.'),
            limit: z.number().optional().default(3).describe('Maximum number of visibility configs to analyze (1-5).')
        }),
        execute: async ({ projectId, limit }: { projectId?: string; limit?: number }) => {
            try {
                const { getCompetitorIntelligence } = await import('@/lib/copilot/competitor-analysis');
                const reports = await getCompetitorIntelligence(
                    context.organizationId,
                    projectId || context.projectId,
                    Math.min(Math.max(1, Math.floor(limit ?? 3)), 5)
                );

                if (reports.length === 0) {
                    return { message: 'No visibility configurations with competitor data found for the selected project(s). Configure competitors in the Visibility Monitor section.' };
                }

                return {
                    reports: reports.map((r) => ({
                        brandName: r.brandName,
                        brandAvgPosition: r.brandAvgPosition,
                        scanCount: r.scanCount,
                        dateRange: r.dateRange,
                        competitors: r.competitors.map((c) => ({
                            name: c.name,
                            website: c.website,
                            avgPosition: c.avgPosition,
                            mentionCount: c.mentionCount,
                            platformsCited: c.platformsCited,
                            positioningNotes: c.profile?.positioningNotes ?? null,
                            contentGaps: (() => {
                                const val = c.profile?.contentGaps;
                                if (!val) return null;
                                const str = typeof val === 'string' ? val : JSON.stringify(val);
                                return str.slice(0, 500);
                            })(),
                        })),
                    })),
                };
            } catch (error: any) {
                return { error: error?.message || 'Failed to fetch competitor intelligence.' };
            }
        }
    };
}

export function createSeoGeoAeoTool(context: ToolContext) {
    return {
        description: 'Analyze SEO/GEO/AEO opportunities: featured snippet targets from GSC data (positions 4-20 with high impressions) and citation-building strategy for LLM visibility optimization.',
        inputSchema: z.object({
            projectId: z.string().optional().describe('Optional project ID.'),
            topic: z.string().optional().describe('Topic or keyword for citation-building recommendations.'),
            mode: z.enum(['featured_snippets', 'citation_building', 'both']).optional().default('both').describe('Which analysis to run.')
        }),
        execute: async ({ projectId, topic, mode }: { projectId?: string; topic?: string; mode?: 'featured_snippets' | 'citation_building' | 'both' }) => {
            const { getFeaturedSnippetOpportunities, getCitationBuildingRecommendations } = await import('@/lib/copilot/seo-geo-aeo');

            const result: Record<string, unknown> = {};
            const effectiveMode = mode ?? 'both';

            if (effectiveMode === 'featured_snippets' || effectiveMode === 'both') {
                const opportunities = await getFeaturedSnippetOpportunities(context.organizationId, projectId || context.projectId);
                result['featuredSnippetOpportunities'] = opportunities;
                result['featuredSnippetCount'] = opportunities.length;
            }

            if (effectiveMode === 'citation_building' || effectiveMode === 'both') {
                const effectiveTopic = topic || 'contenuto del sito';
                result['citationBuilding'] = getCitationBuildingRecommendations(effectiveTopic);
            }

            const hasSnippets = Array.isArray(result['featuredSnippetOpportunities']) && (result['featuredSnippetOpportunities'] as unknown[]).length > 0;
            const hasCitation = result['citationBuilding'] !== undefined;

            if (!hasSnippets && !hasCitation) {
                return { message: 'Nessun dato disponibile. Assicurati di aver collegato Google Search Console per ottenere opportunità di featured snippet.' };
            }

            return result;
        }
    };
}
