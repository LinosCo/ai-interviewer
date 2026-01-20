import { prisma } from '@/lib/prisma';
import { getSystemLLM } from '@/lib/visibility/llm-providers';
import { generateObject } from 'ai';
import { z } from 'zod';

const ActionSchema = z.object({
    type: z.enum(['add_faq', 'add_interview_topic', 'add_visibility_prompt', 'create_content', 'modify_content']),
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

const HealthReportSchema = z.object({
    chatbotSatisfaction: z.object({
        score: z.number(), // 0-100
        summary: z.string(),
        trend: z.enum(['improving', 'stable', 'declining'])
    }),
    websiteEffectiveness: z.object({
        score: z.number(),
        feedbackSummary: z.string(),
        contentGaps: z.array(z.string())
    }),
    brandVisibility: z.object({
        score: z.number(),
        competitorInsights: z.string(),
        serpStatus: z.string()
    })
});

const SyncResultSchema = z.object({
    insights: z.array(InsightSchema),
    healthReport: HealthReportSchema
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

        // 2. Fetch Interview themes
        const analyses = await prisma.conversationAnalysis.findMany({
            where: {
                conversation: {
                    bot: { project: { organizationId } },
                    chatbotSession: null
                }
            },
            take: 20,
            orderBy: { createdAt: 'desc' }
        });

        // 3. Fetch Website Content (Knowledge Sources)
        const knowledgeSources = await prisma.knowledgeSource.findMany({
            where: { bot: { project: { organizationId } } },
            take: 15,
            orderBy: { createdAt: 'desc' },
            select: { title: true, type: true, content: true }
        });

        // 4. Fetch Chatbot Analytics
        const chatbotAnalytics = await prisma.chatbotAnalytics.findMany({
            where: { bot: { project: { organizationId } } },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        // 5. Summarize data for LLM
        const visibilitySummary = visibilityConfig?.scans[0]?.responses.map(r => ({
            platform: r.platform,
            responseText: r.responseText.substring(0, 300),
            brandMentioned: r.brandMentioned,
            competitors: r.competitorPositions
        })) || [];

        const interviewSummary = analyses.map(a => ({
            themes: a.themes,
            quotes: (a.keyQuotes as string[] || []).slice(0, 3),
            sentiment: a.sentiment
        }));

        const websiteSummary = knowledgeSources.map(s => ({
            title: s.title,
            type: s.type,
            contentSnippet: s.content.substring(0, 400)
        }));

        const chatbotSummary = chatbotAnalytics.map(a => ({
            gaps: a.knowledgeGaps,
            sentiment: a.sentiment,
            clusters: a.questionClusters,
            leads: a.leadsCollected
        }));

        // 6. Query LLM for Unified Evaluation
        const { model } = await getSystemLLM();
        const { object } = await generateObject({
            model,
            schema: SyncResultSchema,
            prompt: `Sei l'Analista Cross-Channel di Business Tuner. Il tuo compito è valutare l'efficacia del brand e dei contenuti web integrando fonti multiple.

            CONTENT SITO WEB (Conoscenza attuale):
            ${JSON.stringify(websiteSummary)}

            DATI CHATBOT (Sentiment utenti e lacune):
            ${JSON.stringify(chatbotSummary)}

            FEEDBACK INTERVISTE (Feedback su comunicazione/brand):
            ${JSON.stringify(interviewSummary)}

            VISIBILITY TRACKER (Come gli LLM ti posizionano):
            ${JSON.stringify(visibilitySummary)}

            OBIETTIVI DELL'ANALISI:
            1. Valuta la soddisfazione degli utenti del chatbot (punteggio 0-100 basato sul sentiment).
            2. Analizza l'efficacia del sito nel rispondere alle problematiche emerse nelle interviste.
            3. Valuta la presenza del brand negli LLM e coerenza con i contenuti del sito.
            4. Identifica i gap dove gli LLM non ti citano (o ti citano male) NONOSTANTE il contenuto sia presente sul sito.
            5. Suggerisci contenuti da creare (create_content) o modificare (modify_content).

            Restituisci un Health Report e gli Insight dettagliati.`,
            temperature: 0.1
        });

        // 7. Save to DB
        // Save the summary report as a special record
        const healthInsight = await prisma.crossChannelInsight.create({
            data: {
                organizationId,
                topicName: "Health Report: Brand & Sito",
                visibilityData: { report: object.healthReport } as any,
                interviewData: interviewSummary as any,
                chatbotData: chatbotSummary as any,
                crossChannelScore: 100,
                priorityScore: 0,
                suggestedActions: [
                    {
                        type: 'create_content',
                        target: 'website',
                        title: "Analisi Efficacia Brand & Sito",
                        body: `Soddisfazione Chatbot: ${object.healthReport.chatbotSatisfaction.score}%. Efficacia Sito: ${object.healthReport.websiteEffectiveness.score}%. Visibilità Brand: ${object.healthReport.brandVisibility.score}%.`,
                        reasoning: object.healthReport.websiteEffectiveness.feedbackSummary
                    }
                ],
                status: 'new'
            }
        });

        const savedInsights = [healthInsight];
        for (const rawInsight of object.insights) {
            const insight = await prisma.crossChannelInsight.create({
                data: {
                    organizationId,
                    topicName: rawInsight.topicName,
                    visibilityData: visibilitySummary as any,
                    interviewData: interviewSummary as any,
                    chatbotData: chatbotSummary as any,
                    crossChannelScore: 100,
                    priorityScore: rawInsight.priorityScore,
                    suggestedActions: rawInsight.suggestedActions as any,
                    status: 'new'
                }
            });
            savedInsights.push(insight);
        }

        return {
            insights: savedInsights,
            healthReport: object.healthReport
        };
    }
}
