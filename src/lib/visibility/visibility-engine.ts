import { prisma } from '@/lib/prisma';
import { queryVisibilityLLM, getSystemLLM, getAdminApiKey } from './llm-providers';
import { SerpMonitoringEngine } from './serp-monitoring-engine';
import { generateObject } from 'ai';
import { z } from 'zod';
import { CrossChannelSyncEngine } from '../insights/sync-engine';

const AnalysisSchema = z.object({
    brandMentioned: z.boolean(),
    brandPosition: z.number().nullable().describe("Position in the list (1-based), or null if not mentioned"),
    competitorPositions: z.record(z.string(), z.number().nullable()).describe("Map of competitor names to their positions"),
    sentiment: z.enum(['positive', 'neutral', 'negative']).nullable(),
    sourcesCited: z.array(z.string()).describe("List of sources/links cited if any")
});

export class VisibilityEngine {
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
                        config.competitors.map(c => c.name)
                    );

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
                            sourcesCited: analysis.sourcesCited,
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
                                config.territory
                            );
                        } else {
                            // First scan: try to find a working variant
                            aiOverviewResult = await SerpMonitoringEngine.checkGoogleAiOverviewVisibility(
                                config.brandName,
                                config.competitors.map(c => c.name),
                                prompt.text,
                                config.language,
                                config.territory
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
    private static async analyzeResponse(text: string, brandName: string, competitors: string[]) {
        try {
            console.log(`[visibility] Analyzing response for brand "${brandName}"...`);
            const { model, provider } = await getSystemLLM();
            console.log(`[visibility] Using ${provider} for analysis`);
            const { object } = await generateObject({
                model,
                schema: AnalysisSchema,
                prompt: `Analyze the following text which represents an LLM's response to a user query.

Product/Brand to track: "${brandName}"
Competitors: ${JSON.stringify(competitors)}

Determine:
1. Is "${brandName}" mentioned?
2. If yes, what is its position in the list/text (1-based index)?
3. For each competitor, are they mentioned and at what position?
4. What is the overall sentiment towards "${brandName}"?
5. Extract ALL sources, websites, or references cited in the response:
   - Include full URLs if mentioned (e.g., "https://example.com/article")
   - Include domain names if full URL is not available (e.g., "TechCrunch", "example.com")
   - Capture any named sources (e.g., "According to Forbes...", "Source: Gartner")
   - Include markdown links (e.g., "[Site](https://site.com)")
   - This is critical for understanding which sources inform LLM recommendations

Text to analyze:
"""
${text.substring(0, 8000)}
"""`,
                temperature: 0
            });

            console.log(`[visibility] Analysis complete: brandMentioned=${object.brandMentioned}, position=${object.brandPosition}`);
            return object;
        } catch (error) {
            console.error('[visibility] Analysis failed:', error);
            // Fallback default
            return {
                brandMentioned: false,
                brandPosition: null, // Ensure explicit null
                competitorPositions: {},
                sentiment: null, // Ensure explicit null
                sourcesCited: []
            };
        }
    }
}
