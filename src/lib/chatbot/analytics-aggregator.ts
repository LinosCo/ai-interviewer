import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";

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
                questionClusters: [], // TODO: Implement LLM Clustering
                knowledgeGaps: [],    // TODO: Implement Gap Detection
                sentiment: { average: 0, distribution: { positive: 0, neutral: 0, negative: 0 }, byTopic: {} }
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
