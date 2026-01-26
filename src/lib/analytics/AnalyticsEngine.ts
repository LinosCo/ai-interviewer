import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Types for our unified insights
export interface UnifiedInsight {
    type: 'CONTENT_SUGGESTION' | 'INTERVIEW_QUESTION' | 'KB_UPDATE' | 'AD_CAMPAIGN';
    title: string;
    description: string;
    confidence: number;
    source: 'CHATBOT' | 'INTERVIEW' | 'HYBRID';
    reasoning: string;
}

export interface UnifiedStats {
    totalConversations: number;
    totalMessages: number;
    avgSentiment: number;
    avgDuration: number; // in seconds
    completionRate: number;
    trends: MetricTrend[];
    // New enhanced stats
    interviewCount: number;
    chatbotCount: number;
    avgNpsScore: number | null;
    topThemes: { name: string; count: number; sentiment: number }[];
    knowledgeGaps: string[];
    leadsCaptured: number;
    avgResponseLength: number;
}

export interface MetricTrend {
    date: string;
    volume: number;
    sentiment: number;
}

export class AnalyticsEngine {

    /**
     * Aggregates data for a given Project to generate unified insights and stats.
     */
    static async generateProjectInsights(projectId: string, botIds?: string[]): Promise<{ insights: UnifiedInsight[], stats: UnifiedStats }> {
        // 1. Fetch all bots in the project
        const whereClause: import('@prisma/client').Prisma.BotWhereInput = { projectId };

        if (botIds && botIds.length > 0) {
            whereClause.id = { in: botIds };
        }

        const bots = await prisma.bot.findMany({
            where: whereClause,
            include: {
                conversations: {
                    orderBy: { startedAt: 'desc' },
                    // Analyze last 30 days for stats
                    where: { startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                    include: {
                        themeOccurrences: { include: { theme: true } },
                        analysis: true,
                        messages: { select: { id: true } } // needed for counting
                    }
                }
            }
        });

        const allConversations = bots.flatMap(b => b.conversations);
        const chatbotConversations = bots.filter(b => b.botType === 'chatbot').flatMap(b => b.conversations);
        const interviewConversations = bots.filter(b => b.botType === 'interview' || !b.botType).flatMap(b => b.conversations);

        // --- Calculate Stats ---
        const totalConversations = allConversations.length;
        const totalMessages = allConversations.reduce((acc, c) => acc + c.messages.length, 0);

        // Sentiment averaging
        const sentimentScores = allConversations
            .map(c => c.analysis?.sentimentScore)
            .filter(s => s !== undefined && s !== null) as number[];
        const avgSentiment = sentimentScores.length > 0
            ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
            : 0;

        // Duration & Completion
        const completedConvos = allConversations.filter(c => c.status === 'COMPLETED' || c.completedAt);
        const completionRate = totalConversations > 0 ? (completedConvos.length / totalConversations) * 100 : 0;

        const durations = completedConvos
            .map(c => c.completedAt && c.startedAt ? (new Date(c.completedAt).getTime() - new Date(c.startedAt).getTime()) / 1000 : 0)
            .filter(d => d > 0);
        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        // --- Calculate Trends (Daily) ---
        const trendsMap = new Map<string, { volume: number, sentimentSum: number, sentimentCount: number }>();

        // Initialize last 30 days
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            trendsMap.set(dateKey, { volume: 0, sentimentSum: 0, sentimentCount: 0 });
        }

        allConversations.forEach(c => {
            if (c.startedAt) {
                const dateKey = new Date(c.startedAt).toISOString().split('T')[0];
                if (trendsMap.has(dateKey)) {
                    const entry = trendsMap.get(dateKey)!;
                    entry.volume++;
                    if (c.analysis?.sentimentScore !== undefined && c.analysis.sentimentScore !== null) {
                        entry.sentimentSum += c.analysis.sentimentScore;
                        entry.sentimentCount++;
                    }
                }
            }
        });

        const trends: MetricTrend[] = Array.from(trendsMap.entries()).map(([date, data]) => ({
            date: new Date(date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }),
            volume: data.volume,
            sentiment: data.sentimentCount > 0 ? (data.sentimentSum / data.sentimentCount) * 100 : 0
        }));

        // --- Calculate Enhanced Stats ---
        const interviewCount = interviewConversations.length;
        const chatbotCount = chatbotConversations.length;

        // NPS Score (from interview analyses)
        const npsScores = interviewConversations
            .map(c => (c.analysis?.metadata as Record<string, any> | null)?.npsScore)
            .filter((s): s is number => typeof s === 'number');
        const avgNpsScore = npsScores.length > 0
            ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length
            : null;

