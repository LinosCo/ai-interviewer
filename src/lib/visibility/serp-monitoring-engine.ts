import { prisma } from '@/lib/prisma';
import { getAdminApiKey, getSystemLLM } from './llm-providers';
import { generateObject } from 'ai';
import { z } from 'zod';

// Known source reputations (Italian + International)
const SOURCE_REPUTATIONS: Record<string, { score: number; type: string }> = {
    // Italian News (High reputation)
    'ilsole24ore.com': { score: 95, type: 'news' },
    'corriere.it': { score: 92, type: 'news' },
    'repubblica.it': { score: 90, type: 'news' },
    'ansa.it': { score: 93, type: 'news' },
    'ilfattoquotidiano.it': { score: 80, type: 'news' },
    'lastampa.it': { score: 85, type: 'news' },
    'ilmessaggero.it': { score: 82, type: 'news' },
    'ilgiornale.it': { score: 75, type: 'news' },
    'adnkronos.com': { score: 88, type: 'news' },
    'agi.it': { score: 87, type: 'news' },

    // Tech/Business (Italian)
    'wired.it': { score: 85, type: 'news' },
    'hwupgrade.it': { score: 78, type: 'blog' },
    'tomshw.it': { score: 75, type: 'blog' },
    'ilsoftware.it': { score: 72, type: 'blog' },
    'hdblog.it': { score: 70, type: 'blog' },
    'punto-informatico.it': { score: 73, type: 'news' },

    // International News
    'reuters.com': { score: 96, type: 'news' },
    'bbc.com': { score: 95, type: 'news' },
    'nytimes.com': { score: 94, type: 'news' },
    'theguardian.com': { score: 90, type: 'news' },
    'forbes.com': { score: 88, type: 'news' },
    'bloomberg.com': { score: 92, type: 'news' },
    'techcrunch.com': { score: 85, type: 'news' },
    'theverge.com': { score: 80, type: 'news' },
    'wired.com': { score: 82, type: 'news' },

    // Social/Forums
    'linkedin.com': { score: 70, type: 'social' },
    'twitter.com': { score: 55, type: 'social' },
    'x.com': { score: 55, type: 'social' },
    'reddit.com': { score: 50, type: 'forum' },
    'facebook.com': { score: 45, type: 'social' },
    'medium.com': { score: 60, type: 'blog' },

    // Government/Institutional
    'gov.it': { score: 90, type: 'government' },
    'europa.eu': { score: 92, type: 'government' },
    'mise.gov.it': { score: 88, type: 'government' },
};

// AI Analysis Schema
const SerpAnalysisSchema = z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    sentimentScore: z.number().min(-1).max(1).describe('Continuous sentiment score from -1 (very negative) to 1 (very positive)'),
    relevanceScore: z.number().min(0).max(100).describe('How relevant is this content to the brand (0-100)'),
    brandMentionType: z.enum(['direct', 'indirect', 'competitor_comparison', 'industry_mention']),
    topicCategory: z.enum(['product', 'service', 'leadership', 'controversy', 'award', 'partnership', 'financial', 'legal', 'general']).nullable(),
    keyEntities: z.array(z.object({
        name: z.string(),
        type: z.enum(['person', 'company', 'product', 'location', 'event'])
    })).describe('Key entities mentioned in the content'),
    contentSummary: z.string().describe('Brief summary of the content in 2-3 sentences'),
    impactOnLLMVisibility: z.boolean().describe('Could this content influence how LLMs perceive/recommend the brand?'),
    suggestedActions: z.array(z.object({
        type: z.enum(['respond', 'monitor', 'amplify', 'address', 'ignore']),
        priority: z.enum(['high', 'medium', 'low']),
        description: z.string()
    })).describe('Suggested actions based on this content')
});

// Batch analysis schema for multiple results
const BatchAnalysisSchema = z.object({
    analyses: z.array(SerpAnalysisSchema)
});

