import { prisma } from '@/lib/prisma';
import { scrapeUrl, scrapeWebsiteWithSubpages, ScrapedContent, MultiPageScrapedContent, AdditionalUrl } from '@/lib/scraping';
import { getSystemLLM } from './llm-providers';
import { generateObject } from 'ai';
import { z } from 'zod';

// Interface for prompt with reference URL
interface PromptWithRef {
    text: string;
    referenceUrl?: string | null;
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
        'improve_meta'
    ]),
    priority: z.enum(['high', 'medium', 'low']),
    title: z.string(),
    description: z.string(),
    impact: z.string(),
    relatedPrompts: z.array(z.string()).optional()
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
            // 3. Parse additional URLs from config
            const additionalUrls: AdditionalUrl[] = Array.isArray(analysis.visibilityConfig.additionalUrls)
                ? (analysis.visibilityConfig.additionalUrls as AdditionalUrl[])
                : [];

            // 4. Scrape website content (including subpages and additional URLs)
            console.log(`[website-analysis] Scraping ${analysis.websiteUrl} with subpages...`);
            if (additionalUrls.length > 0) {
                console.log(`[website-analysis] Including ${additionalUrls.length} additional user-specified URLs`);
            }
            const scrapedContent = await scrapeWebsiteWithSubpages(analysis.websiteUrl, 8, additionalUrls);
            console.log(`[website-analysis] Scraped ${scrapedContent.pagesScraped} pages, ${scrapedContent.totalContent.length} chars total`);

            // 5. Analyze with LLM
            console.log(`[website-analysis] Analyzing content...`);
            const promptsWithRef: PromptWithRef[] = analysis.visibilityConfig.prompts.map(p => ({
                text: p.text,
                referenceUrl: p.referenceUrl
            }));
            const analysisResult = await this.analyzeContent(
                scrapedContent,
                analysis.visibilityConfig.brandName,
                promptsWithRef,
                analysis.visibilityConfig.competitors.map(c => c.name)
            );

            // 6. Calculate overall score (weighted average)
            const overallScore = Math.round(
                (analysisResult.structuredData.score * 0.15) +
                (analysisResult.valueProposition.score * 0.30) +
                (analysisResult.keywordCoverage.score * 0.35) +
                (analysisResult.contentClarity.score * 0.20)
            );

            // 7. Prepare prompts addressed data
            const promptsAddressed = {
                addressed: analysisResult.keywordCoverage.promptsAddressed
                    .filter(p => p.coverageLevel === 'strong' || p.coverageLevel === 'partial')
                    .map(p => p.promptText),
                gaps: analysisResult.keywordCoverage.promptsAddressed
                    .filter(p => p.coverageLevel === 'missing' || p.coverageLevel === 'weak')
                    .map(p => p.promptText)
            };

            // 8. Update analysis record
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
                    recommendations: analysisResult.recommendations,
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
     * Analyze website content using LLM
     */
    private static async analyzeContent(
        content: MultiPageScrapedContent,
        brandName: string,
        prompts: PromptWithRef[],
        competitors: string[]
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

        const { object } = await generateObject({
            model,
            schema: FullAnalysisSchema,
            prompt: `Sei un esperto di SEO e ottimizzazione per LLM (ChatGPT, Claude, Gemini). Analizza il seguente contenuto di un sito web per valutare quanto è ottimizzato per essere citato dagli assistenti AI.

=== BRAND ===
Nome: ${brandName}
Competitor: ${competitors.join(', ') || 'Non specificati'}

=== PROMPTS DA MONITORARE ===
Questi sono i prompt che gli utenti potrebbero fare agli LLM e per cui il brand vuole essere menzionato.
Per alcuni prompt è indicato un "URL di riferimento" - questa è la pagina che il brand desidera venga citata come fonte per quella specifica query.
${promptsList}

=== SITO WEB ANALIZZATO ===
URL: ${content.homepage.url}
Pagine analizzate (${content.pagesScraped}):
${pagesSummary}

Meta Description Homepage: ${content.homepage.description || 'Non presente'}

=== CONTENUTO COMPLETO DEL SITO ===
(Include homepage e sottopagine principali - primi 10000 caratteri)
"""
${content.totalContent.substring(0, 10000)}
"""

=== ANALISI RICHIESTA ===

1. STRUCTURED DATA (peso 15%):
   - Valuta se il sito sembra avere dati strutturati (Schema.org come Organization, Product, FAQPage, etc.)
   - Identifica quali schemi sarebbero utili per la visibilità LLM
   - Score: 100 se ben strutturato, 0 se mancano completamente

2. VALUE PROPOSITION (peso 30%):
   - Identifica le proposte di valore presenti nel contenuto
   - Valuta se sono chiare, uniche e differenzianti
   - Gli LLM citano più facilmente brand con value proposition chiare
   - Score: basato su chiarezza e unicità

3. KEYWORD COVERAGE (peso 35%):
   - Per OGNI prompt di monitoraggio, valuta se il contenuto del sito risponde adeguatamente:
     - "strong": Il sito ha contenuti che rispondono chiaramente a questa query
     - "partial": Il sito tocca l'argomento ma non completamente
     - "weak": Menzione indiretta o superficiale
     - "missing": Nessun contenuto rilevante
   - Se un prompt ha un URL di riferimento:
     - Indica se quella specifica pagina è stata analizzata (referenceUrlCovered: true/false)
     - Fornisci una nota su come la pagina di riferimento copre il prompt (referenceUrlNote)
   - Questo è il fattore più importante per la visibilità LLM
   - Score: basato sulla percentuale di prompt coperti (strong=100%, partial=50%, weak=25%, missing=0%)

4. CONTENT CLARITY (peso 20%):
   - Valuta chiarezza, leggibilità e struttura del contenuto
   - Gli LLM preferiscono contenuti ben organizzati e facili da comprendere
   - Identifica punti di forza e debolezze
   - Score: basato sulla qualità della scrittura

5. RECOMMENDATIONS:
   - Genera 5-8 raccomandazioni concrete e azionabili
   - Ordina per priorità (high = maggior impatto sulla visibilità LLM)
   - Ogni raccomandazione deve avere:
     - Titolo chiaro (azione specifica)
     - Descrizione dettagliata di cosa fare
     - Impatto atteso sulla visibilità
     - Prompt correlati (se applicabile)`,
            temperature: 0.1
        });

        return object;
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
