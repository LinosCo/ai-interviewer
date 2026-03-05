import { prisma } from '@/lib/prisma';
import { CMSSuggestionGenerator } from './suggestion-generator';
import type { SuggestionInput } from './suggestion-generator';
import { CMSSuggestionType } from '@prisma/client';

const GAPS_PER_BATCH = 5;
const MAX_GAPS_PER_PROJECT = 20;

/**
 * Maps unresolved KnowledgeGap records into CMSSuggestion entries.
 *
 * Flow:
 *   1. Find chatbot bots for a project
 *   2. Collect unresolved high/medium-priority knowledge gaps
 *   3. Batch them into groups of GAPS_PER_BATCH
 *   4. Generate a CMS suggestion per batch (CREATE_FAQ or CREATE_PAGE)
 *   5. Mark processed gaps as 'bridged' to prevent re-processing
 */
export class ChatbotGapToContentBridge {
    /**
     * Process unresolved knowledge gaps for a single project.
     * Returns the number of CMS suggestions created.
     */
    static async processGapsForProject(projectId: string): Promise<number> {
        const bots = await prisma.bot.findMany({
            where: { projectId, botType: 'chatbot' },
            select: { id: true },
        });
        if (bots.length === 0) return 0;

        const botIds = bots.map((b) => b.id);

        const gaps = await prisma.knowledgeGap.findMany({
            where: {
                botId: { in: botIds },
                status: { notIn: ['resolved', 'completed', 'dismissed', 'bridged'] },
                priority: { in: ['high', 'medium'] },
            },
            orderBy: { createdAt: 'desc' },
            take: MAX_GAPS_PER_PROJECT,
        });

        if (gaps.length === 0) return 0;

        // Sort high-priority first
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        gaps.sort(
            (a, b) =>
                (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
        );

        // Find a CMS connection for the project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                newCmsConnection: true,
                cmsShares: {
                    include: { connection: true },
                    take: 1,
                },
            } as any,
        });

        const connection =
            (project as any)?.newCmsConnection ||
            (project as any)?.cmsShares?.[0]?.connection;

        if (!connection?.id) return 0;

        // Process gaps in batches
        let suggestionsCreated = 0;

        for (let i = 0; i < gaps.length; i += GAPS_PER_BATCH) {
            const batch = gaps.slice(i, i + GAPS_PER_BATCH);

            try {
                const type = this.inferSuggestionType(batch);
                const signals = this.buildSignalsFromGaps(batch);

                await CMSSuggestionGenerator.generateSuggestion({
                    connectionId: connection.id,
                    projectId,
                    type,
                    signals,
                });

                suggestionsCreated++;

                await prisma.knowledgeGap.updateMany({
                    where: { id: { in: batch.map((g) => g.id) } },
                    data: { status: 'bridged' },
                });
            } catch (err) {
                console.error(
                    '[GapBridge] Failed to process batch:',
                    err instanceof Error ? err.message : err
                );
            }
        }

        return suggestionsCreated;
    }

    /**
     * Process all projects that have chatbot bots with unresolved gaps.
     */
    static async processAllProjects(): Promise<{
        projectsProcessed: number;
        suggestionsCreated: number;
    }> {
        const projects = await prisma.project.findMany({
            where: {
                bots: { some: { botType: 'chatbot' } },
            },
            select: { id: true },
        });

        let suggestionsCreated = 0;
        let projectsProcessed = 0;

        for (const project of projects) {
            try {
                const count = await this.processGapsForProject(project.id);
                if (count > 0) {
                    suggestionsCreated += count;
                    projectsProcessed++;
                }
            } catch (err) {
                console.error(
                    `[GapBridge] Error for project ${project.id}:`,
                    err instanceof Error ? err.message : err
                );
            }
        }

        return { projectsProcessed, suggestionsCreated };
    }

    /**
     * Infer the best CMSSuggestionType for a batch of gaps.
     * FAQ is preferred since gaps represent questions the chatbot couldn't answer.
     */
    private static inferSuggestionType(
        gaps: { topic: string; suggestedFaq: unknown }[]
    ): CMSSuggestionType {
        const hasFaq = gaps.some((g) => {
            const faq = g.suggestedFaq as { question?: string } | null;
            return faq?.question;
        });
        return hasFaq ? 'CREATE_FAQ' : 'CREATE_PAGE';
    }

    /**
     * Build the signals object from a batch of knowledge gaps.
     */
    private static buildSignalsFromGaps(
        gaps: {
            topic: string;
            priority: string;
            evidence: unknown;
            suggestedFaq: unknown;
        }[]
    ): SuggestionInput['signals'] {
        const chatbotQuestions = gaps.map((gap) => {
            const faq = gap.suggestedFaq as { question?: string } | null;
            const evidence = gap.evidence as { fallbackCount?: number; count?: number } | null;
            return {
                question: faq?.question || gap.topic,
                count: evidence?.fallbackCount ?? evidence?.count ?? 1,
            };
        });

        const topicList = gaps.map((g) => g.topic).join(', ');

        return {
            chatbotQuestions,
            strategyAlignment: `Risolve ${gaps.length} knowledge gap${gaps.length > 1 ? 's' : ''} identificati dal chatbot su: ${topicList}`,
            evidencePoints: gaps.map(
                (g) => `gap:${g.topic}:priority=${g.priority}`
            ),
        };
    }
}
