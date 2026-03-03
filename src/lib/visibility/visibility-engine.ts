import { prisma } from '@/lib/prisma';
import { queryVisibilityLLM, getSystemLLM, getAdminApiKey } from './llm-providers';
import { SerpMonitoringEngine } from './serp-monitoring-engine';
import { generateObject } from 'ai';
import { z } from 'zod';
import { CrossChannelSyncEngine } from '../insights/sync-engine';
import { sanitize, sanitizeConfig } from '@/lib/llm/prompt-sanitizer';
import { findAnyNameMentionPosition, findNameMentionPosition, namesLikelySame } from './name-matching';

const AnalysisSchema = z.object({
    brandMentioned: z.boolean(),
    brandPosition: z.number().nullable().describe("Position in the list (1-based), or null if not mentioned"),
    competitorPositions: z
        .record(z.string(), z.any())
        .transform((value) => VisibilityEngine.normalizeCompetitorPositions(value))
        .describe("Map of competitor names to their positions (number or null)"),
    sentiment: z.enum(['positive', 'neutral', 'negative']).nullable(),
    sourcesCited: z.array(z.string()).describe("List of sources/links cited if any")
});

const AutoCompetitorSuggestionSchema = z.object({
    suggestions: z.array(z.string()).describe('Potential competitor names extracted from responses')
});

