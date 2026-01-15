import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AnalyticsView from "./analytics-view";

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
                orderBy: { startedAt: 'desc' }
            },
            topics: true
        }
    });

    if (!bot) redirect("/dashboard");

    // Fetch themes and insights
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
