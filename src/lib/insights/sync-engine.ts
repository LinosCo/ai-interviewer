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
    static async sync(organizationId: string, projectId?: string) {
        // 0. Fetch strategic context (project-level if available, otherwise org-level)
        let strategicVision: string | null = null;
        let valueProposition: string | null = null;

        if (projectId) {
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                select: { strategicVision: true, valueProposition: true }
            });
            strategicVision = project?.strategicVision || null;
            valueProposition = project?.valueProposition || null;
        }

        // Fallback to org-level if project doesn't have strategy
        if (!strategicVision && !valueProposition) {
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: { strategicVision: true, valueProposition: true }
            });
            strategicVision = org?.strategicVision || null;
            valueProposition = org?.valueProposition || null;
        }

        // 1. Fetch visibility data (filter by project if provided)
        const visibilityConfig = await prisma.visibilityConfig.findFirst({
            where: {
                organizationId,
                ...(projectId ? { projectId } : {})
            },
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

        // 2. Fetch Interview themes with conversation details for citations
        const analyses = await prisma.conversationAnalysis.findMany({
            where: {
                conversation: {
                    bot: {
                        project: {
                            organizationId,
                            ...(projectId ? { id: projectId } : {})
                        }
                    },
                    chatbotSession: null
                }
            },
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
                conversation: {
                    select: {
                        id: true,
                        candidateProfile: true,
                        startedAt: true,
                        bot: {
                            select: { name: true }
                        }
                    }
                }
            }
        });

        // 3. Fetch Website Content (Knowledge Sources)
        const knowledgeSources = await prisma.knowledgeSource.findMany({
            where: {
                bot: {
                    project: {
                        organizationId,
                        ...(projectId ? { id: projectId } : {})
                    }
                }
            },
            take: 15,
            orderBy: { createdAt: 'desc' },
            select: { title: true, type: true, content: true }
        });

        // 4. Fetch Chatbot Analytics
        const chatbotAnalytics = await prisma.chatbotAnalytics.findMany({
            where: {
                bot: {
                    project: {
                        organizationId,
                        ...(projectId ? { id: projectId } : {})
                    }
                }
            },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        // 5. Fetch SERP Monitoring Data (Google News/Search)
        const serpSummary = await SerpMonitoringEngine.getSerpSummaryForInsights(organizationId);

        // 6. Summarize data for LLM with specific identifiers for citations
        const visibilitySummary = visibilityConfig?.scans[0]?.responses?.map(r => ({
            platform: r.platform,
            responseText: r.responseText.substring(0, 300),
            brandMentioned: r.brandMentioned,
            competitors: r.competitorPositions
        })) || [];

        // Include conversation IDs, dates, and candidate names for specific citations
        const interviewSummary = analyses.map(a => {
            const candidate = a.conversation?.candidateProfile as any;
            const candidateName = candidate?.nome || candidate?.name || 'Anonimo';
            const candidateCompany = candidate?.azienda || candidate?.company || '';
            const dateStr = a.conversation?.startedAt
                ? new Date(a.conversation.startedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
                : '';
            const interviewName = a.conversation?.bot?.name || 'Intervista';

            return {
                id: a.conversation?.id?.slice(-4) || 'N/A', // Last 4 chars of ID for citation
                source: `${interviewName} - ${candidateName}${candidateCompany ? ` (${candidateCompany})` : ''} - ${dateStr}`,
                themes: a.themes,
                quotes: (a.keyQuotes as string[] || []).slice(0, 3),
                sentiment: a.sentiment,
                nps: (a as any).npsScore
            };
        });

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

        // Build a strong strategic context for the LLM
        const hasStrategicContext = strategicVision || valueProposition;
        const strategicContextText = hasStrategicContext
            ? `
            🎯 VISIONE STRATEGICA del Brand:
            "${strategicVision}"

            💎 VALUE PROPOSITION:
            "${valueProposition}"

            ⚠️ IMPORTANTE: Ogni suggerimento DEVE essere direttamente collegato a questa visione.
            Se un suggerimento non supporta la visione strategica, NON includerlo.`
            : `
            ⚠️ L'utente non ha ancora definito una visione strategica.
            Fornisci suggerimenti generali basati sui dati disponibili, ma invitalo a definire una vision.`;

        const { object } = await generateObject({
            model,
            schema: SyncResultSchema,
            prompt: `Sei un consulente strategico senior specializzato in PMI italiane. Il tuo compito è analizzare TUTTI i dati raccolti sul brand e generare suggerimenti PRATICI, SPECIFICI e ALLINEATI ALLA VISIONE STRATEGICA.

=============================================================
🎯 CONTESTO STRATEGICO (questo guida OGNI suggerimento)
=============================================================
${strategicContextText}

=============================================================
📊 DATI RACCOLTI DAL BRAND
=============================================================

1️⃣ KNOWLEDGE BASE DEL CHATBOT (cosa risponde il chatbot):
${JSON.stringify(websiteSummary, null, 2)}

2️⃣ ANALISI CHATBOT (gap, domande frequenti, sentiment):
${JSON.stringify(chatbotSummary, null, 2)}

3️⃣ FEEDBACK DALLE INTERVISTE (con ID per citazioni):
${JSON.stringify(interviewSummary, null, 2)}

4️⃣ REPUTAZIONE SUGLI AI (ChatGPT, Claude, Perplexity):
${JSON.stringify(visibilitySummary, null, 2)}

5️⃣ MENZIONI SU GOOGLE/NEWS:
${serpSummary ? JSON.stringify({
                totalMentions: serpSummary.totalMentions,
                sentimentBreakdown: serpSummary.sentimentBreakdown,
                topCategories: serpSummary.topCategories,
                recentAlerts: serpSummary.recentAlerts
            }, null, 2) : 'Nessun dato SERP disponibile'}

=============================================================
📈 HEALTH REPORT RICHIESTO
=============================================================
Valuta queste 3 metriche (0-100) basandoti sui dati:

1. SODDISFAZIONE CLIENTI: Come percepiscono il brand? (dagli interviste + chatbot)
2. EFFICACIA COMUNICAZIONE: Il sito/chatbot risponde ai bisogni reali?
3. REPUTAZIONE ONLINE: Come si posiziona vs competitor sugli AI e Google?

=============================================================
🔧 TIPI DI AZIONI DA GENERARE
=============================================================

AZIONI AUTOMATIZZABILI (l'utente può applicarle con un click):
• add_faq → Aggiungi FAQ al chatbot
• add_interview_topic → Aggiungi domanda/tema alle interviste

AZIONI CHE RICHIEDONO CONSULENZA (l'utente può richiedere supporto):
• product_improvement → Miglioramento prodotto/servizio
• pricing_change → Revisione pricing/offerte
• marketing_campaign → Campagna marketing
• strategic_recommendation → Consiglio strategico
• create_content → Creazione contenuto importante
• modify_content → Modifica contenuto esistente
• respond_to_press → Risposta a notizie/articoli
• monitor_competitor → Alert competitor

=============================================================
⚠️ REGOLE OBBLIGATORIE
=============================================================

1. COLLEGAMENTO ALLA VISIONE:
   Ogni suggerimento DEVE spiegare come supporta la visione strategica.
   ❌ "Migliora i social"
   ✓ "Per raggiungere l'obiettivo di 'diventare leader nel settore X', pubblica un case study sul cliente Y che ha ottenuto Z risultati"

2. CITAZIONI CON FONTE:
   Ogni body DEVE citare la fonte specifica dei dati.
   ✓ "Dall'intervista #${interviewSummary[0]?.id || 'XXXX'} (${interviewSummary[0]?.source || 'cliente'}): '[citazione]'"
   ✓ "Il chatbot ha ricevuto N domande su 'argomento X' → gap nella knowledge base"
   ✓ "Su ChatGPT, il brand è menzionato nel X% delle risposte vs competitor Y al Z%"

3. AZIONI CONCRETE:
   Il body deve dire ESATTAMENTE cosa fare, non suggerimenti vaghi.
   ❌ "Migliora la comunicazione del pricing"
   ✓ "Aggiungi al chatbot la FAQ: 'Quanto costa?' → Risposta consigliata: 'I piani partono da €99/mese. Offriamo 14 giorni gratis senza carta.'"

4. REASONING CON NUMERI:
   Spiega PERCHÉ con dati numerici.
   ✓ "5 clienti su 8 intervistati lamentano tempi di risposta lenti → priorità alta"
   ✓ "Sentiment negativo 40% su Google News questa settimana → intervenire"

5. PRIORITÀ CORRETTA:
   90-100: Crisi / opportunità immediata (es. articolo negativo, competitor che ti supera)
   70-89: Importante per la vision (es. gap critico nella knowledge)
   50-69: Miglioramento significativo
   30-49: Ottimizzazione
   0-29: Nice-to-have

6. MAX 5-7 INSIGHTS:
   Genera solo i suggerimenti più impattanti e rilevanti.`,
            temperature: 0.15
        });

        // 8. Save to DB
        // Save the summary report as a special record
        const healthInsight = await prisma.crossChannelInsight.create({
            data: {
                organizationId,
                projectId: projectId || null,
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
                    projectId: projectId || null,
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
