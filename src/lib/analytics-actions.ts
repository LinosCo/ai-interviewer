'use server';

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

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

    // 2. Resolve Key (Use Bot key or fallback)
    let apiKey = conversation.bot.openaiApiKey;
    if (!apiKey) {
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: "default" },
            select: { openaiApiKey: true }
        });
        apiKey = globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY || null;
    }

    if (!apiKey) {
        console.error("No API key for analysis");
        return;
    }

    const openai = createOpenAI({ apiKey });

    // 3. Prepare Transcript
    const transcript = conversation.messages.map((m: any) => `${m.role}: "${m.content}"`).join("\n");

    // 4. Analyze
    const schema = z.object({
        summary: z.string().describe("Brief summary of the main points discussed"),
        topicCoverage: z.number().describe("0 to 1 score of how well goals were met"),
        sentimentScore: z.number().describe("-1 (Negative) to 1 (Positive)"),
        keyQuotes: z.array(z.string()).describe("3-5 exact, meaningful quotes from the user"),
        topicDetails: z.array(z.object({
            label: z.string(),
            summary: z.string(),
            keywords: z.array(z.string())
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
                metadata: { summary: object.summary, topicDetails: (object as any).topicDetails } as any
            },
            create: {
                conversationId,
                topicCoverage: object.topicCoverage,
                sentimentScore: object.sentimentScore,
                keyQuotes: object.keyQuotes as any,
                metadata: { summary: object.summary, topicDetails: (object as any).topicDetails } as any
            }
        });

        revalidatePath(`/dashboard/bots/${conversation.botId}/analytics`);
        console.log("Analysis Saved for:", conversationId);

    } catch (e) {
        console.error("Analysis Failed", e);
    }
}
