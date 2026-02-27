import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { sanitizeArray, sanitizeConfig } from '@/lib/llm/prompt-sanitizer';

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function aggregateChatbotAnalytics(targetDate: Date = new Date()) {
    // Process "yesterday" by default if today is passed, or process the specific date
    // Usually analytics run for the *previous* full day.
    const periodStart = startOfDay(targetDate);
    const periodEnd = endOfDay(targetDate);
    const periodString = periodStart.toISOString().split('T')[0]; // "YYYY-MM-DD"

    console.log(`[Analytics] Aggregating for ${periodString}...`);

    // 1. Get all bots that had activity
    const activeBots = await prisma.bot.findMany({
        where: {
            botType: 'chatbot',
            chatbotSessions: {
                some: {
                    createdAt: {
                        gte: periodStart,
                        lte: periodEnd
                    }
                }
            }
        },
        include: {
            chatbotSessions: {
                where: {
                    createdAt: {
                        gte: periodStart,
                        lte: periodEnd
                    }
                },
                include: {
                    conversation: {
                        include: {
                            messages: true
                        }
                    }
                }
            }
        }
    });

    for (const bot of activeBots) {
        const sessions = bot.chatbotSessions;
        const totalSessions = sessions.length;
        if (totalSessions === 0) continue;

        let totalMessages = 0;
        let totalDuration = 0;
        let leadsCollected = 0;
        let bounces = 0;

        for (const session of sessions) {
            const msgCount = session.messagesCount || session.conversation?.messages.length || 0;
            totalMessages += msgCount;

            // Bounce: 1 message only (user msg, maybe bot reply, but effectively no convo)
            // Or strictly: if user sent 1 message and left.
            if (msgCount <= 1) {
                bounces++;
            }

            // Duration
            if (session.createdAt && session.updatedAt) {
                const duration = (session.updatedAt.getTime() - session.createdAt.getTime()) / 1000;
                totalDuration += duration;
            }

            // Leads
            // Check if candidateProfile is present in conversation
            if (session.conversation?.candidateProfile) {
                leadsCollected++;
            }
        }

        const avgMessages = totalSessions > 0 ? totalMessages / totalSessions : 0;
        const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
        const bounceRate = totalSessions > 0 ? (bounces / totalSessions) * 100 : 0;

        // --- LLM Analysis ---
        let clusters: any[] = [];
        let gaps: any[] = [];
        let sentimentData = { average: 0, distribution: { positive: 0, neutral: 0, negative: 0 }, byTopic: {} };

        try {
            const allUserMessages = sessions.flatMap(s =>
                s.conversation?.messages
                    .filter(m => m.role === 'user')
                    .map(m => m.content) || []
            ).filter(msg => msg.length > 5); // Filter too short messages

            // Only analyze if we have enough data (e.g., > 5 messages) and API Key is set
            if (allUserMessages.length > 5 && process.env.OPENAI_API_KEY) {
                // Take a sample to avoid token limits, sanitize user content
                const sampleMessages = sanitizeArray(allUserMessages.slice(0, 100));

                const { object } = await generateObject({
                    model: openai('gpt-4o'),
                    temperature: 0,
                    schema: z.object({
                        clusters: z.array(z.object({
                            topic: z.string(),
                            count: z.number().describe("Estimated count of related questions"),
                            example: z.string()
                        })),
                        gaps: z.array(z.object({
                            topic: z.string(),
                            priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
                            evidence: z.array(z.string()).describe("Quotes from users proving this gap")
                        })),
                        sentiment: z.object({
                            average: z.number().min(-1).max(1),
                            positiveCount: z.number(),
                            neutralCount: z.number(),
                            negativeCount: z.number()
                        })
                    }),
                    prompt: `Analyze the following user messages from a chatbot session for a bot named "${sanitizeConfig(bot.name)}" (Goal: ${sanitizeConfig(bot.researchGoal) || 'General'}).

                    Messages:
                    ${JSON.stringify(sampleMessages)}

                    1. Group them into "Question Clusters" (common themes).
                    2. Identify "Knowledge Gaps" (questions that seem unanswered, frustrated users, or out-of-scope topics).
                    3. Estimate overall sentiment.
                    `
                });

                clusters = object.clusters;
                gaps = object.gaps;
                sentimentData = {
                    average: object.sentiment.average,
                    distribution: {
                        positive: object.sentiment.positiveCount,
                        neutral: object.sentiment.neutralCount,
                        negative: object.sentiment.negativeCount
                    },
                    byTopic: {}
                };

                // Persist detected gaps to KnowledgeGap table
                for (const gap of gaps) {
                    try {
                        const existing = await prisma.knowledgeGap.findFirst({
                            where: {
                                botId: bot.id,
                                topic: gap.topic,
                                status: 'pending'
                            }
                        });

                        if (!existing) {
                            await prisma.knowledgeGap.create({
                                data: {
                                    botId: bot.id,
                                    topic: gap.topic,
                                    priority: gap.priority,
                                    evidence: gap.evidence || [],
                                    status: 'pending'
                                }
                            });
                            console.log(`[Analytics] Created new Knowledge Gap: ${gap.topic}`);
                        }
                    } catch (e) {
                        console.error('Failed to save knowledge gap', e);
                    }
                }
            }
        } catch (error) {
            console.error(`[Analytics] LLM Analysis failed for bot ${bot.id}:`, error);
        }

        // Save to DB
        await prisma.chatbotAnalytics.upsert({
            where: {
                botId_period: {
                    botId: bot.id,
                    period: periodString
                }
            },
            create: {
                botId: bot.id,
                period: periodString,
                sessionsCount: totalSessions,
                messagesCount: totalMessages,
                avgSessionLength: avgDuration,
                leadsCollected: leadsCollected,
                bounceRate: bounceRate,
                questionClusters: clusters,
                knowledgeGaps: gaps,
                sentiment: sentimentData
            },
            update: {
                sessionsCount: totalSessions,
                messagesCount: totalMessages,
                avgSessionLength: avgDuration,
                leadsCollected: leadsCollected,
                bounceRate: bounceRate,
                // Do not overwrite complex fields if they were processed asynchronously?
                // For now, simple overwrite or keep existing if not null?
                // Docs imply a daily cron re-calculates everything.
            }
        });

        console.log(`[Analytics] Bot ${bot.slug}: ${totalSessions} sessions, ${leadsCollected} leads.`);
    }
}
