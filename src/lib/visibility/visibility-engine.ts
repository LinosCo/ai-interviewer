import { prisma } from '@/lib/prisma';
import { queryVisibilityLLM, getSystemLLM } from './llm-providers';
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
                prompts: { where: { enabled: true }, orderBy: { orderIndex: 'asc' } },
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
            // 3. Iterate over prompts
            for (const prompt of config.prompts) {
                // Run queries in parallel for all providers
                const providerPromises = providers.map(async (provider) => {
                    // Query LLM (returns null if failed/missing key)
                    const llmResult = await queryVisibilityLLM(
                        provider,
                        prompt.text,
                        config.language,
                        config.territory
                    );

                    if (!llmResult) return null; // Skip if failed

                    // Analyze response
                    const analysis = await this.analyzeResponse(
                        llmResult.text,
                        config.brandName,
                        config.competitors.map(c => c.name)
                    );

                    // Save response
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

                const promptResults = await Promise.all(providerPromises);
                results.push(...promptResults.filter(r => r !== null));
            }

            // 4. Calculate Aggregate Score (only based on successful responses)
            // Valid responses are those where brandMentioned is true or false (completed analysis)
            const validResponses = await prisma.visibilityResponse.findMany({
                where: { scanId: scan.id }
            });

            let totalScore = 0;
            if (validResponses.length > 0) {
                const mentions = validResponses.filter(r => r.brandMentioned).length;
                totalScore = Math.round((mentions / validResponses.length) * 100);
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

            // 6. Trigger Cross-Channel Sync
            try {
                await CrossChannelSyncEngine.sync(config.organizationId);
            } catch (e) {
                console.error('Cross-channel sync failed but scan completed:', e);
            }

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
            const { model } = await getSystemLLM();
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
                
                Text to analyze:
                """
                ${text.substring(0, 8000)}
                """`,
                temperature: 0
            });

            return object;
        } catch (error) {
            console.error('Analysis failed:', error);
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
