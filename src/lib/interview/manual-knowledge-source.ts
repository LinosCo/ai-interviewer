export const INTERVIEW_GUIDE_SOURCE_TYPE = 'INTERVIEW_GUIDE';

type TopicInput = {
    label: string;
    description?: string | null;
    subGoals?: string[] | null;
};

function cleanText(input: string | null | undefined, maxLen: number = 220): string {
    return String(input || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

function firstN<T>(items: T[] | null | undefined, max: number): T[] {
    return Array.isArray(items) ? items.slice(0, max) : [];
}

export function getInterviewGuideTitle(language: string): string {
    return String(language || '').toLowerCase().startsWith('it')
        ? 'Interview Knowledge (Auto)'
        : 'Interview Knowledge (Auto)';
}

export function buildAutoInterviewKnowledgeContent(params: {
    language: string;
    botName?: string | null;
    researchGoal?: string | null;
    targetAudience?: string | null;
    topics: TopicInput[];
}): string {
    const isItalian = String(params.language || '').toLowerCase().startsWith('it');
    const goal = cleanText(params.researchGoal, 400) || (isItalian ? 'Non specificato' : 'Not specified');
    const audience = cleanText(params.targetAudience, 300) || (isItalian ? 'Non specificato' : 'Not specified');
    const botName = cleanText(params.botName, 120) || (isItalian ? 'Intervista' : 'Interview');
    const topics = firstN(params.topics, 12);

    const intro = isItalian
        ? [
            `# Interview Knowledge (Auto-generated)`,
            ``,
            `Questa guida è stata generata automaticamente per "${botName}" e può essere modificata manualmente.`,
            ``,
            `## Obiettivo di ricerca`,
            `${goal}`,
            ``,
            `## Target intervistati`,
            `${audience}`,
            ``,
            `## Criteri trasversali di interpretazione`,
            `- Distinguere sempre stato attuale, obiettivo desiderato e vincolo reale.`,
            `- Cercare impatti su decisioni, tempi, qualità delle risposte e rapporto col mercato.`,
            `- Se emerge un punto significativo, chiedere esempi concreti, frequenza e conseguenze operative.`,
            `- Evitare domande duplicate o generiche: un solo focus per turno.`,
            ``
        ]
        : [
            `# Interview Knowledge (Auto-generated)`,
            ``,
            `This guide was auto-generated for "${botName}" and can be edited manually.`,
            ``,
            `## Research Goal`,
            `${goal}`,
            ``,
            `## Target Audience`,
            `${audience}`,
            ``,
            `## Cross-topic interpretation criteria`,
            `- Separate current state, desired outcome, and real constraints.`,
            `- Look for impact on decisions, timing, response quality, and market relationship.`,
            `- When a meaningful point appears, ask for concrete examples, frequency, and operational impact.`,
            `- Avoid duplicate or generic questions: keep one focus per turn.`,
            ``
        ];

    const topicBlocks = topics.map((topic, index) => {
        const label = cleanText(topic.label, 120) || (isItalian ? `Topic ${index + 1}` : `Topic ${index + 1}`);
        const description = cleanText(topic.description, 280);
        const subGoals = firstN(topic.subGoals, 6).map((goalItem) => cleanText(goalItem, 140)).filter(Boolean);
        const primarySubGoal = subGoals[0] || label;
        const secondarySubGoal = subGoals[1] || primarySubGoal;

        if (isItalian) {
            return [
                `## Topic ${index + 1} - ${label}`,
                description ? `Contesto: ${description}` : null,
                `Cosa capire:`,
                `- Come viene gestito oggi "${primarySubGoal}" e con quali limiti.`,
                `- Quale risultato concreto si aspettano da un miglioramento su "${secondarySubGoal}".`,
                `Segnali da approfondire:`,
                `- Riferimenti a tempi di risposta, qualità decisionale, opportunità perse, frizioni col mercato/clienti.`,
                `- Indicatori concreti (esempi reali, casi recenti, numeri o frequenze).`,
                `Follow-up suggeriti:`,
                `- "Puoi raccontarmi un caso recente in cui questo tema ha influenzato una decisione?"`,
                `- "Quale cambiamento operativo vorresti vedere nei primi 90 giorni?"`,
                subGoals.length > 0 ? `Sub-goal dichiarati: ${subGoals.join(' | ')}` : null,
                ``
            ].filter(Boolean).join('\n');
        }

        return [
            `## Topic ${index + 1} - ${label}`,
            description ? `Context: ${description}` : null,
            `What to understand:`,
            `- How "${primarySubGoal}" is currently handled and where it breaks down.`,
            `- Which concrete outcome they expect from improving "${secondarySubGoal}".`,
            `Signals worth probing:`,
            `- Mentions of response time, decision quality, missed opportunities, or market/client friction.`,
            `- Concrete indicators (real examples, recent events, numbers, frequency).`,
            `Suggested follow-ups:`,
            `- "Can you walk me through a recent case where this influenced a decision?"`,
            `- "What operational change would you want in the first 90 days?"`,
            subGoals.length > 0 ? `Declared sub-goals: ${subGoals.join(' | ')}` : null,
            ``
        ].filter(Boolean).join('\n');
    });

    const closing = isItalian
        ? [
            `## Nota operativa`,
            `Questa guida è un supporto interpretativo: usala per approfondire i segnali più rilevanti mantenendo naturalezza conversazionale.`,
            ``
        ]
        : [
            `## Operational note`,
            `This guide is an interpretation aid: use it to deepen high-value signals while keeping the conversation natural.`,
            ``
        ];

    return [...intro, ...topicBlocks, ...closing].join('\n').trim();
}

export async function ensureAutoInterviewKnowledgeSource(params: {
    botId: string;
    language: string;
    botName?: string | null;
    researchGoal?: string | null;
    targetAudience?: string | null;
    topics: TopicInput[];
}): Promise<void> {
    if (!params.botId) return;
    if (!Array.isArray(params.topics) || params.topics.length === 0) return;
    const { prisma } = await import('@/lib/prisma');

    const existing = await prisma.knowledgeSource.findFirst({
        where: {
            botId: params.botId,
            type: INTERVIEW_GUIDE_SOURCE_TYPE
        },
        select: { id: true }
    });
    if (existing) return;

    const content = buildAutoInterviewKnowledgeContent({
        language: params.language,
        botName: params.botName,
        researchGoal: params.researchGoal,
        targetAudience: params.targetAudience,
        topics: params.topics
    });

    const stillMissing = await prisma.knowledgeSource.findFirst({
        where: {
            botId: params.botId,
            type: INTERVIEW_GUIDE_SOURCE_TYPE
        },
        select: { id: true }
    });
    if (stillMissing) return;

    await prisma.knowledgeSource.create({
        data: {
            botId: params.botId,
            type: INTERVIEW_GUIDE_SOURCE_TYPE,
            title: getInterviewGuideTitle(params.language),
            content
        }
    });
}

export async function regenerateAutoInterviewKnowledgeSource(params: {
    botId: string;
    language: string;
    botName?: string | null;
    researchGoal?: string | null;
    targetAudience?: string | null;
    topics: TopicInput[];
}): Promise<void> {
    if (!params.botId) return;
    if (!Array.isArray(params.topics) || params.topics.length === 0) return;

    const { prisma } = await import('@/lib/prisma');
    const content = buildAutoInterviewKnowledgeContent({
        language: params.language,
        botName: params.botName,
        researchGoal: params.researchGoal,
        targetAudience: params.targetAudience,
        topics: params.topics
    });
    const title = getInterviewGuideTitle(params.language);

    const existing = await prisma.knowledgeSource.findFirst({
        where: {
            botId: params.botId,
            type: INTERVIEW_GUIDE_SOURCE_TYPE
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
    });

    if (existing) {
        await prisma.knowledgeSource.update({
            where: { id: existing.id },
            data: {
                title,
                content
            }
        });
        return;
    }

    await prisma.knowledgeSource.create({
        data: {
            botId: params.botId,
            type: INTERVIEW_GUIDE_SOURCE_TYPE,
            title,
            content
        }
    });
}
