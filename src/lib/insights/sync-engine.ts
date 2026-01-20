import { prisma } from '@/lib/prisma';
import { getSystemLLM } from '@/lib/visibility/llm-providers';
import { SerpMonitoringEngine } from '@/lib/visibility/serp-monitoring-engine';
import { generateObject } from 'ai';
import { z } from 'zod';

const ActionSchema = z.object({
    type: z.enum(['add_faq', 'add_interview_topic', 'add_visibility_prompt', 'create_content', 'modify_content', 'respond_to_press', 'monitor_competitor']),
    target: z.enum(['chatbot', 'interview', 'visibility', 'website', 'pr', 'serp']),
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
        const visibilityConfig = await prisma.visibilityConfig.findFirst({
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

        // 5. Fetch SERP Monitoring Data (Google News/Search)
        const serpSummary = await SerpMonitoringEngine.getSerpSummaryForInsights(organizationId);

        // 6. Summarize data for LLM
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

        // 7. Query LLM for Unified Evaluation
        const { model } = await getSystemLLM();
        const { object } = await generateObject({
            model,
            schema: SyncResultSchema,
            prompt: `Sei l'Analista Cross-Channel di Business Tuner. Il tuo compito è valutare l'efficacia del brand e dei contenuti web integrando TUTTE le fonti disponibili.

            === FONTI DATI ===

            1. CONTENT SITO WEB (Conoscenza attuale del chatbot):
            ${JSON.stringify(websiteSummary)}

            2. DATI CHATBOT (Sentiment utenti e lacune nella conoscenza):
            ${JSON.stringify(chatbotSummary)}

            3. FEEDBACK INTERVISTE (Feedback diretto su comunicazione/brand):
            ${JSON.stringify(interviewSummary)}

            4. VISIBILITY TRACKER LLM (Come gli LLM ti posizionano nelle risposte):
            ${JSON.stringify(visibilitySummary)}

            5. SERP MONITORING - GOOGLE NEWS/SEARCH (Menzioni recenti del brand su Google):
            ${serpSummary ? JSON.stringify({
                totalMentions: serpSummary.totalMentions,
                sentimentBreakdown: serpSummary.sentimentBreakdown,
                avgImportance: serpSummary.avgImportance,
                topCategories: serpSummary.topCategories,
                recentAlerts: serpSummary.recentAlerts
            }) : 'Nessun dato SERP disponibile'}

            === OBIETTIVI DELL'ANALISI ===

            1. SODDISFAZIONE CHATBOT (0-100): Valuta il sentiment degli utenti che usano il chatbot.

            2. EFFICACIA SITO WEB (0-100): Il sito risponde alle problematiche emerse nelle interviste e colma le lacune del chatbot?

            3. VISIBILITÀ BRAND (0-100): Combina:
               - Come gli LLM ti posizionano (Visibility Tracker)
               - Come appari nelle ricerche Google (SERP Monitoring)
               - Il sentiment generale delle menzioni online

            4. CORRELAZIONI CROSS-CHANNEL:
               - Se i clienti nelle interviste lamentano X, il chatbot sa rispondere a X?
               - Se il sito parla di Y, gli LLM ti citano per Y?
               - Se c'è una notizia negativa su Google, il chatbot/sito sono preparati?

            5. AZIONI SUGGERITE (usa i nuovi tipi se appropriato):
               - create_content / modify_content → per il sito
               - add_faq → per il chatbot
               - add_interview_topic → per raccogliere più feedback
               - add_visibility_prompt → per monitorare nuove query sugli LLM
               - respond_to_press → se ci sono notizie che richiedono una risposta PR
               - monitor_competitor → se i competitor appaiono in contesti rilevanti

            Restituisci un Health Report completo e Insight dettagliati con priorità.`,
            temperature: 0.1
        });

        // 8. Save to DB
        // Save the summary report as a special record
        const healthInsight = await prisma.crossChannelInsight.create({
            data: {
                organizationId,
                topicName: "Health Report: Brand & Sito",
                visibilityData: {
                    report: object.healthReport,
                    serpSummary: serpSummary || null
                } as any,
                interviewData: interviewSummary as any,
                chatbotData: chatbotSummary as any,
                crossChannelScore: 100,
                priorityScore: 0,
                suggestedActions: [
                    {
                        type: 'create_content',
                        target: 'website',
                        title: "Analisi Efficacia Brand & Sito",
                        body: `Soddisfazione Chatbot: ${object.healthReport.chatbotSatisfaction.score}%. Efficacia Sito: ${object.healthReport.websiteEffectiveness.score}%. Visibilità Brand: ${object.healthReport.brandVisibility.score}%.${serpSummary ? ` Menzioni Google: ${serpSummary.totalMentions} (${serpSummary.sentimentBreakdown.positive} positive, ${serpSummary.sentimentBreakdown.negative} negative).` : ''}`,
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
