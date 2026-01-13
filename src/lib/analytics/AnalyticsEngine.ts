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

export interface MetricTrend {
    date: string;
    chatbotSentiment: number;
    interviewSentiment: number;
    combinedSentiment: number;
    volume: number;
}

export class AnalyticsEngine {

    /**
     * Aggregates data for a given Project to generate unified insights.
     */
    static async generateProjectInsights(projectId: string): Promise<UnifiedInsight[]> {
        // 1. Fetch all bots in the project
        const bots = await prisma.bot.findMany({
            where: { projectId },
            include: {
                conversations: {
                    orderBy: { startedAt: 'desc' },
                    take: 100, // Analyze last 100 conversations per bot for relevance
                    include: {
                        themeOccurrences: { include: { theme: true } },
                        analysis: true
                    }
                }
            }
        });

        const insights: UnifiedInsight[] = [];
        const chatbotConversations = bots.filter((b: any) => b.botType === 'chatbot').flatMap(b => b.conversations);
        const interviewConversations = bots.filter((b: any) => b.botType === 'interview').flatMap(b => b.conversations);

        // 2. Identify Hot Topics in Chatbot (Reactive) -> Suggest Interview Questions (Proactive)
        const chatbotThemes = this.extractThemes(chatbotConversations);

        chatbotThemes.forEach(theme => {
            // Logic: If users ask frequently about X, but we don't have deep qualitative data on X from interviews
            if (theme.frequency > 5 && !this.isCoveredInInterviews(theme.name, interviewConversations)) {
                insights.push({
                    type: 'INTERVIEW_QUESTION',
                    title: `Indaga su "${theme.name}"`,
                    description: `Gli utenti del sito chiedono spesso di "${theme.name}". Aggiungi una domanda specifica nelle tue interviste per capire meglio le loro esigenze.`,
                    confidence: 0.85,
                    source: 'CHATBOT',
                    reasoning: `Alta frequenza nel chatbot (${theme.frequency} occorrenze) ma bassa copertura nelle interviste.`
                });
            }

            // Logic: High volume + Low Sentiment -> Content Gap
            if (theme.frequency > 3 && theme.sentiment < 0) {
                insights.push({
                    type: 'CONTENT_SUGGESTION',
                    title: `Scrivi un articolo su "${theme.name}"`,
                    description: `C'è confusione o frustrazione riguardo "${theme.name}". Pubblica una guida chiara o un post sul blog per chiarire.`,
                    confidence: 0.9,
                    source: 'CHATBOT',
                    reasoning: `Sentiment negativo rilevato su un tema frequente.`
                });
            }
        });

        // 3. Identify Pain Points in Interviews (Deep) -> Suggest KB Updates (Immediate Fix)
        const interviewThemes = this.extractThemes(interviewConversations);

        interviewThemes.forEach(theme => {
            if (theme.sentiment < -0.3) {
                insights.push({
                    type: 'KB_UPDATE',
                    title: `Aggiorna Knowledge Base su "${theme.name}"`,
                    description: `Dalle interviste emerge che "${theme.name}" è un punto critico. Assicurati che il chatbot abbia risposte rassicuranti e complete su questo.`,
                    confidence: 0.95,
                    source: 'INTERVIEW',
                    reasoning: `Sentiment molto negativo (${theme.sentiment.toFixed(2)}) rilevato nelle interviste di profondità.`
                });
            }

            if (theme.sentiment > 0.7 && theme.frequency > 5) {
                insights.push({
                    type: 'AD_CAMPAIGN',
                    title: `Lancia una campagna su "${theme.name}"`,
                    description: `I clienti adorano "${theme.name}". Usa questo levearage nelle tue campagne pubblicitarie.`,
                    confidence: 0.8,
                    source: 'INTERVIEW',
                    reasoning: `Sentiment eccellente e alta menzione spontanea nelle interviste.`
                });
            }
        });

        return insights;
    }

    // --- Helper Methods ---

    private static extractThemes(conversations: any[]): { name: string, frequency: number, sentiment: number }[] {
        const themeMap = new Map<string, { count: number, totalSentiment: number }>();

        conversations.forEach(c => {
            c.themeOccurrences.forEach((t: any) => {
                const current = themeMap.get(t.theme.name) || { count: 0, totalSentiment: 0 };
                themeMap.set(t.theme.name, {
                    count: current.count + 1,
                    totalSentiment: current.totalSentiment + (t.strengthScore || 0) // Assuming strengthScore correlates to sentiment or using conversation sentiment relies on improved schema
                });
            });

            // Fallback if no extracted themes yet: use metadata or manual keywords (simplified for POC)
        });

        return Array.from(themeMap.entries()).map(([name, data]) => ({
            name,
            frequency: data.count,
            sentiment: data.count > 0 ? data.totalSentiment / data.count : 0
        }));
    }

    private static isCoveredInInterviews(topicInfo: string, interviews: any[]): boolean {
        // Simple check: does the topic appear in interview themes?
        return interviews.some(i =>
            i.themeOccurrences.some((t: any) => t.theme.name.toLowerCase().includes(topicInfo.toLowerCase()))
        );
    }
}