export class SerpMonitoringEngine {
    /**
     * Run a SERP monitoring scan for a visibility configuration
     */
    static async runScan(configId: string, dateRange: 'last_day' | 'last_week' | 'last_month' = 'last_week') {
        // 1. Fetch config
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            include: { competitors: { where: { enabled: true } } }
        });

        if (!config) throw new Error(`Config ${configId} not found`);

        // 2. Get SERP API key
        const serpApiKey = await getAdminApiKey('GOOGLE_SERP');
        if (!serpApiKey) {
            throw new Error('Google SERP API key not configured. Please add it in admin settings.');
        }

        // 3. Build search query
        const dateFilter = this.getDateFilter(dateRange);
        const query = `"${config.brandName}" ${dateFilter}`;

        // 4. Create scan record
        const scan = await prisma.serpMonitoringScan.create({
            data: {
                configId: config.id,
                scanType: 'manual',
                query,
                dateRange,
                status: 'running',
                startedAt: new Date()
            }
        });

        try {
            // 5. Fetch SERP results
            const serpResults = await this.fetchSerpResults(serpApiKey, query, config.language, config.territory);

            if (serpResults.length === 0) {
                await prisma.serpMonitoringScan.update({
                    where: { id: scan.id },
                    data: { status: 'completed', completedAt: new Date(), totalResults: 0 }
                });
                return { success: true, scanId: scan.id, resultsCount: 0 };
            }

            // 6. Analyze results with AI (batch for efficiency)
            const analyzedResults = await this.analyzeResults(serpResults, config.brandName, config.competitors.map(c => c.name));

            // 7. Save results to database
            const savedResults = [];
            let positiveCount = 0, negativeCount = 0, neutralCount = 0;
            let totalImportance = 0;

            for (const result of analyzedResults) {
                // Calculate importance score
                const importanceScore = this.calculateImportanceScore(result);

                const savedResult = await prisma.serpResult.create({
                    data: {
                        scanId: scan.id,
                        title: result.title,
                        url: result.url,
                        snippet: result.snippet,
                        displayedLink: result.displayedLink,
                        publishedDate: result.publishedDate,
                        position: result.position,
                        sourceDomain: result.sourceDomain,
                        sourceType: result.sourceType,
                        sourceReputation: result.sourceReputation,
                        sentiment: result.analysis.sentiment,
                        sentimentScore: result.analysis.sentimentScore,
                        relevanceScore: result.analysis.relevanceScore,
                        importanceScore,
                        brandMentionType: result.analysis.brandMentionType,
                        topicCategory: result.analysis.topicCategory,
                        keyEntities: result.analysis.keyEntities,
                        contentSummary: result.analysis.contentSummary,
                        relatedToLLMVisibility: result.analysis.impactOnLLMVisibility,
                        suggestedActions: result.analysis.suggestedActions
                    }
                });

                savedResults.push(savedResult);
                totalImportance += importanceScore;

                // Count sentiments
                if (result.analysis.sentiment === 'positive') positiveCount++;
                else if (result.analysis.sentiment === 'negative') negativeCount++;
                else neutralCount++;
            }

            // 8. Update scan with aggregates
            await prisma.serpMonitoringScan.update({
                where: { id: scan.id },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                    totalResults: savedResults.length,
                    positiveCount,
                    negativeCount,
                    neutralCount,
                    avgImportance: savedResults.length > 0 ? totalImportance / savedResults.length : 0
                }
            });

            return {
                success: true,
                scanId: scan.id,
                resultsCount: savedResults.length,
                summary: {
                    positive: positiveCount,
                    negative: negativeCount,
                    neutral: neutralCount,
                    avgImportance: savedResults.length > 0 ? totalImportance / savedResults.length : 0
                }
            };

        } catch (error) {
            console.error('SERP scan failed:', error);
            await prisma.serpMonitoringScan.update({
                where: { id: scan.id },
                data: { status: 'failed' }
            });
            throw error;
        }
    }

    /**
     * Get date filter string for Google search
     */
    private static getDateFilter(dateRange: string): string {
        switch (dateRange) {
            case 'last_day':
                return 'after:' + this.formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
            case 'last_week':
                return 'after:' + this.formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
            case 'last_month':
                return 'after:' + this.formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
            default:
                return 'after:' + this.formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        }
    }

    private static formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Fetch Google AI Overview (AI-generated answer at top of search results)
     * This simulates what users see when Googling - the AI summary box
     *
     * @returns AI Overview data or null if not present
     */
    static async fetchGoogleAiOverview(
        query: string,
        language: string = 'en',
        territory: string = 'US'
    ): Promise<{
        text: string;
        sources: Array<{ title: string; url: string; domain: string }>;
        brandMentioned: boolean;
        brandPosition: number | null;
    } | null> {
        const serpApiKey = await getAdminApiKey('GOOGLE_SERP');
        if (!serpApiKey) {
            console.log('[AI Overview] SERP API key not configured');
            return null;
        }

        try {
            // Regular search (not news) to get AI Overview
            const params = new URLSearchParams({
                api_key: serpApiKey,
                q: query,
                hl: language,
                gl: territory,
                num: '10'
                // Note: No 'tbm' parameter = regular web search which includes AI Overview
            });

            const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);

            if (!response.ok) {
                const error = await response.text();
                console.error('[AI Overview] SERP API error:', error);
                return null;
            }

            const data = await response.json();

            // Check for AI Overview in the response
            // SerpAPI returns it as 'ai_overview' for Google's AI-generated summaries
            const aiOverview = data.ai_overview;

            if (!aiOverview || !aiOverview.text_blocks) {
                console.log('[AI Overview] No AI Overview in search results');
                return null;
            }

            // Extract the text from text_blocks
            const textBlocks = aiOverview.text_blocks || [];
            const fullText = textBlocks.map((block: any) => {
                if (block.type === 'paragraph') {
                    return block.snippet || '';
                }
                if (block.type === 'list' && block.list) {
                    return block.list.map((item: string) => `• ${item}`).join('\n');
                }
                return '';
            }).filter(Boolean).join('\n\n');

            // Extract sources from AI Overview
            const sources = (aiOverview.sources || []).map((src: any) => ({
                title: src.title || '',
                url: src.link || '',
                domain: this.extractDomain(src.link || '')
            }));

            return {
                text: fullText,
                sources,
                brandMentioned: false, // Will be filled by caller after analysis
                brandPosition: null
            };

        } catch (error) {
            console.error('[AI Overview] Failed to fetch:', error);
            return null;
        }
    }

    /**
     * Run a visibility check on Google AI Overview for a specific query
     * Returns what users see in the AI Overview box when they Google something
     */
    static async checkGoogleAiOverviewVisibility(
        brandName: string,
        competitors: string[],
        query: string,
        language: string = 'en',
        territory: string = 'US'
    ): Promise<{
        aiOverview: {
            text: string;
            sources: Array<{ title: string; url: string; domain: string }>;
        } | null;
        brandMentioned: boolean;
        brandPosition: number | null;
        competitorPositions: Record<string, number | null>;
    }> {
        const overview = await this.fetchGoogleAiOverview(query, language, territory);

        if (!overview) {
            return {
                aiOverview: null,
                brandMentioned: false,
                brandPosition: null,
                competitorPositions: {}
            };
        }

        // Analyze the AI Overview text for brand mentions
        const text = overview.text.toLowerCase();
        const brandLower = brandName.toLowerCase();

        // Check if brand is mentioned
        const brandMentioned = text.includes(brandLower);

        // Find position (simple: count occurrences before brand mention)
        let brandPosition: number | null = null;
        if (brandMentioned) {
            // Split by common separators and find brand position
            const parts = text.split(/[,;.\n]/);
            for (let i = 0; i < parts.length; i++) {
                if (parts[i].includes(brandLower)) {
                    brandPosition = i + 1;
                    break;
                }
            }
        }

        // Check competitor positions
        const competitorPositions: Record<string, number | null> = {};
        for (const competitor of competitors) {
            const compLower = competitor.toLowerCase();
            if (text.includes(compLower)) {
                const parts = text.split(/[,;.\n]/);
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].includes(compLower)) {
                        competitorPositions[competitor] = i + 1;
                        break;
                    }
                }
            } else {
                competitorPositions[competitor] = null;
            }
        }

        return {
            aiOverview: {
                text: overview.text,
                sources: overview.sources
            },
            brandMentioned,
            brandPosition,
            competitorPositions
        };
    }

    /**
     * Fetch results from Google SERP API
     */
    private static async fetchSerpResults(
        apiKey: string,
        query: string,
        language: string,
        territory: string
    ): Promise<Array<{
        title: string;
        url: string;
        snippet: string;
        displayedLink?: string;
        publishedDate?: Date;
        position: number;
        sourceDomain: string;
        sourceType: string;
        sourceReputation: number;
    }>> {
        // Using SerpAPI format (most common SERP API)
        const params = new URLSearchParams({
            api_key: apiKey,
            q: query,
            hl: language,
            gl: territory,
            num: '20', // Get top 20 results
            tbm: 'nws' // News search for recent mentions
        });

        const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`SERP API error: ${error}`);
        }

        const data = await response.json();

        // Parse news results (or organic results if news is empty)
        const results = data.news_results || data.organic_results || [];

        return results.map((item: any, index: number) => {
            let url = item.link || item.url || '';
            // Ensure URL has protocol to avoid parsing errors
            if (url && !url.startsWith('http')) url = 'https://' + url;
            const domain = this.extractDomain(url);
            const sourceInfo = this.getSourceInfo(domain);

            // Validate publishedDate - only use if it creates a valid Date
            let publishedDate: Date | undefined = undefined;
            if (item.date) {
                const parsedDate = new Date(item.date);
                if (!isNaN(parsedDate.getTime())) {
                    publishedDate = parsedDate;
                }
            }

            return {
                title: item.title || '',
                url,
                snippet: item.snippet || item.description || '',
                displayedLink: item.displayed_link || domain,
                publishedDate,
                position: index + 1,
                sourceDomain: domain,
                sourceType: sourceInfo.type,
                sourceReputation: sourceInfo.score
            };
        });
    }

    /**
     * Extract domain from URL
     */
    private static extractDomain(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return 'unknown';
        }
    }

    /**
     * Get source reputation and type
     */
    private static getSourceInfo(domain: string): { score: number; type: string } {
        // Check exact match
        if (SOURCE_REPUTATIONS[domain]) {
            return SOURCE_REPUTATIONS[domain];
        }

        // Check if it's a subdomain of known source
        for (const [knownDomain, info] of Object.entries(SOURCE_REPUTATIONS)) {
            if (domain.endsWith(`.${knownDomain}`) || domain === knownDomain) {
                return info;
            }
        }

        // Infer type from domain
        if (domain.includes('news') || domain.includes('giornale') || domain.includes('quotidiano')) {
            return { score: 60, type: 'news' };
        }
        if (domain.includes('blog')) {
            return { score: 40, type: 'blog' };
        }
        if (domain.includes('forum')) {
            return { score: 35, type: 'forum' };
        }
        if (domain.endsWith('.gov') || domain.endsWith('.gov.it')) {
            return { score: 85, type: 'government' };
        }

        // Default
        return { score: 50, type: 'unknown' };
    }

    /**
     * Analyze SERP results using AI
     */
    private static async analyzeResults(
        results: Array<{
            title: string;
            url: string;
            snippet: string;
            displayedLink?: string;
            publishedDate?: Date;
            position: number;
            sourceDomain: string;
            sourceType: string;
            sourceReputation: number;
        }>,
        brandName: string,
        competitors: string[]
    ) {
        const { model } = await getSystemLLM();

        // Batch analyze for efficiency (max 5 at a time to avoid token limits)
        const batchSize = 5;
        const analyzedResults: Array<typeof results[0] & { analysis: z.infer<typeof SerpAnalysisSchema> }> = [];

        for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);

            const { object } = await generateObject({
                model,
                schema: BatchAnalysisSchema,
                prompt: `Analizza i seguenti risultati di ricerca Google relativi al brand "${brandName}".

Competitor da considerare: ${competitors.join(', ') || 'Nessuno specificato'}

Per ogni risultato, valuta:
1. SENTIMENT: Il tono generale verso il brand (positive/negative/neutral/mixed)
2. SENTIMENT SCORE: Valore continuo da -1 (molto negativo) a 1 (molto positivo)
3. RELEVANCE: Quanto è rilevante per il brand (0-100)
4. TIPO DI MENZIONE: direct (il brand è il soggetto), indirect (menzione secondaria), competitor_comparison, industry_mention
5. CATEGORIA: product, service, leadership, controversy, award, partnership, financial, legal, general
6. ENTITÀ CHIAVE: Persone, aziende, prodotti menzionati
7. RIASSUNTO: 2-3 frasi che catturano il contenuto
8. IMPATTO SU LLM: Questo contenuto potrebbe influenzare come gli LLM percepiscono/raccomandano il brand?
9. AZIONI SUGGERITE: Cosa dovrebbe fare l'azienda? (respond, monitor, amplify, address, ignore)

RISULTATI DA ANALIZZARE:
${batch.map((r, idx) => `
[${idx + 1}] Fonte: ${r.sourceDomain} (Reputazione: ${r.sourceReputation}/100)
Titolo: ${r.title}
Snippet: ${r.snippet}
`).join('\n---\n')}

Restituisci un array di analisi, una per ogni risultato nell'ordine dato.`,
                temperature: 0.1
            });

            // Merge analysis with original results
            for (let j = 0; j < batch.length; j++) {
                if (object.analyses[j]) {
                    analyzedResults.push({
                        ...batch[j],
                        analysis: object.analyses[j]
                    });
                }
            }
        }

        return analyzedResults;
    }

    /**
     * Calculate overall importance score
     */
    private static calculateImportanceScore(result: {
        sourceReputation: number;
        position: number;
        analysis: {
            relevanceScore: number;
            sentimentScore: number;
            brandMentionType: string;
        };
    }): number {
        // Weights for different factors
        const weights = {
            sourceReputation: 0.30,    // 30% - Source credibility
            relevance: 0.25,           // 25% - How relevant to brand
            position: 0.15,            // 15% - Search ranking position
            mentionType: 0.15,         // 15% - Direct vs indirect mention
            sentimentAbsolute: 0.15    // 15% - Strong sentiment (positive or negative) = more important
        };

        // Normalize position (1st = 100, 20th = 5)
        const positionScore = Math.max(5, 100 - (result.position - 1) * 5);

        // Mention type score
        const mentionTypeScores: Record<string, number> = {
            'direct': 100,
            'competitor_comparison': 80,
            'indirect': 50,
            'industry_mention': 30
        };
        const mentionScore = mentionTypeScores[result.analysis.brandMentionType] || 50;

        // Absolute sentiment (both very positive and very negative are important)
        const sentimentAbsolute = Math.abs(result.analysis.sentimentScore) * 100;

        // Calculate weighted score
        const importanceScore =
            (result.sourceReputation * weights.sourceReputation) +
            (result.analysis.relevanceScore * weights.relevance) +
            (positionScore * weights.position) +
            (mentionScore * weights.mentionType) +
            (sentimentAbsolute * weights.sentimentAbsolute);

        return Math.round(importanceScore);
    }

    /**
     * Get recent SERP results for an organization
     */
    static async getRecentResults(organizationId: string, limit: number = 50) {
        const config = await prisma.visibilityConfig.findFirst({
            where: { organizationId }
        });

        if (!config) return { results: [], scans: [] };

        const recentScans = await prisma.serpMonitoringScan.findMany({
            where: { configId: config.id, status: 'completed' },
            orderBy: { completedAt: 'desc' },
            take: 5,
            include: {
                results: {
                    orderBy: { importanceScore: 'desc' },
                    take: limit
                }
            }
        });

        // Flatten and deduplicate results by URL
        const seenUrls = new Set<string>();
        const allResults = recentScans.flatMap(scan => scan.results).filter(r => {
            if (seenUrls.has(r.url)) return false;
            seenUrls.add(r.url);
            return true;
        }).slice(0, limit);

        return {
            results: allResults,
            scans: recentScans.map(s => ({
                id: s.id,
                query: s.query,
                dateRange: s.dateRange,
                completedAt: s.completedAt,
                totalResults: s.totalResults,
                positiveCount: s.positiveCount,
                negativeCount: s.negativeCount,
                neutralCount: s.neutralCount,
                avgImportance: s.avgImportance
            }))
        };
    }

    /**
     * Get SERP data summary for cross-channel insights
     */
    static async getSerpSummaryForInsights(organizationId: string) {
        const { results, scans } = await this.getRecentResults(organizationId, 20);

        if (results.length === 0) {
            return null;
        }

        // Aggregate metrics
        const totalPositive = results.filter(r => r.sentiment === 'positive').length;
        const totalNegative = results.filter(r => r.sentiment === 'negative').length;
        const avgImportance = results.reduce((sum, r) => sum + r.importanceScore, 0) / results.length;

        // Group by topic category
        const byCategory: Record<string, number> = {};
        results.forEach(r => {
            const cat = r.topicCategory || 'general';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        });

        // High importance items (alerts)
        const alerts = results
            .filter(r => r.importanceScore >= 70 || r.sentiment === 'negative')
            .slice(0, 5)
            .map(r => ({
                title: r.title,
                url: r.url,
                sentiment: r.sentiment,
                importance: r.importanceScore,
                summary: r.contentSummary,
                source: r.sourceDomain
            }));

        return {
            totalMentions: results.length,
            sentimentBreakdown: {
                positive: totalPositive,
                negative: totalNegative,
                neutral: results.length - totalPositive - totalNegative
            },
            avgImportance: Math.round(avgImportance),
            topCategories: Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([category, count]) => ({ category, count })),
            recentAlerts: alerts,
            lastScanAt: scans[0]?.completedAt || null
        };
    }
}
