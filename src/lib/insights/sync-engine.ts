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
    priorityScore: z.number().min(0).max(100).default(50)
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

        // 5b. Fetch CMS/Website analytics if available
        let websiteAnalytics = null;
        const cmsConnection = await prisma.cMSConnection.findFirst({
            where: {
                project: {
                    organizationId,
                    ...(projectId ? { id: projectId } : {})
                },
                status: { in: ['ACTIVE', 'PARTIAL'] }
            }
        });

        if (cmsConnection) {
            const recentAnalytics = await prisma.websiteAnalytics.findMany({
                where: { connectionId: cmsConnection.id },
                orderBy: { date: 'desc' },
                take: 7
            });

            if (recentAnalytics.length > 0) {
                websiteAnalytics = {
                    avgPageviews: recentAnalytics.reduce((sum, a) => sum + a.pageviews, 0) / recentAnalytics.length,
                    avgBounceRate: recentAnalytics.reduce((sum, a) => sum + a.bounceRate, 0) / recentAnalytics.length,
                    topPages: recentAnalytics[0]?.topPages || [],
                    searchQueries: recentAnalytics[0]?.topSearchQueries || [],
                    lowPerformingPages: (recentAnalytics[0]?.topPages as any[] || [])
                        .filter((p: any) => p.bounceRate > 0.7)
                        .slice(0, 5)
                };
            }
        }

        // 6. Summarize data for LLM with compact identifiers for citations
        const truncate = (value: string, max: number) => (value || '').slice(0, max);
        const limitArray = <T>(arr: T[] | null | undefined, max: number) => (arr || []).slice(0, max);
        const stopwords = new Set([
            'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'di', 'del', 'della', 'dei', 'delle',
            'a', 'al', 'alla', 'ai', 'alle', 'da', 'dal', 'dalla', 'dai', 'dalle', 'in', 'nel', 'nella',
            'su', 'sul', 'sulla', 'per', 'con', 'tra', 'fra', 'che', 'e', 'o', 'ma', 'non', 'piu', 'meno',
            'the', 'and', 'or', 'to', 'of', 'in', 'for', 'with', 'on', 'at', 'by', 'from', 'is', 'are'
        ]);
        const tokenize = (text: string) => {
            return (text || '')
                .toLowerCase()
                .replace(/[^a-z0-9àèéìòùÀÈÉÌÒÙ]+/gi, ' ')
                .split(/\s+/)
                .filter(t => t.length >= 4 && !stopwords.has(t));
        };
        const jaccardScore = (a: string[], b: string[]) => {
            if (a.length === 0 || b.length === 0) return 0;
            const setA = new Set(a);
            const setB = new Set(b);
            let inter = 0;
            for (const t of setA) if (setB.has(t)) inter += 1;
            const union = setA.size + setB.size - inter;
            return union === 0 ? 0 : inter / union;
        };

        const visibilitySummary = limitArray(
            visibilityConfig?.scans[0]?.responses?.map(r => ({
            platform: r.platform,
            responseText: truncate(r.responseText || '', 220),
            brandMentioned: r.brandMentioned,
            competitors: r.competitorPositions
        })) || [],
            6
        );

        // Include conversation IDs and dates (avoid PII in summaries)
        const interviewSummary = limitArray(analyses, 12).map(a => {
            const dateStr = a.conversation?.startedAt
                ? new Date(a.conversation.startedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
                : '';
            const interviewName = a.conversation?.bot?.name || 'Intervista';

            return {
                id: a.conversation?.id?.slice(-4) || 'N/A', // Last 4 chars of ID for citation
                source: `${interviewName} - ${dateStr}`,
                themes: a.themes,
                quotes: limitArray((a.keyQuotes as string[]) || [], 2).map(q => truncate(q || '', 160)),
                sentiment: a.sentiment,
                nps: (a as any).npsScore
            };
        });

        const websiteSummary = limitArray(knowledgeSources, 8).map(s => ({
            title: s.title,
            type: s.type,
            contentSnippet: truncate(s.content || '', 220)
        }));

        const chatbotSummary = limitArray(chatbotAnalytics, 6).map(a => ({
            gapsCount: Array.isArray(a.knowledgeGaps) ? a.knowledgeGaps.length : 0,
            sentiment: a.sentiment,
            clusterCount: Array.isArray(a.questionClusters) ? a.questionClusters.length : 0,
            leads: a.leadsCollected
        }));

        const contentIndex = (knowledgeSources || []).map(s => {
            const contentSnippet = truncate(s.content || '', 500);
            return {
                title: s.title || 'Senza titolo',
                type: s.type,
                tokens: tokenize(`${s.title || ''} ${contentSnippet}`),
                snippet: contentSnippet
            };
        });

        const findContentMatch = (title: string, body: string) => {
            const actionTokens = tokenize(`${title || ''} ${body || ''}`);
            if (actionTokens.length < 4) return null;
            let best: { title: string; type: string; score: number } | null = null;
            for (const item of contentIndex) {
                const score = jaccardScore(actionTokens, item.tokens);
                if (!best || score > best.score) {
                    best = { title: item.title, type: item.type, score };
                }
            }
            if (best && best.score >= 0.38) return best;
            return null;
        };

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
            ⚠️ L'utente non ha ancora definito una visione strategica o una value proposition.
            In questo caso genera SOLO 1-2 suggerimenti mirati a definire vision e value proposition, con domande concrete da fare agli stakeholder.
            Non generare altri suggerimenti operativi finché la strategia non è definita.`;

        const { object } = await generateObject({
            model,
            schema: SyncResultSchema,
            prompt: `Sei un consulente strategico senior specializzato in PMI italiane. Il tuo compito è analizzare i dati raccolti sul brand e generare suggerimenti PRATICI, SPECIFICI e ALLINEATI ALLA VISIONE STRATEGICA.

=============================================================
🎯 CONTESTO STRATEGICO (questo guida OGNI suggerimento)
=============================================================
${strategicContextText}

=============================================================
📊 DATI RACCOLTI DAL BRAND
=============================================================

1️⃣ KNOWLEDGE BASE DEL CHATBOT (cosa risponde il chatbot):
${JSON.stringify(websiteSummary)}

2️⃣ ANALISI CHATBOT (gap, domande frequenti, sentiment):
${JSON.stringify(chatbotSummary)}

3️⃣ FEEDBACK DALLE INTERVISTE (con ID per citazioni):
${JSON.stringify(interviewSummary)}

4️⃣ REPUTAZIONE SUGLI AI (ChatGPT, Claude, Perplexity):
${JSON.stringify(visibilitySummary)}

5️⃣ MENZIONI SU GOOGLE/NEWS:
${serpSummary ? JSON.stringify({
                totalMentions: serpSummary.totalMentions,
                sentimentBreakdown: serpSummary.sentimentBreakdown,
                topCategories: serpSummary.topCategories,
                recentAlerts: serpSummary.recentAlerts
            }) : 'Nessun dato SERP disponibile'}

6️⃣ ANALYTICS SITO WEB (Google Analytics + Search Console):
${websiteAnalytics ? JSON.stringify({
                avgPageviewsGiornalieri: Math.round(websiteAnalytics.avgPageviews),
                bounceRateMedio: (websiteAnalytics.avgBounceRate * 100).toFixed(1) + '%',
                paginePiuVisitate: (websiteAnalytics.topPages as any[]).slice(0, 5),
                queryDiRicerca: (websiteAnalytics.searchQueries as any[]).slice(0, 10),
                pagineConAltoBounce: websiteAnalytics.lowPerformingPages
            }) : 'Dati non disponibili - CMS non connesso o Google Analytics non configurato'}

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
   Genera solo i suggerimenti più impattanti e rilevanti.

7. STRATEGIA MANCANTE:
   Se non c'è visione o value proposition definite, genera SOLO 1-2 suggerimenti per costruirle e fermati.

8. CONTENUTI:
   Per create_content/modify_content cita una KB o una query GSC rilevante. Se il contenuto esiste già, proponi un aggiornamento mirato (non un nuovo contenuto).`,
            temperature: 0.15
        });

        // 8. Save to DB (upsert by topic to avoid duplicates and preserve status)
        const existingInsights = await prisma.crossChannelInsight.findMany({
            where: {
                organizationId,
                ...(projectId ? { projectId } : { projectId: null })
            }
        });
        const existingByTopic = new Map(existingInsights.map(i => [i.topicName, i]));
        const lockedStatuses = new Set(['archived', 'completed', 'dismissed', 'actioned']);
        const normalizeStatus = (status?: string | null) => (status || 'new').toLowerCase();

        const upsertInsight = async (topicName: string, data: any, options?: { forceUpdate?: boolean }) => {
            const existing = existingByTopic.get(topicName);
            if (existing) {
                if (!options?.forceUpdate && lockedStatuses.has(normalizeStatus(existing.status))) {
                    return existing;
                }
                const updated = await prisma.crossChannelInsight.update({
                    where: { id: existing.id },
                    data
                });
                existingByTopic.set(topicName, updated);
                return updated;
            }

            const created = await prisma.crossChannelInsight.create({
                data: {
                    organizationId,
                    projectId: projectId || null,
                    topicName,
                    status: 'new',
                    ...data
                }
            });
            existingByTopic.set(topicName, created);
            return created;
        };

        const savedInsights: any[] = [];

        // Save the summary report as a special record (single, updatable)
        const healthInsight = await upsertInsight("Health Report: Brand & Sito", {
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
                    reasoning: object.healthReport.websiteEffectiveness.feedbackSummary,
                    autoApply: false
                }
            ]
        }, { forceUpdate: true });
        savedInsights.push(healthInsight);

        const seenTopics = new Set<string>();
        for (const rawInsight of object.insights) {
            if (!rawInsight?.topicName || seenTopics.has(rawInsight.topicName)) continue;
            seenTopics.add(rawInsight.topicName);

            const preparedActions = (rawInsight.suggestedActions || []).flatMap((action: any) => {
                const match = findContentMatch(action.title || '', action.body || '');
                if (action.type === 'add_faq' && match) {
                    return [];
                }
                if (action.type === 'create_content' && match) {
                    return [{
                        ...action,
                        type: 'modify_content',
                        target: 'website',
                        title: `Aggiorna contenuto esistente: ${match.title}`,
                        body: `${action.body}\n\nNota: contenuto simile già presente ("${match.title}"). Trasforma il suggerimento in un aggiornamento mirato di quel contenuto.`,
                        validation: { status: 'duplicate', matchTitle: match.title, score: match.score }
                    }];
                }
                return [{
                    ...action,
                    autoApply: ['add_faq', 'add_interview_topic', 'add_visibility_prompt'].includes(action.type),
                    ...(match ? { validation: { status: 'overlap', matchTitle: match.title, score: match.score } } : {})
                }];
            });

            if (preparedActions.length === 0) continue;

            const insight = await upsertInsight(rawInsight.topicName, {
                visibilityData: visibilitySummary as any,
                interviewData: interviewSummary as any,
                chatbotData: chatbotSummary as any,
                crossChannelScore: 100,
                priorityScore: rawInsight.priorityScore,
                suggestedActions: preparedActions as any
            });
            savedInsights.push(insight);
        }

        return {
            insights: savedInsights,
            healthReport: object.healthReport
        };
    }
}
