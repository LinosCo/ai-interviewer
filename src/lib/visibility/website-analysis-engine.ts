import { prisma } from '@/lib/prisma';
import { scrapeWebsiteWithSubpages, MultiPageScrapedContent, AdditionalUrl } from '@/lib/scraping';
import { getSystemLLM } from './llm-providers';
import { generateObject } from 'ai';
import { z } from 'zod';

// Interface for prompt with reference URL
interface PromptWithRef {
    text: string;
    referenceUrl?: string | null;
}

// Strategic context from multiple data sources
interface StrategicContext {
    organizationVision?: string;
    organizationValueProp?: string;
    knowledgeGaps: Array<{ topic: string; priority: string; evidence: string }>;
    interviewThemes: Array<{ name: string; category?: string; description?: string; occurrenceCount: number }>;
    visibilityScanInsights: Array<{
        prompt: string;
        brandMentioned: boolean;
        position?: number;
        sentiment?: string;
        sourcesCited?: string[];
        confidence?: 'high' | 'medium' | 'low';
        platform?: string;
    }>;
    chatbotFaqSuggestions: Array<{ question: string; occurrences: number }>;
    crossChannelInsights: Array<{ topic: string; suggestedActions: any; priorityScore: number }>;
    knowledgeSources: Array<{ title?: string; type?: string; snippet: string }>;
    websiteAnalytics?: {
        avgBounceRate?: number;
        avgSessionDuration?: number;
        topPages?: Array<{ path: string; views: number; bounceRate?: number }>;
        topSearchQueries?: Array<{ query: string; impressions: number; clicks: number; position: number }>;
        topSearchPages?: Array<{ page: string; impressions: number; clicks: number; position: number }>;
    };
}

// Zod schemas for structured LLM output
const PromptCoverageItemSchema = z.object({
    promptText: z.string(),
    coverageLevel: z.enum(['strong', 'partial', 'weak', 'missing']),
    evidence: z.string().optional(),
    referenceUrlCovered: z.boolean().optional(),
    referenceUrlNote: z.string().optional()
});

const RecommendationSchema = z.object({
    type: z.enum([
        'add_structured_data',
        'improve_value_proposition',
        'add_keyword_content',
        'improve_clarity',
        'add_page',
        'modify_content',
        'add_faq',
        'improve_meta',
        'address_knowledge_gap',
        'leverage_interview_insight',
        'competitive_positioning'
    ]),
    priority: z.enum(['high', 'medium', 'low']),
    title: z.string(),
    description: z.string(),
    impact: z.string(),
    relatedPrompts: z.array(z.string()).optional(),
    dataSource: z.string().optional(), // Which data source this recommendation came from
    contentDraft: z.object({
        title: z.string(),
        slug: z.string(),
        body: z.string(),
        metaDescription: z.string().optional(),
        targetSection: z.string()
    }).optional()
});

const FullAnalysisSchema = z.object({
    structuredData: z.object({
        hasSchema: z.boolean(),
        schemasFound: z.array(z.string()),
        missingRecommended: z.array(z.string()),
        score: z.number().min(0).max(100)
    }),
    valueProposition: z.object({
        propositionsFound: z.array(z.string()),
        clarity: z.enum(['clear', 'moderate', 'unclear']),
        uniqueness: z.enum(['unique', 'generic', 'missing']),
        suggestions: z.array(z.string()),
        score: z.number().min(0).max(100)
    }),
    keywordCoverage: z.object({
        promptsAddressed: z.array(PromptCoverageItemSchema),
        gaps: z.array(z.string()),
        recommendations: z.array(z.string()),
        score: z.number().min(0).max(100)
    }),
    contentClarity: z.object({
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        tone: z.string(),
        readability: z.enum(['excellent', 'good', 'average', 'poor']),
        score: z.number().min(0).max(100)
    }),
    recommendations: z.array(RecommendationSchema)
});

