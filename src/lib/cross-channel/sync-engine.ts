import { prisma } from "@/lib/prisma";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { sanitize, sanitizeConfig } from '@/lib/llm/prompt-sanitizer';

const UnifiedInsightSchema = z.object({
    insights: z.array(z.object({
        title: z.string(),
        description: z.string(),
        source: z.enum(['chatbot', 'visibility', 'interview', 'cross-channel']),
        priority: z.number().describe("1-100"),
        suggestedAction: z.string()
    }))
});

export class CrossChannelSync {

    async runSync(orgId: string) {
        console.log(`[CrossChannel] Running sync for Org ${orgId}...`);

        // 1. Fetch Data Snapshot

        // Chatbot Gaps
        const gaps = await prisma.knowledgeGap.findMany({
            where: {
                bot: { project: { organizationId: orgId } },
                status: 'pending'
            },
            take: 10
        });

        // Visibility Data (Negative sentiment or low rank)
        // VisibilityPrompt connects to VisibilityConfig which has organizationId
        const visibilityIssues = await prisma.visibilityResponse.findMany({
            where: {
                prompt: {
                    visibilityConfig: { organizationId: orgId }
                },
                brandPosition: { gt: 3 } // Not in top 3
            },
            include: { prompt: true },
            take: 10
        });

        // 2. LLM Synthesis
        if (gaps.length === 0 && visibilityIssues.length === 0) {
            console.log("[CrossChannel] Not enough data to sync.");
            return;
        }

        const promptContext = `
        Gaps in Chatbot Knowledge:
        ${gaps.map(g => `- Topic: ${sanitizeConfig(g.topic, 200)} (${g.priority})`).join('\n')}

        Visibility Issues (Rank > 3):
        ${visibilityIssues.map(v => `- Query: "${sanitize(v.prompt?.text || 'unknown', 300)}" on ${v.platform} ranked #${v.brandPosition}`).join('\n')}
        `;

        try {
            const { object } = await generateObject({
                model: openai("gpt-4o-mini"),
                schema: UnifiedInsightSchema,
                prompt: `Analyze the following data from different channels and generate unified strategic insights.
                Look for patterns. E.g., if users ask about a feature (Gap) and we rank low for that feature (Visibility), that's a Critical Cross-Channel Insight.

                Data:
                ${promptContext}`
            });

            // 3. Save Insights
            for (const insight of object.insights) {
                // Check dupes based on title? assuming unique run
                await prisma.crossChannelInsight.create({
                    data: {
                        organizationId: orgId,
                        topicName: insight.title,
                        crossChannelScore: insight.priority,
                        priorityScore: insight.priority,
                        suggestedActions: [{ action: insight.suggestedAction }],
                        status: 'new'
                    }
                });
            }
            console.log(`[CrossChannel] Generated ${object.insights.length} insights.`);

        } catch (error) {
            console.error("CrossChannel Sync Failed", error);
        }
    }
}
