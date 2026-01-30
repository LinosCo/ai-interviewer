import { prisma } from '@/lib/prisma';
import { CMSSuggestionType } from '@prisma/client';
import { getSystemLLM } from '@/lib/visibility/llm-providers';
import { generateObject } from 'ai';
import { z } from 'zod';

export interface SuggestionInput {
    connectionId: string;
    insightId?: string;
    type: CMSSuggestionType;
    signals: {
        chatbotQuestions?: { question: string; count: number }[];
        visibilityGaps?: { topic: string; competitors: string[] }[];
        lowPerformingPages?: { path: string; bounceRate: number; views: number }[];
        searchQueries?: { query: string; impressions: number; position: number; clicks: number }[];
        interviewFeedback?: { topic: string; sentiment: string; quotes: string[] }[];
    };
}

const ContentSchema = z.object({
    title: z.string().describe('Titolo SEO-friendly del contenuto'),
    slug: z.string().describe('URL slug (es. "tempi-consegna-spedizioni")'),
    body: z.string().describe('Contenuto completo in formato Markdown'),
    metaDescription: z.string().describe('Meta description per SEO (max 160 caratteri)'),
    reasoning: z.string().describe('Spiegazione dettagliata del perché questo contenuto è importante'),
    targetSection: z.string().describe('Sezione del sito dove pubblicare (blog, faq, pages)')
});