        // Top Themes (combined)
        const allThemes = this.extractThemes(allConversations);
        const topThemes = allThemes
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5)
            .map(t => ({ name: t.name, count: t.frequency, sentiment: t.sentiment }));

        // Knowledge Gaps (from chatbot analytics)
        const chatbotAnalytics = await prisma.chatbotAnalytics.findMany({
            where: { bot: { projectId } },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        const knowledgeGaps = chatbotAnalytics
            .flatMap(a => (a.knowledgeGaps as string[]) || [])
            .filter((gap, idx, arr) => arr.indexOf(gap) === idx)
            .slice(0, 5);

        // Leads Captured
        const leadsCaptured = chatbotConversations.filter(c => {
            const profile = c.candidateProfile as any;
            return profile?.email || profile?.phone || profile?.name;
        }).length;

        // Average Response Length (user messages)
        const allMessages = await prisma.message.findMany({
            where: {
                conversation: { bot: { projectId } },
                role: 'user',
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            },
            select: { content: true }
        });
        const avgResponseLength = allMessages.length > 0
            ? allMessages.reduce((acc, m) => acc + m.content.length, 0) / allMessages.length
            : 0;

        // --- Generate Insights ---
        const insights: UnifiedInsight[] = [];

        // 2. Identify Hot Topics in Chatbot (Reactive) -> Suggest Interview Questions (Proactive)
        const chatbotThemes = this.extractThemes(chatbotConversations);

        chatbotThemes.forEach(theme => {
            if (theme.frequency > 5 && !this.isCoveredInInterviews(theme.name, interviewConversations)) {
                insights.push({
                    type: 'INTERVIEW_QUESTION',
                    title: `Nuova domanda su "${theme.name}"`,
                    description: `Molti utenti chiedono informazioni su "${theme.name}". Aggiungi una domanda alle interviste per approfondire.`,
                    confidence: 0.85,
                    source: 'CHATBOT',
                    reasoning: `Tema frequente nel chatbot (${theme.frequency} volte) ma assente nelle interviste.`
                });
            }

            if (theme.frequency > 3 && theme.sentiment < 0) {
                insights.push({
                    type: 'KB_UPDATE',
                    title: `Aggiorna FAQ: "${theme.name}"`,
                    description: `Gli utenti sembrano confusi o insoddisfatti riguardo "${theme.name}". Crea una FAQ chiara e rassicurante.`,
                    confidence: 0.9,
                    source: 'CHATBOT',
                    reasoning: `Sentiment negativo rilevato su un tema frequente.`
                });
            }
        });

        // 3. Interview Insights -> Marketing & Social
        const interviewThemes = this.extractThemes(interviewConversations);

        interviewThemes.forEach(theme => {
            if (theme.sentiment > 0.6) {
                insights.push({
                    type: 'AD_CAMPAIGN',
                    title: `Post Social: "${theme.name}"`,
                    description: `I clienti apprezzano molto "${theme.name}". Crea un post social o una campagna che evidenzi questo punto di forza.`,
                    confidence: 0.8,
                    source: 'INTERVIEW',
                    reasoning: `Punto di forza emerso dalle interviste (Sentiment: ${(theme.sentiment * 100).toFixed(0)}%).`
                });
            }
            if (theme.frequency > 3 && theme.sentiment < -0.2) {
                insights.push({
                    type: 'CONTENT_SUGGESTION',
                    title: `Contenuto Sito: Risolvi "${theme.name}"`,
                    description: `È emersa una frizione ricorrente su "${theme.name}". Crea un banner o una sezione "Come funziona" dedicata sul sito.`,
                    confidence: 0.85,
                    source: 'INTERVIEW',
                    reasoning: `Problema ricorrente identificato nelle interviste.`
                });
            }
        });

        return {
            stats: {
                totalConversations,
                totalMessages,
                avgSentiment: avgSentiment * 100, // Scale to 0-100
                avgDuration,
                completionRate,
                trends,
                // Enhanced stats
                interviewCount,
                chatbotCount,
                avgNpsScore,
                topThemes,
                knowledgeGaps,
                leadsCaptured,
                avgResponseLength
            },
            insights
        };
    }

    // --- Helper Methods ---

    private static extractThemes(conversations: (import('@prisma/client').Conversation & { themeOccurrences: (import('@prisma/client').ThemeOccurrence & { theme: import('@prisma/client').Theme })[] })[]): { name: string, frequency: number, sentiment: number }[] {
        const themeMap = new Map<string, { count: number, totalSentiment: number }>();

        conversations.forEach(c => {
            c.themeOccurrences.forEach((t: any) => {
                const current = themeMap.get(t.theme.name) || { count: 0, totalSentiment: 0 };
                themeMap.set(t.theme.name, {
                    count: current.count + 1,
                    totalSentiment: current.totalSentiment + (t.strengthScore || 0)
                });
            });
        });

        return Array.from(themeMap.entries()).map(([name, data]) => ({
            name,
            frequency: data.count,
            sentiment: data.count > 0 ? data.totalSentiment / data.count : 0
        }));
    }

    private static isCoveredInInterviews(topicInfo: string, interviews: (import('@prisma/client').Conversation & { themeOccurrences: (import('@prisma/client').ThemeOccurrence & { theme: import('@prisma/client').Theme })[] })[]): boolean {
        return interviews.some(i =>
            i.themeOccurrences.some(t => t.theme.name.toLowerCase().includes(topicInfo.toLowerCase()))
        );
    }
}