export class VisibilityEngine {
    static normalizeCompetitorPositions(input: Record<string, any>): Record<string, number | null> {
        if (!input || typeof input !== 'object') return {};
        const result: Record<string, number | null> = {};
        for (const [key, value] of Object.entries(input)) {
            if (value === null || value === undefined) {
                result[key] = null;
                continue;
            }
            if (typeof value === 'number') {
                result[key] = Number.isFinite(value) ? value : null;
                continue;
            }
            if (typeof value === 'object') {
                const pos = (value as any).position;
                result[key] = typeof pos === 'number' && Number.isFinite(pos) ? pos : null;
                continue;
            }
            result[key] = null;
        }
        return result;
    }
    private static normalizeSourceUrl(source: string): string | null {
        const trimmed = source.trim().replace(/[)\],.;:]+$/g, '');
        if (!trimmed) return null;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        if (trimmed.includes('.') && !/\s/.test(trimmed)) {
            return `https://${trimmed.replace(/^www\./, '')}`;
        }
        return null;
    }

    private static normalizeSources(sources: string[]): string[] {
        const normalized = sources
            .map(s => this.normalizeSourceUrl(s))
            .filter((s): s is string => !!s);
        return Array.from(new Set(normalized));
    }
    /**
     * Run a visibility scan for a specific configuration
     */
    static async runScan(configId: string) {
        // 1. Fetch config with prompts and competitors
        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            include: {
                prompts: { where: { enabled: true }, orderBy: { orderIndex: 'asc' }, take: 10 },
                competitors: { where: { enabled: true } }
            }
        });

        if (!config) throw new Error(`Config ${configId} not found`);

        // 2. Create Scan Record
        const scan = await prisma.visibilityScan.create({
            data: {
                configId: config.id,
                status: 'running',
                scanType: 'manual', // or scheduled, passed as arg
                startedAt: new Date(),
                score: 0 // Will be updated later
            }
        });

        const results = [];
        const providers = ['openai', 'anthropic', 'gemini'] as const;

        try {
            // Check if Google SERP API is configured for AI Overviews
            const serpApiKey = await getAdminApiKey('GOOGLE_SERP');
            const hasGoogleAiOverview = !!serpApiKey;

            // 3. Iterate over prompts
            for (const prompt of config.prompts) {
                // Run queries in parallel for all providers (including Google AI Overview)
                type ProviderResult = { provider: string; response: any } | null;
                const providerPromises: Promise<ProviderResult>[] = providers.map(async (provider) => {
                    // Query LLM (returns null if failed/missing key)
                    console.log(`[visibility] Querying ${provider}...`);
                    const llmResult = await queryVisibilityLLM(
                        provider,
                        prompt.text,
                        config.language,
                        config.territory
                    );

                    if (!llmResult) {
                        console.log(`[visibility] ${provider} returned null (failed or not configured)`);
                        return null;
                    }
                    console.log(`[visibility] ${provider} returned response (${llmResult.text.length} chars)`);

                    // Analyze response
                    const analysis = await this.analyzeResponse(
                        llmResult.text,
                        config.brandName,
                        config.brandAliases || [],
                        config.competitors.map(c => c.name)
                    );
                    const normalizedSources = this.normalizeSources(analysis.sourcesCited || []);

                    // Save response
                    console.log(`[visibility] Saving response for ${provider}...`);
                    const response = await prisma.visibilityResponse.create({
                        data: {
                            scanId: scan.id,
                            promptId: prompt.id,
                            platform: provider,
                            model: 'standard', // dynamic based on provider
                            responseText: llmResult.text,
                            brandMentioned: analysis.brandMentioned,
                            brandPosition: analysis.brandPosition,
                            competitorPositions: analysis.competitorPositions as any,
                            sentiment: analysis.sentiment,
                            sourcesCited: normalizedSources,
                            tokenUsage: llmResult.usage // Save token usage!
                        }
                    });

                    return { provider, response };
                });

                // Add Google AI Overview query (AI-generated box in Google Search results)
                // Only if enabled for this prompt and SERP API is configured
                const promptData = prompt as any; // Cast to access new fields
                if (hasGoogleAiOverview && promptData.aiOverviewEnabled !== false) {
                    providerPromises.push((async () => {
                        console.log(`[visibility] Querying Google AI Overview...`);

                        // Use saved variant if available, otherwise try to find one
                        const queryToUse = promptData.aiOverviewVariant || prompt.text;
                        const useSavedVariant = !!promptData.aiOverviewVariant;

                        let aiOverviewResult;
                        if (useSavedVariant) {
                            // Use saved variant directly (faster, no multiple API calls)
                            console.log(`[visibility] Using saved AI Overview variant: "${queryToUse}"`);
                            aiOverviewResult = await SerpMonitoringEngine.checkGoogleAiOverviewVisibility(
                                config.brandName,
                                config.competitors.map(c => c.name),
                                queryToUse,
                                config.language,
                                config.territory,
                                config.brandAliases || []
                            );
                        } else {
                            // First scan: try to find a working variant
                            aiOverviewResult = await SerpMonitoringEngine.checkGoogleAiOverviewVisibility(
                                config.brandName,
                                config.competitors.map(c => c.name),
                                prompt.text,
                                config.language,
                                config.territory,
                                config.brandAliases || []
                            );

                            // If found with a variant, save it for future scans
                            if (aiOverviewResult.aiOverview && aiOverviewResult.queryUsed) {
                                console.log(`[visibility] Saving working AI Overview variant: "${aiOverviewResult.queryUsed}"`);
                                await prisma.visibilityPrompt.update({
                                    where: { id: prompt.id },
                                    data: {
                                        aiOverviewVariant: aiOverviewResult.queryUsed,
                                        aiOverviewLastFound: new Date()
                                    }
                                });
                            } else if (aiOverviewResult.aiOverview) {
                                // Original query worked, save timestamp
                                await prisma.visibilityPrompt.update({
                                    where: { id: prompt.id },
                                    data: { aiOverviewLastFound: new Date() }
                                });
                            }
                        }

                        if (!aiOverviewResult.aiOverview) {
                            console.log(`[visibility] Google AI Overview not available for this query`);
                            return null;
                        }
                        console.log(`[visibility] Google AI Overview returned (${aiOverviewResult.aiOverview.text.length} chars)`);

                        // Save response
                        const response = await prisma.visibilityResponse.create({
                            data: {
                                scanId: scan.id,
                                promptId: prompt.id,
                                platform: 'google_ai_overview', // New platform: Google AI Mode / AI Overviews
                                model: 'ai_overview',
                                responseText: aiOverviewResult.aiOverview.text,
                                brandMentioned: aiOverviewResult.brandMentioned,
                                brandPosition: aiOverviewResult.brandPosition,
                                competitorPositions: aiOverviewResult.competitorPositions as any,
                                sentiment: null, // AI Overview doesn't have inherent sentiment
                                sourcesCited: aiOverviewResult.aiOverview.sources.map(s => s.url),
                                tokenUsage: { inputTokens: 0, outputTokens: 0 } // N/A for SERP
                            }
                        });

                        return { provider: 'google_ai_overview', response };
                    })());
                }

                const promptResults = await Promise.all(providerPromises);
                results.push(...promptResults.filter(r => r !== null));
            }

            // 4. Calculate Aggregate Score (only based on successful responses)
            console.log(`[visibility] All prompts processed. Results count: ${results.length}`);

            const validResponses = await prisma.visibilityResponse.findMany({
                where: { scanId: scan.id }
            });
            console.log(`[visibility] Valid responses in DB: ${validResponses.length}`);

            let totalScore = 0;
            if (validResponses.length > 0) {
                const mentions = validResponses.filter(r => r.brandMentioned).length;
                totalScore = Math.round((mentions / validResponses.length) * 100);
                console.log(`[visibility] Score: ${totalScore}% (${mentions}/${validResponses.length} mentions)`);
            }

            // 5. Update Scan Status
            await prisma.visibilityScan.update({
                where: { id: scan.id },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                    score: totalScore
                }
            });
            console.log(`[visibility] Scan ${scan.id} marked as completed with score ${totalScore}`);

            // 5.b Generate auto competitor suggestions (non-blocking)
            try {
                const autoCompetitorSuggestions = await this.generateAutoCompetitorSuggestions({
                    brandName: config.brandName,
                    category: config.category,
                    description: config.description || '',
                    existingCompetitors: config.competitors.map((c) => c.name),
                    responses: validResponses.map((r) => r.responseText).filter(Boolean)
                });

                await prisma.visibilityScanMetric.create({
                    data: {
                        scanId: scan.id,
                        metricType: 'auto_competitor_suggestions',
                        value: autoCompetitorSuggestions.length,
                        dimensions: {
                            suggestions: autoCompetitorSuggestions,
                            generatedAt: new Date().toISOString()
                        } as any
                    }
                });
            } catch (metricError) {
                console.error('[visibility] Auto competitor suggestions failed:', metricError);
            }

            // 6. Trigger Cross-Channel Sync
            try {
                await CrossChannelSyncEngine.sync(config.organizationId);
            } catch (e) {
                console.error('Cross-channel sync failed but scan completed:', e);
            }

            console.log(`[visibility] Scan complete! Returning success.`);
            return { success: true, scanId: scan.id, partial: results.length < (config.prompts.length * providers.length) };

        } catch (error) {
            console.error('Scan failed:', error);
            await prisma.visibilityScan.update({
                where: { id: scan.id },
                data: { status: 'failed' }
            });
            throw error;
        }
    }

    /**
     * Analyze LLM response to extract visibility metrics
     */
    private static async analyzeResponse(text: string, brandName: string, brandAliases: string[], competitors: string[]) {
        try {
            console.log(`[visibility] Analyzing response for brand "${brandName}"...`);
            const { model, provider } = await getSystemLLM({ preferLatestVisibilityModel: true });
            console.log(`[visibility] Using ${provider} for analysis`);
            const { object } = await generateObject({
                model,
                schema: AnalysisSchema,
                prompt: `Analyze the following text which represents an LLM's response to a user query.

Product/Brand to track: "${sanitizeConfig(brandName, 200)}"
Known brand variants/aliases: ${JSON.stringify((brandAliases || []).map((v) => sanitizeConfig(v, 100)))}
Competitors: ${JSON.stringify(competitors.map(c => sanitizeConfig(c, 100)))}

Determine:
1. Is "${sanitizeConfig(brandName, 200)}" mentioned?
2. If yes, what is its position in the list/text (1-based index)?
3. For each competitor, are they mentioned and at what position?
4. What is the overall sentiment towards "${brandName}"?
5. Extract ALL sources, websites, or references cited in the response:
   - Return only full URLs (http/https). If only a domain is present, return it as "example.com" so it can be converted to https://example.com
   - Include markdown links by extracting the URL target (e.g., "[Site](https://site.com)" -> "https://site.com")
   - Do NOT include source names without a URL or domain (e.g., "Forbes" alone)
   - If you cannot identify a URL or domain, return an empty list

Text to analyze:
"""
${sanitize(text.substring(0, 8000), 8000)}
"""`,
                temperature: 0
            });

            console.log(`[visibility] Analysis complete: brandMentioned=${object.brandMentioned}, position=${object.brandPosition}`);
            const brandMatch = findAnyNameMentionPosition(text, [brandName, ...(brandAliases || [])]);
            const mergedBrandMentioned = Boolean(object.brandMentioned || brandMatch.mentioned);
            const mergedBrandPosition = object.brandPosition ?? brandMatch.position ?? null;

            const normalizedCompetitorPositions = this.normalizeCompetitorPositions(object.competitorPositions as any);
            for (const competitor of competitors) {
                if (normalizedCompetitorPositions[competitor] == null) {
                    const competitorMatch = findNameMentionPosition(text, competitor);
                    if (competitorMatch.mentioned) {
                        normalizedCompetitorPositions[competitor] = competitorMatch.position;
                    }
                }
            }

            return {
                ...object,
                brandMentioned: mergedBrandMentioned,
                brandPosition: mergedBrandPosition,
                competitorPositions: normalizedCompetitorPositions
            };
        } catch (error) {
            console.error('[visibility] Analysis failed:', error);
            const fallbackBrandMatch = findAnyNameMentionPosition(text, [brandName, ...(brandAliases || [])]);
            const fallbackCompetitorPositions: Record<string, number | null> = {};
            for (const competitor of competitors) {
                const competitorMatch = findNameMentionPosition(text, competitor);
                fallbackCompetitorPositions[competitor] = competitorMatch.mentioned ? competitorMatch.position : null;
            }
            return {
                brandMentioned: fallbackBrandMatch.mentioned,
                brandPosition: fallbackBrandMatch.position ?? null,
                competitorPositions: fallbackCompetitorPositions,
                sentiment: null, // Ensure explicit null
                sourcesCited: []
            };
        }
    }

    private static async generateAutoCompetitorSuggestions(input: {
        brandName: string;
        category: string;
        description: string;
        existingCompetitors: string[];
        responses: string[];
    }): Promise<string[]> {
        if (!input.responses.length) return [];

        const sampleResponses = input.responses
            .slice(0, 8)
            .map((r, idx) => `Response ${idx + 1}:\n${sanitize(r.slice(0, 1200), 1200)}`)
            .join('\n\n');

        const { model } = await getSystemLLM({ preferLatestVisibilityModel: true });
        const { object } = await generateObject({
            model,
            schema: AutoCompetitorSuggestionSchema,
            temperature: 0.2,
            prompt: `Identify likely direct competitors mentioned or implied in these Brand Monitor responses.

Brand: "${sanitizeConfig(input.brandName, 200)}"
Category: "${sanitizeConfig(input.category, 200)}"
Description: "${sanitizeConfig(input.description || '', 500)}"
Already tracked competitors: ${JSON.stringify(input.existingCompetitors.map((c) => sanitizeConfig(c, 100)))}

Rules:
- Return only concrete competitor brand/product names
- Exclude the brand itself and near-duplicates/typos of it
- Exclude competitors already tracked
- Max 8 items, ordered by relevance/frequency
- Output only the names

Responses:
${sampleResponses}`
        });

        const deduped: string[] = [];
        for (const rawName of object.suggestions || []) {
            const name = String(rawName || '').trim();
            if (!name) continue;
            if (namesLikelySame(name, input.brandName)) continue;
            if (input.existingCompetitors.some((c) => namesLikelySame(c, name))) continue;
            if (deduped.some((c) => namesLikelySame(c, name))) continue;
            deduped.push(name);
        }
        return deduped.slice(0, 8);
    }
}