export class CMSSuggestionGenerator {
    /**
     * Generate a content suggestion based on cross-channel signals.
     */
    static async generateSuggestion(input: SuggestionInput): Promise<string> {
        const { connectionId, insightId, type, signals } = input;

        // Get project context
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: connectionId },
            include: {
                project: {
                    include: {
                        organization: {
                            select: {
                                strategicVision: true,
                                valueProposition: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!connection || !connection.project) {
            throw new Error('CMS connection not found');
        }

        // Use project name or organization name
        const brandName = connection.project.name || connection.project.organization?.name || 'Brand';

        // Generate content using LLM
        const content = await this.generateContent(
            type,
            signals,
            brandName,
            connection.project.organization?.strategicVision,
            connection.project.organization?.valueProposition
        );

        // Calculate priority score based on signals
        const priorityScore = this.calculatePriorityScore(signals);

        // Create suggestion in database
        const suggestion = await prisma.cMSSuggestion.create({
            data: {
                connectionId,
                crossChannelInsightId: insightId,
                type,
                title: content.title,
                slug: content.slug,
                body: content.body,
                metaDescription: content.metaDescription,
                targetSection: content.targetSection,
                reasoning: content.reasoning,
                sourceSignals: signals as any,
                priorityScore,
                status: 'PENDING'
            }
        });

        return suggestion.id;
    }

    /**
     * Generate content using LLM.
     */
    private static async generateContent(
        type: CMSSuggestionType,
        signals: SuggestionInput['signals'],
        brandName: string,
        strategicVision?: string | null,
        valueProposition?: string | null
    ): Promise<z.infer<typeof ContentSchema>> {
        const { model } = await getSystemLLM();

        const typeInstructions: Record<CMSSuggestionType, string> = {
            CREATE_PAGE: 'Crea una nuova pagina informativa completa con sezioni ben strutturate.',
            CREATE_FAQ: 'Crea una pagina FAQ con domande e risposte chiare e concise.',
            CREATE_BLOG_POST: 'Crea un articolo di blog engaging e informativo.',
            MODIFY_CONTENT: 'Suggerisci modifiche specifiche a contenuti esistenti.',
            ADD_SECTION: 'Crea una nuova sezione da aggiungere a una pagina esistente.'
        };

        const signalsSummary = this.formatSignalsForPrompt(signals);

        const { object } = await generateObject({
            model,
            schema: ContentSchema,
            prompt: `Sei un content strategist esperto in SEO e UX writing per PMI italiane.

=== BRAND ===
Nome: ${brandName}
${strategicVision ? `Visione strategica: ${strategicVision}` : ''}
${valueProposition ? `Value proposition: ${valueProposition}` : ''}

=== TIPO DI CONTENUTO ===
${typeInstructions[type]}

=== DATI CHE MOTIVANO QUESTO CONTENUTO ===
${signalsSummary}

=== ISTRUZIONI ===
1. Il titolo deve essere SEO-friendly e catturare l'attenzione
2. Lo slug deve essere breve, descrittivo e SEO-friendly (usa trattini, no spazi)
3. Il body deve essere in formato Markdown con:
   - Titoli H2 e H3 per strutturare il contenuto
   - Paragrafi brevi e leggibili
   - Liste puntate dove appropriato
   - Call-to-action dove rilevante
4. La meta description deve essere persuasiva e contenere keyword rilevanti
5. Il reasoning deve spiegare PERCHÉ questo contenuto è importante citando i dati specifici

=== TONO ===
Professionale ma accessibile, adatto al web. Usa il "tu" o il "voi" aziendale coerentemente.`,
            temperature: 0.3
        });

        return object;
    }

    /**
     * Format signals into a readable summary for the LLM prompt.
     */
    private static formatSignalsForPrompt(signals: SuggestionInput['signals']): string {
        const parts: string[] = [];

        if (signals.chatbotQuestions?.length) {
            parts.push('📱 DOMANDE FREQUENTI SUL CHATBOT:');
            for (const q of signals.chatbotQuestions.slice(0, 5)) {
                parts.push(`  - "${q.question}" (${q.count} volte)`);
            }
        }

        if (signals.visibilityGaps?.length) {
            parts.push('\n🔍 GAP DI VISIBILITÀ (competitor citati, noi no):');
            for (const g of signals.visibilityGaps.slice(0, 5)) {
                parts.push(`  - Topic: ${g.topic} | Competitor presenti: ${g.competitors.join(', ')}`);
            }
        }

        if (signals.lowPerformingPages?.length) {
            parts.push('\n📉 PAGINE CON ALTO BOUNCE RATE:');
            for (const p of signals.lowPerformingPages.slice(0, 5)) {
                parts.push(`  - ${p.path} | Bounce: ${(p.bounceRate * 100).toFixed(1)}% | Views: ${p.views}`);
            }
        }

        if (signals.searchQueries?.length) {
            parts.push('\n🔎 QUERY DI RICERCA RILEVANTI (Search Console):');
            for (const q of signals.searchQueries.slice(0, 5)) {
                parts.push(`  - "${q.query}" | Impressioni: ${q.impressions} | Posizione: ${q.position.toFixed(1)} | Click: ${q.clicks}`);
            }
        }

        if (signals.interviewFeedback?.length) {
            parts.push('\n🎤 FEEDBACK DALLE INTERVISTE:');
            for (const f of signals.interviewFeedback.slice(0, 3)) {
                parts.push(`  - Topic: ${f.topic} | Sentiment: ${f.sentiment}`);
                if (f.quotes.length > 0) {
                    parts.push(`    Quote: "${f.quotes[0]}"`);
                }
            }
        }

        return parts.join('\n');
    }

    /**
     * Calculate priority score (0-100) based on signal strength.
     */
    private static calculatePriorityScore(signals: SuggestionInput['signals']): number {
        let score = 30; // Base score

        // Chatbot questions indicate user demand
        if (signals.chatbotQuestions?.length) {
            const totalQuestions = signals.chatbotQuestions.reduce((sum, q) => sum + q.count, 0);
            score += Math.min(totalQuestions / 5, 20); // Up to +20 for high volume
        }

        // Visibility gaps are strategic opportunities
        if (signals.visibilityGaps?.length) {
            score += signals.visibilityGaps.length * 5; // +5 per gap, up to +25
        }

        // Low performing pages need fixing
        if (signals.lowPerformingPages?.length) {
            const avgBounce = signals.lowPerformingPages.reduce((sum, p) => sum + p.bounceRate, 0) / signals.lowPerformingPages.length;
            if (avgBounce > 0.7) score += 15;
            else if (avgBounce > 0.5) score += 10;
        }

        // Search queries with poor position have SEO potential
        if (signals.searchQueries?.length) {
            const improvableQueries = signals.searchQueries.filter(q => q.position > 10 && q.impressions > 50);
            score += improvableQueries.length * 3; // +3 per query with SEO potential
        }

        // Interview feedback adds qualitative backing
        if (signals.interviewFeedback?.length) {
            const negativeFeedback = signals.interviewFeedback.filter(f => f.sentiment === 'negative');
            score += negativeFeedback.length * 5;
        }

        return Math.min(Math.max(score, 0), 100); // Clamp to 0-100
    }

    /**
     * Generate suggestions from a CrossChannelInsight that has create_content or modify_content actions.
     * Finds projects with CMS connections in the organization.
     */
    static async generateFromInsight(insightId: string): Promise<string[]> {
        const insight = await prisma.crossChannelInsight.findUnique({
            where: { id: insightId },
            include: {
                organization: {
                    include: {
                        projects: {
                            include: {
                                cmsConnection: true
                            },
                            where: {
                                cmsConnection: {
                                    isNot: null
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!insight || insight.organization.projects.length === 0) {
            return [];
        }

        // Get all projects with CMS connections
        const projectsWithCMS = insight.organization.projects.filter(
            (p: any) => p.cmsConnection !== null
        );

        if (projectsWithCMS.length === 0) {
            return [];
        }

        const actions = insight.suggestedActions as any[];
        const suggestionIds: string[] = [];

        // Generate suggestions for each project with CMS
        for (const project of projectsWithCMS) {
            const connection = (project as any).cmsConnection;

            for (const action of actions) {
                if (action.type === 'create_content' || action.type === 'modify_content') {
                    const type = this.mapActionTypeToSuggestionType(action);
                    const signals = this.extractSignalsFromInsight(insight, action);

                    const suggestionId = await this.generateSuggestion({
                        connectionId: connection.id,
                        insightId,
                        type,
                        signals
                    });

                    suggestionIds.push(suggestionId);
                }
            }
        }

        return suggestionIds;
    }

    /**
     * Map CrossChannel action type to CMSSuggestionType.
     */
    private static mapActionTypeToSuggestionType(action: any): CMSSuggestionType {
        const target = action.target?.toLowerCase();
        const title = action.title?.toLowerCase() || '';

        if (title.includes('faq') || title.includes('domanda')) {
            return 'CREATE_FAQ';
        }
        if (title.includes('blog') || title.includes('articolo')) {
            return 'CREATE_BLOG_POST';
        }
        if (action.type === 'modify_content') {
            return 'MODIFY_CONTENT';
        }
        if (title.includes('sezione')) {
            return 'ADD_SECTION';
        }

        return 'CREATE_PAGE';
    }

    /**
     * Extract signals from CrossChannelInsight data.
     */
    private static extractSignalsFromInsight(insight: any, action: any): SuggestionInput['signals'] {
        const signals: SuggestionInput['signals'] = {};

        // Extract chatbot data
        if (insight.chatbotData) {
            const chatbotData = insight.chatbotData as any;
            if (chatbotData.gaps) {
                signals.chatbotQuestions = chatbotData.gaps.map((g: any) => ({
                    question: g.topic || g.question,
                    count: g.count || 1
                }));
            }
        }

        // Extract visibility data
        if (insight.visibilityData) {
            const visibilityData = insight.visibilityData as any;
            if (visibilityData.competitors) {
                signals.visibilityGaps = [{
                    topic: insight.topicName,
                    competitors: visibilityData.competitors.map((c: any) => c.name || c)
                }];
            }
        }

        // Extract interview data
        if (insight.interviewData) {
            const interviewData = insight.interviewData as any[];
            if (Array.isArray(interviewData)) {
                signals.interviewFeedback = interviewData.slice(0, 5).map((i: any) => ({
                    topic: i.themes?.[0] || insight.topicName,
                    sentiment: i.sentiment?.overall || 'neutral',
                    quotes: i.quotes || []
                }));
            }
        }

        return signals;
    }
}
