import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const getProjectTranscriptsTool = {
    description: 'Fetch interview transcripts and summaries for a specific project. Use this to analyze feedback from interviews.',
    parameters: z.object({
        projectId: z.string().describe('The ID of the project to fetch transcripts for'),
        limit: z.number().optional().default(10).describe('Maximum number of transcripts to return'),
    }),
    execute: async ({ projectId, limit }: { projectId: string; limit?: number }) => {
        try {
            const conversations = await prisma.conversation.findMany({
                where: {
                    bot: {
                        projectId,
                        botType: 'interview'
                    },
                    status: 'COMPLETED',
                },
                orderBy: { completedAt: 'desc' },
                take: limit && limit > 5 ? 5 : (limit || 5), // Hard limit to 5
                select: {
                    id: true,
                    completedAt: true,
                    candidateProfile: true, // Only fetch profile needed
                    sentimentScore: true,
                    analysis: {
                        select: { topicCoverage: true, keyQuotes: true } // keyQuotes instead of summary
                    },
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        where: { role: { not: 'system' } } // Exclude system prompts
                    }
                }
            });

            if (conversations.length === 0) {
                return { message: 'No completed interviews found for this project.' };
            }

            return {
                interviews: conversations.map((c: any) => ({
                    id: c.id,
                    candidateName: (c.candidateProfile as any)?.name || 'Anonimo',
                    date: c.completedAt,
                    sentiment: c.sentimentScore,
                    topicCoverage: c.analysis?.topicCoverage,
                    keyQuotes: c.analysis?.keyQuotes,
                    transcriptPreview: c.messages.map((m: any) => `${m.role}: ${m.content}`).join('\n').substring(0, 1500) + '...'
                }))
            };
        } catch (error: any) {
            console.error('[Copilot Tool] Error fetching transcripts:', error);
            // Return structured error instead of throwing to keep chat alive
            return { error: 'Failed to fetch transcripts', details: 'Si è verificato un errore nel recupero delle interviste.' };
        }
    }
};

export const getChatbotConversationsTool = {
    description: 'Fetch recent chatbot conversation logs and analysis for a specific project. Use this to understand customer questions and issues.',
    parameters: z.object({
        projectId: z.string().describe('The ID of the project to fetch chatbot conversations for'),
        limit: z.number().optional().default(10).describe('Maximum number of conversations to return'),
    }),
    execute: async ({ projectId, limit }: { projectId: string; limit?: number }) => {
        try {
            const conversations = await prisma.conversation.findMany({
                where: {
                    bot: {
                        projectId,
                        botType: 'chatbot'
                    }
                },
                orderBy: { startedAt: 'desc' },
                take: limit && limit > 5 ? 5 : (limit || 5),
                select: {
                    id: true,
                    startedAt: true,
                    sentimentScore: true,
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        take: 20,
                        select: { role: true, content: true }
                    }
                }
            });

            if (conversations.length === 0) {
                return { message: 'No chatbot conversations found for this project.' };
            }

            return {
                conversations: conversations.map((c: any) => ({
                    id: c.id,
                    date: c.startedAt,
                    sentiment: c.sentimentScore,
                    messages: c.messages.map((m: any) => ({
                        role: m.role,
                        content: m.content
                    }))
                }))
            };
        } catch (error: any) {
            console.error('[Copilot Tool] Error fetching chatbot conversations:', error);
            return { error: 'Failed to fetch chatbot conversations', details: 'Si è verificato un errore nel recupero delle conversazioni.' };
        }
    }
};

export const getProjectIntegrationsTool = {
    description: 'Fetch the list of integrations and connections (WordPress, WooCommerce, CMS, Google) for a specific project. Use this to check if a project is connected to external platforms.',
    parameters: z.object({
        projectId: z.string().describe('The ID of the project to check integrations for'),
    }),
    execute: async ({ projectId }: { projectId: string }) => {
        try {
            const [mcpConnections, googleConnection, cmsConnection] = await Promise.all([
                prisma.mCPConnection.findMany({
                    where: {
                        OR: [
                            { projectId },
                            { projectShares: { some: { projectId } } }
                        ]
                    },
                    select: { type: true, status: true, name: true }
                }),
                prisma.googleConnection.findUnique({
                    where: { projectId },
                    select: { ga4Enabled: true, gscEnabled: true }
                }),
                prisma.cMSConnection.findUnique({
                    where: { projectId },
                    select: { status: true, name: true }
                })
            ]);

            return {
                projectId,
                integrations: {
                    mcp: mcpConnections,
                    google: googleConnection ? {
                        ga4: googleConnection.ga4Enabled ? 'ENABLED' : 'DISABLED',
                        gsc: googleConnection.gscEnabled ? 'ENABLED' : 'DISABLED'
                    } : 'NOT_CONFIGURED',
                    cms: cmsConnection ? {
                        status: cmsConnection.status,
                        name: cmsConnection.name
                    } : 'NOT_CONFIGURED'
                },
                setupUrl: `/dashboard/projects/${projectId}/integrations`
            };
        } catch (error: any) {
            console.error('[Copilot Tool] Error fetching integrations:', error);
            return { error: 'Failed to fetch integrations', details: error.message };
        }
    }
};
