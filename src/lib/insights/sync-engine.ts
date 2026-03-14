import { prisma } from '@/lib/prisma';
import { isMissingPrismaTable } from '@/lib/prisma-table-errors';
import { getSystemLLM } from '@/lib/visibility/llm-providers';
import { SerpMonitoringEngine } from '@/lib/visibility/serp-monitoring-engine';
import { CONTENT_KIND_LABELS, type ContentKind } from '@/lib/cms/content-kinds';
import { buildInsightActionMetadata } from '@/lib/insights/action-metadata';
import { ProjectTipService } from '@/lib/projects/project-tip.service';
import { generateObject } from 'ai';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Optimization B: TTL in-memory cache (15-minute window)
// Resets on cold start — acceptable for serverless; prevents LLM hammering.
// ---------------------------------------------------------------------------
interface SyncResult {
    insights: any[];
    healthReport: any;
}
const syncCache = new Map<string, { result: SyncResult; ts: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Optimization A: compact summarizers — replace large JSON.stringify blobs
// Each helper picks only the 3-5 most signal-rich fields and caps strings.
// ---------------------------------------------------------------------------

/** Truncate a string to `max` chars, appending "…" if cut. */
function trunc(value: string | null | undefined, max: number): string {
    const s = (value ?? '').trim();
    return s.length > max ? s.slice(0, max) + '…' : s;
}

/**
 * Serialize an array compactly for LLM consumption.
 * Each element is rendered as a single YAML-ish line so the model can parse
 * it without the overhead of nested JSON braces/commas.
 */
function summarizeWebsite(items: Array<{ title: string; type: string; contentSnippet: string }>): string {
    if (!items.length) return 'Nessuna fonte';
    return items.map(s =>
        `• [${s.type}] ${trunc(s.title, 60)}: ${trunc(s.contentSnippet, 150)}`
    ).join('\n');
}

function summarizeChatbot(items: Array<{ gapsCount: number; sentiment: any; clusterCount: number; leads: any }>): string {
    if (!items.length) return 'Nessun dato chatbot';
    return items.map((a, i) =>
        `• Bot ${i + 1}: gap=${a.gapsCount}, cluster=${a.clusterCount}, lead=${a.leads ?? 0}, sentiment=${trunc(String(a.sentiment ?? ''), 40)}`
    ).join('\n');
}

function summarizeInterviews(items: Array<{
    id: string; source: string; themes: any; quotes: string[]; sentiment: any; nps: any;
}>): string {
    if (!items.length) return 'Nessuna intervista';
    return items.map(a => {
        const themes = Array.isArray(a.themes) ? a.themes.slice(0, 3).join(', ') : trunc(String(a.themes ?? ''), 80);
        const quote = a.quotes?.[0] ? `"${trunc(a.quotes[0], 130)}"` : '';
        return `• #${a.id} (${a.source}) | temi: ${themes} | sentiment: ${a.sentiment ?? '?'} | nps: ${a.nps ?? '?'} ${quote ? `| citazione: ${quote}` : ''}`;
    }).join('\n');
}

function summarizeVisibility(items: Array<{
    platform: string; responseText: string; brandMentioned: any; competitors: any;
}>): string {
    if (!items.length) return 'Nessun dato visibilità';
    return items.map(r =>
        `• ${r.platform}: brand_menzionato=${r.brandMentioned ?? '?'} | "${trunc(r.responseText, 150)}"`
    ).join('\n');
}

function summarizeSerp(serp: {
    totalMentions: number;
    sentimentBreakdown: { positive: number; negative: number; neutral?: number };
    topCategories: any[];
    recentAlerts: any[];
} | null): string {
    if (!serp) return 'Nessun dato SERP disponibile';
    const cats = (serp.topCategories ?? []).slice(0, 3).map((c: any) => String(c)).join(', ');
    const alerts = (serp.recentAlerts ?? []).slice(0, 2).map((a: any) => trunc(String(a?.title ?? a), 80)).join(' | ');
    return `menzioni=${serp.totalMentions}, pos=${serp.sentimentBreakdown.positive}, neg=${serp.sentimentBreakdown.negative}` +
        (cats ? `, categorie: ${cats}` : '') +
        (alerts ? `, alert: ${alerts}` : '');
}

function summarizeWebAnalytics(wa: {
    avgPageviews: number;
    avgBounceRate: number;
    topPages: any[];
    searchQueries: any[];
    lowPerformingPages: any[];
} | null): string {
    if (!wa) return 'Dati non disponibili - CMS non connesso o Google Analytics non configurato';
    const pages = (wa.topPages as any[]).slice(0, 3).map((p: any) => trunc(String(p?.path ?? p), 50)).join(', ');
    const queries = (wa.searchQueries as any[]).slice(0, 5).map((q: any) => trunc(String(q?.query ?? q), 40)).join(', ');
    const bounce = (wa.avgBounceRate * 100).toFixed(1);
    return `pageview_medi=${Math.round(wa.avgPageviews)}/giorno, bounce=${bounce}%` +
        (pages ? `, top_pagine: ${pages}` : '') +
        (queries ? `, query_ricerca: ${queries}` : '');
}

// ---------------------------------------------------------------------------
// Zod Schemas (unchanged)
// ---------------------------------------------------------------------------

const ActionSchema = z.object({
    // Potentially automatable actions (only when required integrations are available)
    // - add_faq: Add FAQ to chatbot knowledge base
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
    reasoning: z.string().describe('Spiegazione del perché questa azione è importante basata sui dati raccolti'),
    strategicAlignment: z.string().describe('Come questa azione supporta visione strategica e value proposition'),
    evidence: z.array(z.object({
        sourceType: z.enum(['interview', 'chatbot', 'visibility', 'serp', 'analytics', 'kb', 'strategy', 'site_analysis']),
        sourceRef: z.string().describe('Riferimento sintetico della fonte: es. interview#12ab, gsc:query=..., llm:ChatGPT'),
        detail: z.string().describe('Evidenza concreta con numeri o pattern osservato')
    })).min(1).max(4),
    coordination: z.string().optional().describe('Come coordinare questa azione con altri canali (sito/social/interviste/PR)')
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
    static async sync(organizationId: string, projectId?: string): Promise<SyncResult> {
        // ---------------------------------------------------------------------------
        // Optimization B: return cached result if still fresh
        // ---------------------------------------------------------------------------
        const cacheKey = `${organizationId}::${projectId ?? '__org__'}`;
        const cached = syncCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            return cached.result;
        }

        // 0. Fetch strategic context (project-level if available, otherwise org-level)
        let strategicVision: string | null = null;
        let valueProposition: string | null = null;
        let strategicPlan: string | null = null;

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                strategicVision: true,
                valueProposition: true,
                platformSettings: {
                    select: {
                        strategicPlan: true
                    }
                }
            }
        });

        strategicVision = org?.strategicVision || null;
        valueProposition = org?.valueProposition || null;
        strategicPlan = org?.platformSettings?.strategicPlan || null;

        if (projectId) {
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                select: { strategicVision: true, valueProposition: true }
            });
            strategicVision = project?.strategicVision || strategicVision;
            valueProposition = project?.valueProposition || valueProposition;
        }

        // 1. Fetch visibility data (filter by project if provided)
        let visibilityConfig: any = null;
        try {
            visibilityConfig = await prisma.visibilityConfig.findFirst({
                where: {
                    organizationId,
                    ...(projectId ? {
                        OR: [
                            { projectId },
                            { projectShares: { some: { projectId } } }
                        ]
                    } : {})
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
        } catch (err: any) {
            if (err?.code !== 'P2021') throw err;
            // Fallback for missing ProjectVisibilityConfig table
            visibilityConfig = await prisma.visibilityConfig.findFirst({
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
        }

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
        const serpSummary = await SerpMonitoringEngine.getSerpSummaryForInsights(organizationId, projectId);

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
                    topPages: (recentAnalytics[0]?.topPages || []) as any[],
                    searchQueries: (recentAnalytics[0]?.topSearchQueries || []) as any[],
                    lowPerformingPages: (recentAnalytics[0]?.topPages as any[] || [])
                        .filter((p: any) => p.bounceRate > 0.7)
                        .slice(0, 5)
                };
            }
        }

        const hasChatbotInScope = (await prisma.bot.count({
            where: {
                botType: 'chatbot',
                project: {
                    organizationId,
                    ...(projectId ? { id: projectId } : {})
                }
            }
        })) > 0;
        const canAutoPublishToCms = Boolean(cmsConnection && ['ACTIVE', 'PARTIAL'].includes(cmsConnection.status));
        const enabledRoutingKinds = projectId
            ? new Set(
                (await prisma.tipRoutingRule.findMany({
                    where: { projectId, enabled: true },
                    select: { contentKind: true }
                })).map((rule) => rule.contentKind as ContentKind)
            )
            : new Set<ContentKind>();
        const routingKindsSummary = enabledRoutingKinds.size > 0
            ? Array.from(enabledRoutingKinds)
                .map(kind => `${CONTENT_KIND_LABELS[kind] || kind} (${kind})`)
                .join(', ')
            : 'Nessuna regola di routing attiva';

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
            (visibilityConfig?.scans[0]?.responses as any[])?.map((r: any) => ({
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
            title: s.title || '',
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

        const sourceEvidenceCatalog = [
            'INTERVISTE:',
            interviewSummary.length > 0
                ? interviewSummary.slice(0, 6).map((i) =>
                    `- interview#${i.id}: ${i.source}; temi=${Array.isArray(i.themes) ? i.themes.slice(0, 2).join(', ') : String(i.themes || '')}; quote=${(i.quotes || []).slice(0, 1).join(' | ')}`
                ).join('\n')
                : '- nessuna intervista',
            'CHATBOT:',
            chatbotSummary.length > 0
                ? chatbotSummary.slice(0, 6).map((c, idx) =>
                    `- chatbot#${idx + 1}: gaps=${c.gapsCount}; cluster=${c.clusterCount}; leads=${c.leads ?? 0}; sentiment=${String(c.sentiment ?? 'n/d')}`
                ).join('\n')
                : '- nessun dato chatbot',
            'VISIBILITA LLM:',
            visibilitySummary.length > 0
                ? visibilitySummary.slice(0, 6).map((v, idx) =>
                    `- llm#${idx + 1}:${v.platform}; brandMentioned=${String(v.brandMentioned)}; excerpt=${trunc(v.responseText || '', 90)}`
                ).join('\n')
                : '- nessun dato visibilita',
            'SERP:',
            serpSummary
                ? `- serp: mentioni=${serpSummary.totalMentions}; positive=${serpSummary.sentimentBreakdown.positive}; negative=${serpSummary.sentimentBreakdown.negative}`
                : '- nessun dato serp',
            'ANALYTICS:',
            websiteAnalytics
                ? `- analytics: pageviews_medi=${Math.round(websiteAnalytics.avgPageviews || 0)}; bounce=${((websiteAnalytics.avgBounceRate || 0) * 100).toFixed(1)}%; top_queries=${((websiteAnalytics.searchQueries || []) as any[]).slice(0, 3).map((q: any) => String(q?.query || q)).join(', ')}`
                : '- analytics non disponibili',
            'KNOWLEDGE BASE:',
            websiteSummary.length > 0
                ? websiteSummary.slice(0, 6).map((k) => `- kb:${k.type}:${trunc(k.title, 50)}`).join('\n')
                : '- nessuna fonte kb',
        ].join('\n');

        // 7. Query LLM for Unified Evaluation
        const { model } = await getSystemLLM();

        // Build a strong strategic context for the LLM
        const hasStrategicContext = strategicVision || valueProposition || strategicPlan;
        const strategicContextText = hasStrategicContext
            ? `
            🎯 VISIONE STRATEGICA del Brand:
            "${strategicVision}"

            💎 VALUE PROPOSITION:
            "${valueProposition}"

            🧭 PIANO STRATEGICO COPILOT:
            "${strategicPlan}"

            ⚠️ IMPORTANTE: Ogni suggerimento DEVE essere direttamente collegato a questa visione.
            Se un suggerimento non supporta la visione strategica, NON includerlo.`
            : `
            ⚠️ L'utente non ha ancora definito visione, value proposition e piano strategico.
            In questo caso genera SOLO 1-2 suggerimenti mirati a definire questi elementi con domande concrete da fare agli stakeholder.
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
${summarizeWebsite(websiteSummary)}

2️⃣ ANALISI CHATBOT (gap, domande frequenti, sentiment):
${summarizeChatbot(chatbotSummary)}

3️⃣ FEEDBACK DALLE INTERVISTE (con ID per citazioni):
${summarizeInterviews(interviewSummary)}

4️⃣ REPUTAZIONE SUGLI AI (ChatGPT, Claude, Perplexity):
${summarizeVisibility(visibilitySummary)}

5️⃣ MENZIONI SU GOOGLE/NEWS:
${summarizeSerp(serpSummary)}

6️⃣ ANALYTICS SITO WEB (Google Analytics + Search Console):
${summarizeWebAnalytics(websiteAnalytics)}

=============================================================
📚 CATALOGO FONTI PER EVIDENZE (usa questi riferimenti nei tips)
=============================================================
${sourceEvidenceCatalog}

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

6. NUMERO INSIGHTS:
   Con strategia definita genera 6-10 insights, ognuno con almeno 1 azione implementabile.
   Se i dati sono pochi, genera meno ma non sotto 3.

7. STRATEGIA MANCANTE:
   Se non c'è visione o value proposition definite, genera SOLO 1-2 suggerimenti per costruirle e fermati.

8. CONTENUTI:
   Per create_content/modify_content cita una KB o una query GSC rilevante. Se il contenuto esiste già, proponi un aggiornamento mirato (non un nuovo contenuto).

9. AUTOMAZIONI E ROUTING:
   Preferisci azioni già instradabili sulla piattaforma.
   Routing disponibile nel progetto: ${routingKindsSummary}.
   Quando proponi create_content/modify_content, specifica un output concreto pronto da trasformare in bozza (es. titolo pagina/articolo + struttura + CTA).

10. EVIDENZE STRUTTURATE OBBLIGATORIE:
   Ogni action deve compilare il campo evidence con almeno 2 fonti quando possibile (minimo 1 solo se davvero c'e scarsita dati).
   Ogni evidenza deve avere sourceType, sourceRef e detail con dati concreti.

11. COERENZA STRATEGICA E MULTI-CANALE:
   Per insights con priorita >= 70, genera almeno 2 azioni coordinate su canali diversi (es. sito + social, sito + interviste, sito + PR).
   Usa il campo coordination per spiegare la sequenza operativa tra canali.`,
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
                try {
                    await ProjectTipService.materializeFromCrossChannelInsight(updated.id);
                } catch (error) {
                    if (isMissingPrismaTable(error, ['ProjectTip', 'ProjectStrategy', 'ProjectMethodologyBinding', 'MethodologyProfile'])) {
                        console.info('[project-tip-dual-write] skipped because canonical project intelligence tables are not available yet', {
                            insightId: updated.id,
                        });
                    } else {
                        console.warn('[project-tip-dual-write] cross-channel materialization failed', { insightId: updated.id, error });
                    }
                }
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
            try {
                await ProjectTipService.materializeFromCrossChannelInsight(created.id);
            } catch (error) {
                if (isMissingPrismaTable(error, ['ProjectTip', 'ProjectStrategy', 'ProjectMethodologyBinding', 'MethodologyProfile'])) {
                    console.info('[project-tip-dual-write] skipped because canonical project intelligence tables are not available yet', {
                        insightId: created.id,
                    });
                } else {
                    console.warn('[project-tip-dual-write] cross-channel materialization failed', { insightId: created.id, error });
                }
            }
            existingByTopic.set(topicName, created);
            return created;
        };

        const savedInsights: any[] = [];
        const buildFallbackEvidence = () => {
            const evidences: Array<{ sourceType: string; sourceRef: string; detail: string }> = [];

            if (interviewSummary[0]) {
                evidences.push({
                    sourceType: 'interview',
                    sourceRef: `interview#${interviewSummary[0].id}`,
                    detail: `Tema principale: ${Array.isArray(interviewSummary[0].themes) ? interviewSummary[0].themes.slice(0, 1).join(', ') : 'n/d'}`
                });
            }
            if (chatbotSummary[0]) {
                evidences.push({
                    sourceType: 'chatbot',
                    sourceRef: 'chatbot:analytics',
                    detail: `Gap=${chatbotSummary[0].gapsCount}, cluster=${chatbotSummary[0].clusterCount}, leads=${chatbotSummary[0].leads ?? 0}`
                });
            }
            if (visibilitySummary[0]) {
                evidences.push({
                    sourceType: 'visibility',
                    sourceRef: `llm:${visibilitySummary[0].platform}`,
                    detail: `Brand mentioned=${String(visibilitySummary[0].brandMentioned)}`
                });
            }
            if (serpSummary) {
                evidences.push({
                    sourceType: 'serp',
                    sourceRef: 'serp:summary',
                    detail: `Menzioni=${serpSummary.totalMentions}, positive=${serpSummary.sentimentBreakdown.positive}, negative=${serpSummary.sentimentBreakdown.negative}`
                });
            }
            if (websiteAnalytics) {
                evidences.push({
                    sourceType: 'analytics',
                    sourceRef: 'ga4+gsc:7d',
                    detail: `Pageviews medie=${Math.round(websiteAnalytics.avgPageviews || 0)}, bounce=${((websiteAnalytics.avgBounceRate || 0) * 100).toFixed(1)}%`
                });
            }
            if (websiteSummary[0]) {
                evidences.push({
                    sourceType: 'kb',
                    sourceRef: `kb:${websiteSummary[0].type}`,
                    detail: `Contenuto correlato: ${trunc(websiteSummary[0].title || 'fonte', 70)}`
                });
            }

            if (evidences.length === 0) {
                evidences.push({
                    sourceType: 'strategy',
                    sourceRef: 'strategic_context',
                    detail: 'Evidenza minima disponibile: usare allineamento strategico e validare con nuovi dati.'
                });
            }
            return evidences.slice(0, 3);
        };

        const visibilityPayload = {
            visibilitySummary,
            websiteAnalytics: websiteAnalytics || null,
            serpSummary: serpSummary || null,
            strategicContext: {
                strategicVision,
                valueProposition,
                strategicPlan
            },
            activeChannels: [
                visibilitySummary.length > 0 ? 'visibility' : null,
                interviewSummary.length > 0 ? 'interviews' : null,
                chatbotSummary.length > 0 ? 'chatbot' : null,
                websiteAnalytics ? 'analytics' : null,
                serpSummary ? 'serp' : null
            ].filter(Boolean)
        };

        // Save the summary report as a special record (single, updatable)
        const healthInsight = await upsertInsight("Health Report: Brand & Sito", {
            visibilityData: {
                ...visibilityPayload,
                report: object.healthReport,
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
                    strategicAlignment: strategicVision || valueProposition || 'Allineare comunicazione e posizionamento ai bisogni reali emersi.',
                    evidence: buildFallbackEvidence(),
                    coordination: 'Usare questo health report come base per prioritizzare azioni sito, chatbot e visibilita nel prossimo sprint.',
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
                const metadata = buildInsightActionMetadata(action);
                const match = findContentMatch(action.title || '', action.body || '');
                if (action.type === 'add_faq' && match) {
                    return [];
                }
                if (action.type === 'create_content' && match) {
                    const normalizedEvidence = Array.isArray(action.evidence) && action.evidence.length > 0
                        ? action.evidence.slice(0, 4)
                        : buildFallbackEvidence();
                    return [{
                        ...action,
                        type: 'modify_content',
                        target: 'website',
                        title: `Aggiorna contenuto esistente: ${match.title}`,
                        body: `${action.body}\n\nNota: contenuto simile già presente ("${match.title}"). Trasforma il suggerimento in un aggiornamento mirato di quel contenuto.`,
                        validation: { status: 'duplicate', matchTitle: match.title, score: match.score },
                        evidence: normalizedEvidence,
                        strategicAlignment: action.strategicAlignment || strategicVision || valueProposition || 'Allineamento con direzione strategica del progetto.',
                        coordination: action.coordination || 'Dopo l\'aggiornamento pagina, sincronizzare snippet social o FAQ correlate.',
                        workflowStatus: 'draft',
                        ...metadata
                    }];
                }
                const normalizedEvidence = Array.isArray(action.evidence) && action.evidence.length > 0
                    ? action.evidence.slice(0, 4)
                    : buildFallbackEvidence();
                const hasRoutingRule =
                    Boolean(metadata.contentKind) &&
                    (projectId ? enabledRoutingKinds.has(metadata.contentKind as ContentKind) : true);
                const canAutoApply =
                    (action.type === 'add_faq' && hasChatbotInScope) ||
                    (Boolean(metadata.contentKind) && canAutoPublishToCms && hasRoutingRule);

                return [{
                    ...action,
                    workflowStatus: 'draft',
                    autoApply: canAutoApply,
                    evidence: normalizedEvidence,
                    strategicAlignment: action.strategicAlignment || strategicVision || valueProposition || 'Allineamento con obiettivi strategici del brand.',
                    coordination: action.coordination || (
                        action.target === 'website'
                            ? 'Coordinare con canali social/intervista per amplificazione e validazione dei messaggi.'
                            : 'Coordinare con aggiornamenti sito per mantenere coerenza del messaggio.'
                    ),
                    ...metadata,
                    ...(match ? { validation: { status: 'overlap', matchTitle: match.title, score: match.score } } : {}),
                    automationRequirements: {
                        hasChatbotInScope,
                        canAutoPublishToCms,
                        hasRoutingRule,
                        routedContentKind: metadata.contentKind
                    }
                }];
            });

            if (preparedActions.length === 0) continue;

            const insight = await upsertInsight(rawInsight.topicName, {
                visibilityData: visibilityPayload as any,
                interviewData: interviewSummary as any,
                chatbotData: chatbotSummary as any,
                crossChannelScore: 100,
                priorityScore: rawInsight.priorityScore,
                suggestedActions: preparedActions as any
            });
            savedInsights.push(insight);
        }

        const result: SyncResult = {
            insights: savedInsights,
            healthReport: object.healthReport
        };

        // ---------------------------------------------------------------------------
        // Optimization B: store result in cache before returning
        // ---------------------------------------------------------------------------
        syncCache.set(cacheKey, { result, ts: Date.now() });

        return result;
    }
}
