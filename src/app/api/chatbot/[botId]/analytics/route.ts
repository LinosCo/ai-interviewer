import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    const { botId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Verify access
    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: { project: { include: { accessList: true, organization: { include: { members: true } } } } }
    });

    if (!bot) return new NextResponse("Bot not found", { status: 404 });

    // Check permissions (assuming org membership or project access)
    // Simplified checks for brevity, assuming standard RBAC
    const userId = session.user.id;
    const isOwner = bot.project.ownerId === userId;
    const isMember = bot.project.organization?.members.some(m => m.userId === userId);

    if (!isOwner && !isMember) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '7d';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (range === '30d') startDate.setDate(endDate.getDate() - 30);
    else if (range === '90d') startDate.setDate(endDate.getDate() - 90);
    else startDate.setDate(endDate.getDate() - 7);

    try {
        // Fetch aggregated analytics (ChatbotAnalytics)
        // Note: period is stored as YYYY-MM-DD
        const analytics = await prisma.chatbotAnalytics.findMany({
            where: {
                botId,
                period: {
                    gte: startDate.toISOString().split('T')[0],
                    lte: endDate.toISOString().split('T')[0]
                }
            },
            orderBy: { period: 'asc' }
        });

        // Compute totals
        const totals = analytics.reduce((acc, curr) => ({
            sessions: acc.sessions + curr.sessionsCount,
            messages: acc.messages + curr.messagesCount,
            leads: acc.leads + curr.leadsCollected,
            bounces: 0 // Avg bounce rate needs weighted avg
        }), { sessions: 0, messages: 0, leads: 0, bounces: 0 });

        // Format daily data
        const dailyData = analytics.map(a => ({
            date: a.period,
            sessions: a.sessionsCount,
            messages: a.messagesCount,
            leads: a.leadsCollected
        }));

        return NextResponse.json({
            range,
            totals,
            dailyData,
            // Top questions placeholder (from analytics.questionClusters if implemented)
            topQuestions: analytics.flatMap(a => a.questionClusters as any[]).slice(0, 5)
        });

    } catch (error) {
        console.error("[AnalyticsAPI] Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
