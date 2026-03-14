'use server';

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getConfigValue } from '@/lib/config';

export async function generateConversationInsightAction(conversationId: string) {
    // 1. Fetch Data
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            messages: true,
            bot: {
                include: { topics: true }
            }
        }
    });

    if (!conversation) throw new Error("Conversation not found");
    // Ensure we have enough messages to analyze
    if (conversation.messages.length < 4) {
        console.log("Conversation too short for analysis:", conversationId);
        return;
    }

    // 2. Resolve Key (Use Bot key or centralised config)
    let apiKey = conversation.bot.openaiApiKey;
    if (!apiKey) {
        apiKey = await getConfigValue('openaiApiKey');
    }

    if (!apiKey) {
        console.error("No API key for analysis");
        return;
    }

    const openai = createOpenAI({ apiKey });

    // 3. Prepare Transcript
    const transcript = conversation.messages.map((m: any) => `${m.role}: "${m.content}"`).join("\n");
    const structuredTurns = conversation.messages
        .filter((message: any) => message.role === 'assistant' && message.metadata)
        .map((message: any) => {
            const metadata = (message.metadata as Record<string, any>) || {};
            return {
                topicLabel: metadata.topicLabel || null,
                topicImportanceBand: metadata.topicImportanceBand || null,
                subGoal: metadata.subGoal || null,
                subGoalCoverageTier: metadata.subGoalCoverageTier || null,
                highValueTurn: Boolean(metadata.highValueTurn),
            };
        })
        .filter((turn: any) => turn.topicLabel || turn.subGoal);

    // 4. Analyze
    const schema = z.object({
        summary: z.string().describe("Brief summary of the main points discussed"),
        topicCoverage: z.number().describe("0 to 1 score of how well goals were met"),
        sentimentScore: z.number().describe("-1 (Negative) to 1 (Positive)"),
        keyQuotes: z.array(z.string()).describe("3-5 exact, meaningful quotes from the user"),
        topicDetails: z.array(z.object({
            label: z.string(),
            summary: z.string(),
            keywords: z.array(z.string()),
            reached: z.boolean().optional(),
            coreSubGoalsCovered: z.number().int().optional(),
            totalCoreSubGoals: z.number().int().optional(),
            stretchSubGoalsCovered: z.number().int().optional(),
            totalEnabledSubGoals: z.number().int().optional(),
            keyEvidence: z.array(z.string()).optional(),
        })).optional().describe("Breakdown of what was discussed per topic"),
        subGoalDetails: z.array(z.object({
            topicLabel: z.string(),
            label: z.string(),
            covered: z.boolean(),
            coverageTier: z.enum(['target', 'stretch', 'overflow', 'disabled']).optional(),
            evidence: z.array(z.string()).optional(),
        })).optional(),
        highValueTurns: z.array(z.object({
            topicLabel: z.string().optional(),
            subGoal: z.string().optional(),
            quote: z.string(),
        })).optional().describe("Breakdown of what was discussed per topic")
    });

    const topicsContext = conversation.bot.topics.map((t: any) => `- ${t.label}: ${t.description}`).join("\n");

    try {
        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            schema,
            prompt: `Analyze this interview transcript based on the Research Goal and defined Topics.
            
            GOAL: "${conversation.bot.researchGoal}"
            
            TOPICS DEFINED:
            ${topicsContext}

            ASSISTANT STRUCTURED COVERAGE HINTS:
            ${JSON.stringify(structuredTurns).slice(0, 12000)}

            Transcript:
            ${transcript.substring(0, 50000)}
            
            Task:
            1. Summarize the user's main feedback.
            2. Estimate Topic Coverage (0.0 to 1.0).
            3. Sentiment Analysis (-1 to 1).
            4. Extract the most valuable user quotes.
            5. Identify which topics were discussed and what were the main keywords for each.`
        });

        // 5. Save to DB
        await prisma.conversationAnalysis.upsert({
            where: { conversationId },
            update: {
                topicCoverage: object.topicCoverage,
                sentimentScore: object.sentimentScore,
                keyQuotes: object.keyQuotes as any,
                metadata: {
                    summary: object.summary,
                    topicDetails: (object as any).topicDetails,
                    subGoalDetails: (object as any).subGoalDetails,
                    highValueTurns: (object as any).highValueTurns,
                } as any
            },
            create: {
                conversationId,
                topicCoverage: object.topicCoverage,
                sentimentScore: object.sentimentScore,
                keyQuotes: object.keyQuotes as any,
                metadata: {
                    summary: object.summary,
                    topicDetails: (object as any).topicDetails,
                    subGoalDetails: (object as any).subGoalDetails,
                    highValueTurns: (object as any).highValueTurns,
                } as any
            }
        });

        revalidatePath(`/dashboard/bots/${conversation.botId}/analytics`);
        console.log("Analysis Saved for:", conversationId);

    } catch (e) {
        console.error("Analysis Failed", e);
    }
}