export class WebsiteAnalysisEngine {
    private static normalizeText(input: string): string {
        return input
            .toLowerCase()
            .replace(/https?:\/\/\S+/g, ' ')
            .replace(/[^a-z0-9àèéìòùäöüßçñ\s]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private static tokenize(input: string): Set<string> {
        const normalized = this.normalizeText(input);
        const tokens = normalized.split(' ').filter(t => t.length >= 4);
        return new Set(tokens);
    }

    private static jaccardSimilarity(a: string, b: string): number {
        const aTokens = this.tokenize(a);
        const bTokens = this.tokenize(b);
        if (aTokens.size === 0 || bTokens.size === 0) return 0;
        let intersection = 0;
        for (const t of aTokens) {
            if (bTokens.has(t)) intersection += 1;
        }
        const union = aTokens.size + bTokens.size - intersection;
        return union === 0 ? 0 : intersection / union;
    }

    private static postProcessRecommendations(
        recommendations: Array<z.infer<typeof RecommendationSchema>>,
        content: MultiPageScrapedContent,
        context: StrategicContext
    ) {
        if (!recommendations.length) return recommendations;

        const existingText = [
            content.homepage.title,
            content.homepage.description || '',
            content.totalContent.substring(0, 15000),
            ...(context.knowledgeSources || []).map(k => k.snippet)
        ].join(' ');

        const pageTitles = [
            content.homepage.title,
            ...content.subpages.map(p => p.title)
        ].filter(Boolean).map(t => t.toLowerCase());

        return recommendations.map(rec => {
            if (!rec.contentDraft) return rec;

            const draftTitle = (rec.contentDraft.title || '').toLowerCase();
            const draftText = `${rec.contentDraft.title}\n${rec.contentDraft.body || ''}`;
            const similarity = this.jaccardSimilarity(draftText, existingText);
            const titleMatch = pageTitles.some(t => draftTitle && (t.includes(draftTitle) || draftTitle.includes(t)));

            if (similarity >= 0.45 || titleMatch) {
                return {
                    ...rec,
                    type: 'modify_content',
                    description: `${rec.description} Nota: contenuto simile già presente sul sito; proponi un aggiornamento/estensione invece di una nuova pagina.`
                };
            }

            return rec;
        });
    }

    /**
     * Fetch strategic context from multiple data sources
     */
    private static async fetchStrategicContext(configId: string, organizationId: string): Promise<StrategicContext> {
        // Fetch organization data
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { strategicVision: true, valueProposition: true }
        });

        // Fetch project if linked
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            select: { projectId: true }
        });

        // Get bots for this organization through projects
        const projects = await prisma.project.findMany({
            where: { organizationId },
            select: { id: true }
        });
        const projectIds = projects.map(p => p.id);

        const bots = projectIds.length > 0 ? await prisma.bot.findMany({
            where: { projectId: { in: projectIds } },
            select: { id: true }
        }) : [];
        const botIds = bots.map(b => b.id);

        // Fetch knowledge gaps (what users ask that chatbot can't answer)
        const knowledgeGaps = botIds.length > 0 ? await prisma.knowledgeGap.findMany({
            where: {
                botId: { in: botIds },
                status: 'pending'
            },
            orderBy: { createdAt: 'desc' },
            take: 15,
            select: { topic: true, priority: true, evidence: true }
        }) : [];

        // Fetch interview themes (recurring topics from user interviews)
        const themes = botIds.length > 0 ? await prisma.theme.findMany({
            where: { botId: { in: botIds } },
            include: { _count: { select: { occurrences: true } } },
            orderBy: { occurrences: { _count: 'desc' } },
            take: 10
        }) : [];

        // Fetch recent visibility scan insights
        const recentScan = await prisma.visibilityScan.findFirst({
            where: { configId, status: 'completed' },
            orderBy: { completedAt: 'desc' },
            include: {
                responses: {
                    include: { prompt: true }
                }
            }
        });

        const visibilityScanInsights = recentScan?.responses.map(r => {
            const sources = (r.sourcesCited || []).filter(Boolean);
            const confidence: 'high' | 'medium' | 'low' =
                sources.length > 0 || r.platform === 'google_ai_overview'
                    ? 'high'
                    : r.brandMentioned
                        ? 'medium'
                        : 'low';

            return {
                prompt: r.prompt.text,
                brandMentioned: r.brandMentioned,
                position: r.brandPosition ?? undefined,
                sentiment: r.sentiment ?? undefined,
                sourcesCited: sources,
                confidence,
                platform: r.platform
            };
        }) || [];

        // Fetch FAQ suggestions (frequently asked questions from chatbot)
        const faqSuggestions = botIds.length > 0 ? await prisma.faqSuggestion.findMany({
            where: {
                botId: { in: botIds },
                status: 'pending'
            },
            orderBy: { occurrences: 'desc' },
            take: 10,
            select: { question: true, occurrences: true }
        }) : [];

        // Fetch knowledge sources (official KB snippets)
        const knowledgeSources = botIds.length > 0 ? await prisma.knowledgeSource.findMany({
            where: { botId: { in: botIds } },
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: { title: true, type: true, content: true }
        }) : [];

        // Fetch cross-channel insights
        const crossChannelInsights = await prisma.crossChannelInsight.findMany({
            where: {
                organizationId,
                ...(config?.projectId ? { projectId: config.projectId } : {})
            },
            orderBy: { priorityScore: 'desc' },
            take: 5,
            select: { topicName: true, suggestedActions: true, priorityScore: true }
        });

        // Fetch latest website analytics (GA/GSC) if CMS connection exists
        let websiteAnalytics: StrategicContext['websiteAnalytics'] | undefined;
        if (config?.projectId) {
            const project = await prisma.project.findUnique({
                where: { id: config.projectId },
                include: {
                    cmsConnection: true,
                    newCmsConnection: true,
                    cmsShares: { include: { connection: true } }
                } as any
            });

            const cmsConnection = (project as any)?.newCmsConnection
                || project?.cmsConnection
                || (project?.cmsShares && project.cmsShares.length > 0 ? project.cmsShares[0].connection : null);

            if (cmsConnection?.id) {
                const latestAnalytics = await prisma.websiteAnalytics.findFirst({
                    where: { connectionId: cmsConnection.id },
                    orderBy: { date: 'desc' }
                });

                if (latestAnalytics) {
                    const topPages = (latestAnalytics.topPages as any[] || []).slice(0, 6).map(p => ({
                        path: p.path || p.page || p.url || p.title || 'unknown',
                        views: p.views || p.pageviews || 0,
                        bounceRate: p.bounceRate
                    }));
                    const topSearchQueries = (latestAnalytics.topSearchQueries as any[] || []).slice(0, 8).map(q => ({
                        query: q.query || q.keyword || '',
                        impressions: q.impressions || 0,
                        clicks: q.clicks || 0,
                        position: q.position || q.avgPosition || 0
                    }));
                    const topSearchPages = (latestAnalytics.topSearchPages as any[] || []).slice(0, 6).map(p => ({
                        page: p.page || p.url || '',
                        impressions: p.impressions || 0,
                        clicks: p.clicks || 0,
                        position: p.position || p.avgPosition || 0
                    }));

                    websiteAnalytics = {
                        avgBounceRate: latestAnalytics.bounceRate,
                        avgSessionDuration: latestAnalytics.avgSessionDuration,
                        topPages,
                        topSearchQueries,
                        topSearchPages
                    };
                }
            }
        }

        return {
            organizationVision: organization?.strategicVision ?? undefined,
            organizationValueProp: organization?.valueProposition ?? undefined,
            knowledgeGaps: knowledgeGaps.map(g => ({
                topic: g.topic,
                priority: g.priority,
                evidence: typeof g.evidence === 'string' ? g.evidence : JSON.stringify(g.evidence)
            })),
            interviewThemes: themes.map(t => ({
                name: t.name,
                category: t.category ?? undefined,
                description: t.description ?? undefined,
                occurrenceCount: t._count.occurrences
            })),
            visibilityScanInsights,
            chatbotFaqSuggestions: faqSuggestions,
            crossChannelInsights: crossChannelInsights.map(i => ({
                topic: i.topicName,
                suggestedActions: i.suggestedActions,
                priorityScore: i.priorityScore
            })),
            knowledgeSources: knowledgeSources.map(k => ({
                title: k.title ?? undefined,
                type: k.type ?? undefined,
                snippet: (k.content || '').replace(/\s+/g, ' ').slice(0, 220)
            })),
            websiteAnalytics
        };
    }

    /**
     * Run a complete website analysis for a config
     */
    static async runAnalysis(analysisId: string) {
        // 1. Fetch analysis record with config and prompts
        const analysis = await prisma.websiteAnalysis.findUnique({
            where: { id: analysisId },
            include: {
                visibilityConfig: {
                    include: {
                        prompts: { where: { enabled: true } },
                        competitors: { where: { enabled: true } }
                    }
                }
            }
        });

        if (!analysis) throw new Error(`Analysis ${analysisId} not found`);

        // 2. Update status to running
        await prisma.websiteAnalysis.update({
            where: { id: analysisId },
            data: { status: 'running' }
        });

        try {
            // 3. Fetch strategic context from multiple data sources
            console.log(`[website-analysis] Fetching strategic context...`);
            const strategicContext = await this.fetchStrategicContext(
                analysis.configId,
                analysis.visibilityConfig.organizationId
            );
            console.log(`[website-analysis] Context: ${strategicContext.knowledgeGaps.length} knowledge gaps, ${strategicContext.interviewThemes.length} themes, ${strategicContext.visibilityScanInsights.length} scan insights`);

            // 4. Parse additional URLs from config
            const additionalUrls: AdditionalUrl[] = Array.isArray(analysis.visibilityConfig.additionalUrls)
                ? (analysis.visibilityConfig.additionalUrls as unknown as AdditionalUrl[])
                : [];

            // 5. Scrape website content (including subpages and additional URLs)
            console.log(`[website-analysis] Scraping ${analysis.websiteUrl} with subpages...`);
            if (additionalUrls.length > 0) {
                console.log(`[website-analysis] Including ${additionalUrls.length} additional user-specified URLs`);
            }
            const scrapedContent = await scrapeWebsiteWithSubpages(analysis.websiteUrl, 8, additionalUrls);
            console.log(`[website-analysis] Scraped ${scrapedContent.pagesScraped} pages, ${scrapedContent.totalContent.length} chars total`);

            // 6. Analyze with LLM
            console.log(`[website-analysis] Analyzing content with strategic context...`);
            const promptsWithRef: PromptWithRef[] = analysis.visibilityConfig.prompts.map(p => ({
                text: p.text,
                referenceUrl: p.referenceUrl
            }));
            const analysisResult = await this.analyzeContent(
                scrapedContent,
                analysis.visibilityConfig.brandName,
                promptsWithRef,
                analysis.visibilityConfig.competitors.map(c => c.name),
                strategicContext,
                analysis.visibilityConfig.language || 'it'
            );

            // 7. Calculate overall score (weighted average)
            const overallScore = Math.round(
                (analysisResult.structuredData.score * 0.15) +
                (analysisResult.valueProposition.score * 0.30) +
                (analysisResult.keywordCoverage.score * 0.35) +
                (analysisResult.contentClarity.score * 0.20)
            );

            // 8. Prepare prompts addressed data
            const promptsAddressed = {
                addressed: analysisResult.keywordCoverage.promptsAddressed
                    .filter(p => p.coverageLevel === 'strong' || p.coverageLevel === 'partial')
                    .map(p => p.promptText),
                gaps: analysisResult.keywordCoverage.promptsAddressed
                    .filter(p => p.coverageLevel === 'missing' || p.coverageLevel === 'weak')
                    .map(p => p.promptText)
            };

            // 9. Post-process recommendations (dedupe vs existing content)
            const cleanedRecommendations = this.postProcessRecommendations(
                analysisResult.recommendations || [],
                scrapedContent,
                strategicContext
            );

            // 10. Update analysis record
            await prisma.websiteAnalysis.update({
                where: { id: analysisId },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                    pageTitle: scrapedContent.homepage.title,
                    pageDescription: scrapedContent.homepage.description || null,
                    contentLength: scrapedContent.totalContent.length,
                    pagesScraped: scrapedContent.pagesScraped,
                    overallScore,
                    structuredDataScore: analysisResult.structuredData.score,
                    valuePropositionScore: analysisResult.valueProposition.score,
                    keywordCoverageScore: analysisResult.keywordCoverage.score,
                    contentClarityScore: analysisResult.contentClarity.score,
                    structuredDataFound: analysisResult.structuredData,
                    valuePropositions: analysisResult.valueProposition,
                    keywordAnalysis: analysisResult.keywordCoverage,
                    contentAnalysis: analysisResult.contentClarity,
                    recommendations: cleanedRecommendations,
                    promptsAddressed
                }
            });

            console.log(`[website-analysis] Analysis complete. Score: ${overallScore}`);
            return { success: true, analysisId, overallScore };

        } catch (error: any) {
            console.error('[website-analysis] Analysis failed:', error);
            await prisma.websiteAnalysis.update({
                where: { id: analysisId },
                data: {
                    status: 'failed',
                    errorMessage: error.message
                }
            });
            throw error;
        }
    }

    /**
     * Analyze website content using LLM with strategic context
     */
    private static async analyzeContent(
        content: MultiPageScrapedContent,
        brandName: string,
        prompts: PromptWithRef[],
        competitors: string[],
        strategicContext: StrategicContext,
        language: string
    ) {
        const { model } = await getSystemLLM();

        // Build pages summary for context
        const pagesSummary = [
            `Homepage: ${content.homepage.title}`,
            ...content.subpages.map(p => {
                const label = p.pageType === 'custom' && p.customLabel
                    ? `CUSTOM (${p.customLabel})`
                    : p.pageType;
                return `${label}: ${p.title} (${p.url})`;
            })
        ].join('\n');

        // Build prompts list with reference URLs
        const promptsList = prompts.map((p, i) => {
            let line = `${i + 1}. "${p.text}"`;
            if (p.referenceUrl) {
                line += `\n   URL di riferimento: ${p.referenceUrl}`;
            }
            return line;
        }).join('\n');

        // Build strategic context section
        const strategicContextSection = this.buildStrategicContextSection(strategicContext);

        const languageMap: Record<string, string> = {
            it: 'Scrivi in italiano.',
            en: 'Write in English.',
            es: 'Escribe en español.',
            fr: 'Écris en français.',
            de: 'Schreibe auf Deutsch.'
        };
        const languageInstruction = languageMap[language] || languageMap.it;

        const { object } = await generateObject({
            model,
            schema: FullAnalysisSchema,
            prompt: `Sei un consulente strategico esperto di visibilità AI (LLM come ChatGPT, Claude, Gemini) e SEO.
La tua analisi deve essere STRATEGICA, SPECIFICA e AZIONABILE - non generica.

Hai accesso a dati multi-canale dell'organizzazione che ti permettono di fare raccomandazioni molto più mirate rispetto a una semplice analisi del sito.

=== BRAND ===
Nome: ${brandName}
Competitor: ${competitors.join(', ') || 'Non specificati'}

${strategicContext.organizationVision ? `VISIONE STRATEGICA DELL'ORGANIZZAZIONE:
${strategicContext.organizationVision}` : ''}

${strategicContext.organizationValueProp ? `VALUE PROPOSITION DICHIARATA:
${strategicContext.organizationValueProp}` : ''}

=== DATI MULTI-CANALE DELL'ORGANIZZAZIONE ===
${strategicContextSection}

=== PROMPTS DA MONITORARE ===
Questi sono i prompt per cui il brand vuole essere menzionato dagli LLM:
${promptsList}

=== SITO WEB ANALIZZATO ===
URL: ${content.homepage.url}
Pagine analizzate (${content.pagesScraped}):
${pagesSummary}

Meta Description Homepage: ${content.homepage.description || 'Non presente'}

=== CONTENUTO DEL SITO ===
"""
${content.totalContent.substring(0, 12000)}
"""

=== ISTRUZIONI PER L'ANALISI ===
${languageInstruction}

La tua analisi deve essere STRATEGICA e BASATA SUI DATI. Non fornire raccomandazioni generiche tipo "migliora la SEO" o "aggiungi keyword".

1. STRUCTURED DATA (15%):
   - Valuta presenza Schema.org (Organization, Product, FAQPage, HowTo, etc.)
   - Considera se i knowledge gaps del chatbot potrebbero essere risolti con FAQ strutturate

2. VALUE PROPOSITION (30%):
   - Confronta la value proposition dichiarata con quella comunicata sul sito
   - Verifica se i temi emersi dalle interviste sono riflessi nel messaggio
   - Gli LLM preferiscono brand con posizionamento chiaro e differenziante

3. KEYWORD COVERAGE (35%):
   - Per ogni prompt, valuta la copertura del sito
   - USA I DATI DEL VISIBILITY SCAN: se un prompt ha performance scarsa, è una priorità
   - I knowledge gaps del chatbot indicano domande reali degli utenti

   Se sono presenti query da Search Console:
   - Seleziona le keyword con molte impression e posizione media > 10, coerenti con Vision e Value Proposition
   - Genera almeno 1 raccomandazione "add_page" o "modify_content" per migliorare il posizionamento SEO su quelle keyword
   - Imposta dataSource = "search_console" e includi contentDraft completo

4. CONTENT CLARITY (20%):
   - Valuta chiarezza e struttura
   - Il tono deve essere coerente con i temi delle interviste

5. RECOMMENDATIONS (5-10 raccomandazioni):
   CRITICHE: Le raccomandazioni devono essere:
   - SPECIFICHE: "Aggiungi una sezione FAQ che risponda a [domanda specifica da knowledge gap]"
   - STRATEGICHE: Basate sui dati reali dell'organizzazione
   - PRIORITIZZATE: Le azioni con maggior impatto sulla visibilità AI prima
   - MISURABILI: Con impatto chiaro e verificabile
   - FATTUALI: Non inventare prodotti, brand o claim non presenti nelle fonti ufficiali (KB + sito)

   Per ogni raccomandazione indica:
   - Titolo: Azione specifica (es: "Crea pagina dedicata a [tema X] emerso dalle interviste")
   - Descrizione: Dettagli su come implementare
   - Impatto: Quale metrica migliorerà e perché
   - dataSource: Da quale fonte dati deriva (es: "knowledge_gap", "interview_theme", "visibility_scan", "chatbot_faq")
   - relatedPrompts: Quali prompt beneficeranno di questa azione

   Tipi di raccomandazione disponibili:
   - address_knowledge_gap: Risponde a gap identificato dal chatbot
   - leverage_interview_insight: Sfrutta insight dalle interviste
   - competitive_positioning: Miglioramento posizionamento vs competitor
   - add_structured_data, improve_value_proposition, add_keyword_content, improve_clarity, add_page, modify_content, add_faq, improve_meta

   CONTENUTO OPERATIVO (solo per add_page, add_faq, modify_content, competitive_positioning):
   - Aggiungi "contentDraft" con:
     • title (SEO-friendly)
     • slug (breve, con trattini)
     • body (Markdown con H2/H3, paragrafi brevi, liste, CTA)
     • metaDescription (<= 160 caratteri)
     • targetSection (faq, news, pages, blog, support o equivalente)
   - Il testo deve essere ottimizzato per LLM: esplicita brand, prodotto/servizio e termini chiave del prompt.
   - Non includere claim non verificati; se un dato non è nelle fonti, riformula come ipotesi o suggerisci verifica.`,
            temperature: 0.2
        });

        return object;
    }

    /**
     * Build the strategic context section for the prompt
     */
    private static buildStrategicContextSection(context: StrategicContext): string {
        const sections: string[] = [];

        // Knowledge Gaps from Chatbot
        if (context.knowledgeGaps.length > 0) {
            sections.push(`📊 KNOWLEDGE GAPS (domande utenti a cui il chatbot non sa rispondere):
${context.knowledgeGaps.map(g => `- [${g.priority}] ${g.topic}`).join('\n')}

Questi gap rappresentano opportunità concrete: gli utenti cercano queste informazioni ma non le trovano.`);
        }

        // Interview Themes
        if (context.interviewThemes.length > 0) {
            sections.push(`🎤 TEMI RICORRENTI DALLE INTERVISTE UTENTI:
${context.interviewThemes.map(t => `- "${t.name}" (${t.occurrenceCount} menzioni)${t.description ? ': ' + t.description : ''}`).join('\n')}

Questi temi sono emersi direttamente dalla voce dei clienti e rappresentano ciò che conta per loro.`);
        }

        // Visibility Scan Results
        if (context.visibilityScanInsights.length > 0) {
            const highConfidence = context.visibilityScanInsights.filter(i => i.confidence === 'high');
            const lowConfidence = context.visibilityScanInsights.filter(i => i.confidence !== 'high');
            const mentioned = highConfidence.filter(i => i.brandMentioned);
            const notMentioned = highConfidence.filter(i => !i.brandMentioned);

            sections.push(`🔍 RISULTATI ULTIMO VISIBILITY SCAN:
✅ Prompt ad alta affidabilità dove il brand È MENZIONATO (${mentioned.length}):
${mentioned.slice(0, 5).map(i => `- "${i.prompt}" - Posizione: ${i.position ?? 'N/A'}, Sentiment: ${i.sentiment ?? 'N/A'}`).join('\n')}

❌ Prompt ad alta affidabilità dove il brand NON È MENZIONATO (${notMentioned.length}):
${notMentioned.slice(0, 5).map(i => `- "${i.prompt}"`).join('\n')}

${lowConfidence.length > 0 ? `⚠️ Risposte a bassa affidabilità (senza fonti o prove): ${lowConfidence.slice(0, 5).map(i => `"${i.prompt}"`).join(', ')}. Trattale come segnali deboli.` : ''}`);
        }

        // FAQ Suggestions from Chatbot
        if (context.chatbotFaqSuggestions.length > 0) {
            sections.push(`💬 DOMANDE FREQUENTI DAL CHATBOT:
${context.chatbotFaqSuggestions.map(f => `- "${f.question}" (${f.occurrences} volte)`).join('\n')}

Queste domande vengono poste ripetutamente dagli utenti - il sito dovrebbe rispondere chiaramente.`);
        }

        // Cross-Channel Insights
        if (context.crossChannelInsights.length > 0) {
            sections.push(`🔗 INSIGHT CROSS-CANALE:
${context.crossChannelInsights.map(i => `- ${i.topic} (priorità: ${i.priorityScore.toFixed(1)})`).join('\n')}`);
        }

        if (context.knowledgeSources.length > 0) {
            sections.push(`📚 FONTI UFFICIALI (KB CHATBOT):
${context.knowledgeSources.map(k => `- ${k.title || k.type || 'Documento'}: ${k.snippet}`).join('\n')}`);
        }

        if (context.websiteAnalytics) {
            const analytics = context.websiteAnalytics;
            const topPages = analytics.topPages?.slice(0, 5) || [];
            const topQueries = analytics.topSearchQueries?.slice(0, 6) || [];
            const topSearchPages = analytics.topSearchPages?.slice(0, 5) || [];

            sections.push(`📈 ANALYTICS (GA/GSC):
- Bounce medio: ${analytics.avgBounceRate !== undefined ? Math.round(analytics.avgBounceRate * 100) + '%' : 'N/D'}
- Durata sessione media: ${analytics.avgSessionDuration !== undefined ? Math.round(analytics.avgSessionDuration) + 's' : 'N/D'}
${topPages.length ? `- Pagine più viste:\n${topPages.map(p => `  • ${p.path} (${p.views} views${p.bounceRate !== undefined ? `, bounce ${(p.bounceRate * 100).toFixed(0)}%` : ''})`).join('\n')}` : ''}
${topQueries.length ? `- Query più cercate (GSC):\n${topQueries.map(q => `  • "${q.query}" (${q.impressions} imp, pos ${q.position.toFixed(1)})`).join('\n')}` : ''}
${topSearchPages.length ? `- Pagine più viste da search:\n${topSearchPages.map(p => `  • ${p.page} (${p.impressions} imp, pos ${p.position.toFixed(1)})`).join('\n')}` : ''}`);
        }

        if (sections.length === 0) {
            return 'Nessun dato aggiuntivo disponibile. Basa la tua analisi solo sul contenuto del sito.';
        }

        return sections.join('\n\n');
    }

    /**
     * Get latest completed analysis for a config
     */
    static async getLatestAnalysis(configId: string) {
        return prisma.websiteAnalysis.findFirst({
            where: { configId, status: 'completed' },
            orderBy: { completedAt: 'desc' }
        });
    }

    /**
     * Create and run a new analysis
     */
    static async createAndRunAnalysis(configId: string) {
        // Get config with website URL
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId }
        });

        if (!config) throw new Error('Config not found');
        if (!config.websiteUrl) throw new Error('No website URL configured');

        // Create analysis record
        const analysis = await prisma.websiteAnalysis.create({
            data: {
                configId,
                websiteUrl: config.websiteUrl,
                status: 'pending'
            }
        });

        // Run analysis (don't await - let it run in background)
        this.runAnalysis(analysis.id).catch(err => {
            console.error('[website-analysis] Background analysis failed:', err);
        });

        return analysis;
    }
}
