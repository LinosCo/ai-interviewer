import { prisma } from '@/lib/prisma';
import { getSystemLLM } from '@/lib/visibility/llm-providers';
import { SerpMonitoringEngine } from '@/lib/visibility/serp-monitoring-engine';
import { generateObject } from 'ai';
import { z } from 'zod';

const ActionSchema = z.object({
    // Operational actions (can be automated)
    // - add_faq: Add FAQ to chatbot knowledge base
    // - add_interview_topic: Add new interview topic to collect more feedback
    // - add_visibility_prompt: Add new monitoring query
    // Strategic actions (require consultation)
    // - create_content / modify_content: Website content changes
    // - respond_to_press: PR response needed
    // - monitor_competitor: Competitor activity detected
    // - strategic_recommendation: High-level business strategy suggestion
    // - pricing_change: Pricing or offer adjustments
    // - product_improvement: Product/service enhancement ideas
    // - marketing_campaign: Marketing initiative suggestions
    type: z.enum([
        'add_faq', 'add_interview_topic', 'add_visibility_prompt',
        'create_content', 'modify_content', 'respond_to_press', 'monitor_competitor',
        'strategic_recommendation', 'pricing_change', 'product_improvement', 'marketing_campaign'
    ]),
    target: z.enum(['chatbot', 'interview', 'visibility', 'website', 'pr', 'serp', 'strategy', 'product', 'marketing']),
    title: z.string().describe('Titolo breve e chiaro dell\'azione suggerita'),
    body: z.string().describe('Descrizione dettagliata dell\'azione da compiere'),
    reasoning: z.string().describe('Spiegazione del perché questa azione è importante basata sui dati raccolti')
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
        // 0. Fetch Organization strategy
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { strategicVision: true, valueProposition: true }
        });

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

        // 2-6 ... (skipping for BREVITY in replacement targetContent/content)

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
        const visibilitySummary = visibilityConfig?.scans[0]?.responses?.map(r => ({
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
            prompt: `Sei un consulente strategico per PMI. Analizza i dati raccolti e fornisci suggerimenti PRATICI e AZIONABILI.

            === STRATEGIA AZIENDALE (Il tuo faro) ===
            Visione Strategica: ${org?.strategicVision || 'Nessuna visione specifica definita'}
            Value Proposition: ${org?.valueProposition || 'Nessuna value proposition specifica definita'}

            === DATI DISPONIBILI ===

            1. CONTENUTI DEL SITO (cosa sa il chatbot):
            ${JSON.stringify(websiteSummary)}

            2. DOMANDE DEI CLIENTI AL CHATBOT (cosa chiedono e cosa manca):
            ${JSON.stringify(chatbotSummary)}

            3. FEEDBACK DALLE INTERVISTE (cosa pensano i clienti):
            ${JSON.stringify(interviewSummary)}

            4. REPUTAZIONE ONLINE SU AI (ChatGPT, Claude, etc.):
            ${JSON.stringify(visibilitySummary)}

            5. MENZIONI SU GOOGLE NEWS/SEARCH:
            ${serpSummary ? JSON.stringify({
                totalMentions: serpSummary.totalMentions,
                sentimentBreakdown: serpSummary.sentimentBreakdown,
                avgImportance: serpSummary.avgImportance,
                topCategories: serpSummary.topCategories,
                recentAlerts: serpSummary.recentAlerts
            }) : 'Nessun dato SERP disponibile'}

            === ANALIZZA E SUGGERISCI ===

            HEALTH REPORT:
            1. SODDISFAZIONE (0-100): Come si sentono i clienti che usano il chatbot?
            2. EFFICACIA SITO (0-100): Il sito risponde ai bisogni emersi dai feedback?
            3. REPUTAZIONE ONLINE (0-100): Come ti percepiscono online (AI + Google)?

            SUGGERIMENTI - Genera insight con azioni di DUE tipi:

            A) AZIONI OPERATIVE (applicabili subito):
               - add_faq → Aggiungi risposta al chatbot (es. "I clienti chiedono spesso X, aggiungi FAQ")
               - add_interview_topic → Raccogli più feedback su un tema specifico
               - add_visibility_prompt → Monitora una nuova query sugli AI

            B) AZIONI STRATEGICHE (richiedono consulenza):
               - product_improvement → Miglioramenti al prodotto/servizio
                 Es: "I clienti lamentano che il checkout è lento → considera di semplificarlo"
               - pricing_change → Revisione prezzi/offerte
                 Es: "Molti chiedono sconti volume → valuta un piano business"
               - marketing_campaign → Idee per campagne marketing
                 Es: "Il competitor X è citato più di te su ChatGPT → considera una campagna di content marketing"
               - strategic_recommendation → Consigli strategici generali
                 Es: "Il sentiment sulle recensioni sta calando → analizza le cause"
               - create_content / modify_content → Modifiche importanti al sito
               - respond_to_press → Risposta a notizie/articoli
               - monitor_competitor → Alert su attività competitor

            IMPORTANTE:
            - Ogni insight deve avere ALMENO un'azione operativa E una strategica se possibile
            - I titoli devono essere chiari e in italiano (es. "Aggiungi FAQ sui prezzi" non "add_faq")
            - Il body deve spiegare COSA fare concretamente
            - Il reasoning deve spiegare PERCHÉ, citando i dati specifici
            - Priorità alta (80-100) per problemi urgenti o opportunità immediate
            - Priorità media (50-79) per miglioramenti importanti
            - Priorità bassa (0-49) per ottimizzazioni nice-to-have`,
            temperature: 0.2
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
