import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ChatbotAnalyticsView from "./ChatbotAnalyticsView";
import AnalyticsView from "./analytics-view"; // Interview analytics

export default async function AnalyticsPage({ params }: { params: Promise<{ botId: string }> }) {
    const { botId } = await params;
    const session = await auth();
    if (!session) redirect("/login");

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            conversations: {
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' }
                    }
                },
                orderBy: { startedAt: 'desc' },
                take: 100 // Last 100 sessions
            },
            topics: true,
            knowledgeGaps: {
                where: { status: 'pending' }
            }
        }
    });

    if (!bot) redirect("/dashboard");

    // Check if it's a chatbot or interview bot
    if ((bot as any).botType === 'chatbot') {
        // Chatbot Analytics
        return <ChatbotAnalyticsView bot={bot} sessions={(bot as any).conversations} gaps={(bot as any).knowledgeGaps} />;
    }

    // Interview Analytics (existing)
    const themes = await prisma.theme.findMany({
        where: { botId },
        include: {
            occurrences: true
        }
    });

    const insights = await prisma.insight.findMany({
        where: { botId }
    });

    return <AnalyticsView bot={bot} themes={themes} insights={insights} />;
}
