import { prisma } from '@/lib/prisma';
import { getSystemLLM } from '@/lib/visibility/llm-providers';
import { generateObject } from 'ai';
import { z } from 'zod';

const ActionSchema = z.object({
    type: z.enum(['add_faq', 'add_interview_topic', 'add_visibility_prompt', 'create_content']),
    target: z.enum(['chatbot', 'interview', 'visibility', 'website']),
    title: z.string().optional(),
    body: z.string(),
    reasoning: z.string()
});

const InsightSchema = z.object({
    topicName: z.string(),
    reasoning: z.string(),
    suggestedActions: z.array(ActionSchema),
    priorityScore: z.number().min(0).max(100)
});

const MultiInsightSchema = z.object({
    insights: z.array(InsightSchema)
});

export class CrossChannelSyncEngine {
    static async sync(organizationId: string) {
        // 1. Fetch visibility data
        const visibilityConfig = await prisma.visibilityConfig.findUnique({
            where: { organizationId },
            include: {
                scans: {
                    where: { status: 'completed' },
                    orderBy: { completedAt: 'desc' },
                    take: 1,
                    include: { responses: true }
                }
            }
        });

        // 2. Fetch Interview themes (from ConversationAnalysis)
        const analyses = await prisma.conversationAnalysis.findMany({
            where: {
                conversation: {
                    bot: { organizationId },
                    chatbotSession: null // Only interviews
                }
            },
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        // 3. Fetch Chatbot Gaps (from Analytics or specific unanswered questions)
        const chatbotAnalytics = await prisma.chatbotAnalytics.findMany({
            where: {
                bot: { organizationId }
            },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        // 4. Summarize data for LLM
        const visibilitySummary = visibilityConfig?.scans[0]?.responses.map(r => ({
            prompt: r.platform + ": " + r.responseText.substring(0, 100),
            brandMentioned: r.brandMentioned,
            competitors: r.competitorPositions
        })) || [];

        const interviewSummary = analyses.map(a => ({
            themes: a.themes,
            quotes: a.keyQuotes
        }));

        const chatbotSummary = chatbotAnalytics.map(a => ({
            gaps: a.knowledgeGaps,
            clusters: a.questionClusters
        }));

        // 5. Query LLM to find cross-channel insights
        const { model } = await getSystemLLM();
        const { object } = await generateObject({
            model,
            schema: MultiInsightSchema,
            prompt: `Tu sei l'Analista Cross-Channel di Business Tuner. Il tuo compito è trovare correlazioni tra diverse fonti di dati e suggerire azioni concrete per migliorare il posizionamento del brand.
            
            DATI VISIBILITY (Ranking su LLM):
            ${JSON.stringify(visibilitySummary)}
            
            DATI INTERVISTE (Feedback diretti clienti):
            ${JSON.stringify(interviewSummary)}
            
            DATI CHATBOT (Lacune conoscenza e domande frequenti):
            ${JSON.stringify(chatbotSummary)}
            
            Analizza questi dati e identifica i 3-5 macro-temi più urgenti.
            Per ogni tema:
            1. Spiega la correlazione (es: "I clienti chiedono X nelle interviste, ma il chatbot non sa rispondere e gli LLM citano i competitor per questo tema").
            2. Suggerisci azioni specifiche (nuove FAQ, contenuti sito, nuovi prompt di tracking).
            3. Assegna un punteggio di priorità (0-100).`,
            temperature: 0.2
        });

        // 6. Save insights to DB
        const savedInsights = [];
        for (const rawInsight of object.insights) {
            const insight = await prisma.crossChannelInsight.create({
                data: {
                    organizationId,
                    topicName: rawInsight.topicName,
                    visibilityData: visibilitySummary as any,
                    interviewData: interviewSummary as any,
                    chatbotData: chatbotSummary as any,
                    crossChannelScore: 100, // Heuristic for now
                    priorityScore: rawInsight.priorityScore,
                    suggestedActions: rawInsight.suggestedActions as any,
                    status: 'new'
                }
            });
            savedInsights.push(insight);
        }

        return savedInsights;
    }
}
