import { PrismaClient } from '@prisma/client';
import { buildTopicAnchors } from '../src/lib/interview/topic-anchors';

type CliArgs = {
    limit: number;
    status: string;
    botId?: string;
    conversationId?: string;
};

type TopicDescriptor = {
    label: string;
    anchorRoots: string[];
    orderIndex: number;
};

type ConversationCoverageRow = {
    id: string;
    status: string;
    botId: string;
    startedAt: string;
    completedAt: string | null;
    expectedTopics: number;
    coveredTopics: number;
    coveredBeforeDataCollection: number;
    coverageRate: number;
    coverageRateBeforeDataCollection: number;
    missingTopics: string[];
    earlyDataCollection: boolean;
    backwardTransitions: number;
    plannedDurationSec: number;
    effectiveDurationSec: number;
    wallClockSec: number;
    timeUtilization: number;
    endedTooEarly: boolean;
};

function parseArgs(): CliArgs {
    const limit = Number(process.argv[2] || 120);
    const status = (process.argv[3] || 'COMPLETED').toUpperCase();
    const botId = (process.argv[4] || '').trim() || undefined;
    const conversationId = (process.argv[5] || '').trim() || undefined;
    return {
        limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 120,
        status,
        botId,
        conversationId
    };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function normalizeText(input: string): string {
    return String(input || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function inferPhase(metadata: unknown, content: string): 'SCAN' | 'DEEP' | 'DEEP_OFFER' | 'DATA_COLLECTION' {
    const meta = asRecord(metadata);
    const explicit = String(meta?.phase || '').toUpperCase();
    if (explicit === 'DEEP') return 'DEEP';
    if (explicit === 'DEEP_OFFER') return 'DEEP_OFFER';
    if (explicit === 'DATA_COLLECTION') return 'DATA_COLLECTION';
    if (explicit === 'SCAN') return 'SCAN';

    const lower = normalizeText(content);
    if (/\b(continuare|proseguire|few more questions|continue|more time|ancora tempo)\b/i.test(lower)) {
        return 'DEEP_OFFER';
    }
    if (/\b(email|mail|telefono|phone|contatt|nome|cognome|linkedin|portfolio)\b/i.test(lower)) {
        return 'DATA_COLLECTION';
    }
    return 'SCAN';
}

function inferTopicLabel(
    text: string,
    topics: TopicDescriptor[],
    previousTopicLabel?: string
): string | undefined {
    const lower = normalizeText(text);
    if (!lower) return previousTopicLabel;
    let best: { label?: string; score: number } = { label: previousTopicLabel, score: -1 };
    for (const topic of topics) {
        let score = 0;
        for (const root of topic.anchorRoots) {
            if (root && lower.includes(root)) score += 1;
        }
        if (score > best.score) {
            best = { label: topic.label, score };
        }
    }
    if ((best.score ?? -1) > 0 && best.label) return best.label;
    return previousTopicLabel;
}

function toDate(input: Date | null | undefined): Date | null {
    return input instanceof Date ? input : null;
}

function ratio(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return numerator / denominator;
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    try {
        const whereClause: Record<string, unknown> = {};
        if (args.status !== 'ALL') whereClause.status = args.status;
        if (args.botId) whereClause.botId = args.botId;
        if (args.conversationId) whereClause.id = args.conversationId;

        const conversations = await prisma.conversation.findMany({
            where: whereClause as any,
            orderBy: { startedAt: 'desc' },
            take: args.conversationId ? 1 : args.limit,
            include: {
                bot: {
                    select: {
                        id: true,
                        language: true,
                        maxDurationMins: true,
                        topics: {
                            orderBy: { orderIndex: 'asc' },
                            select: {
                                label: true,
                                subGoals: true,
                                orderIndex: true
                            }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        role: true,
                        content: true,
                        metadata: true
                    }
                }
            }
        });

        const rows: ConversationCoverageRow[] = [];

        for (const conv of conversations) {
            const language = conv.bot?.language || 'it';
            const plannedDurationSec = Math.max(1, Number(conv.bot?.maxDurationMins || 10) * 60);
            const effectiveDurationSec = Number(conv.effectiveDuration || 0);
            const startedAt = toDate(conv.startedAt);
            const completedAt = toDate((conv as any).completedAt) || toDate((conv as any).endedAt);
            const wallClockSec = startedAt && completedAt
                ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
                : 0;

            const topics: TopicDescriptor[] = (conv.bot?.topics || []).map((topic, idx) => ({
                label: topic.label,
                anchorRoots: buildTopicAnchors(
                    {
                        id: '',
                        label: topic.label,
                        description: '',
                        subGoals: topic.subGoals || [],
                        orderIndex: idx
                    } as any,
                    language
                ).anchorRoots,
                orderIndex: idx
            }));

            const expectedTopics = topics.length;
            const expectedSet = new Set(topics.map(t => t.label));
            let previousTopicLabel: string | undefined = topics[0]?.label;
            const covered = new Set<string>();
            const coveredBeforeData = new Set<string>();
            const topicIndices: number[] = [];
            let dataCollectionStarted = false;

            const assistantMessages = conv.messages.filter(m => m.role === 'assistant');
            for (const msg of assistantMessages) {
                const text = String(msg.content || '');
                const phase = inferPhase(msg.metadata, text);
                const meta = asRecord(msg.metadata);
                const metaTopicLabel: string | undefined = typeof meta?.topicLabel === 'string'
                    ? meta.topicLabel
                    : undefined;

                if (phase === 'DATA_COLLECTION') {
                    dataCollectionStarted = true;
                    continue;
                }
                if (phase === 'DEEP_OFFER') continue;

                const inferredLabel: string | undefined = metaTopicLabel || inferTopicLabel(text, topics, previousTopicLabel);
                if (!inferredLabel) continue;

                previousTopicLabel = inferredLabel;
                covered.add(inferredLabel);
                if (!dataCollectionStarted) coveredBeforeData.add(inferredLabel);

                const topicIndex = topics.findIndex(t => t.label === inferredLabel);
                if (topicIndex >= 0) topicIndices.push(topicIndex);
            }

            let backwardTransitions = 0;
            for (let i = 1; i < topicIndices.length; i++) {
                if (topicIndices[i] < topicIndices[i - 1]) backwardTransitions += 1;
            }

            const missingTopics = [...expectedSet].filter(label => !covered.has(label));
            const coverageRate = ratio(covered.size, Math.max(1, expectedTopics));
            const coverageRateBeforeDataCollection = ratio(coveredBeforeData.size, Math.max(1, expectedTopics));
            const earlyDataCollection = dataCollectionStarted && coveredBeforeData.size < expectedTopics;
            const timeUtilization = ratio(effectiveDurationSec, plannedDurationSec);
            const endedTooEarly = conv.status === 'COMPLETED' && timeUtilization < 0.7;

            rows.push({
                id: conv.id,
                status: conv.status,
                botId: conv.botId,
                startedAt: conv.startedAt.toISOString(),
                completedAt: completedAt ? completedAt.toISOString() : null,
                expectedTopics,
                coveredTopics: covered.size,
                coveredBeforeDataCollection: coveredBeforeData.size,
                coverageRate,
                coverageRateBeforeDataCollection,
                missingTopics,
                earlyDataCollection,
                backwardTransitions,
                plannedDurationSec,
                effectiveDurationSec,
                wallClockSec,
                timeUtilization,
                endedTooEarly
            });
        }

        const analyzed = rows.length;
        const avgCoverageRate = analyzed > 0
            ? rows.reduce((sum, row) => sum + row.coverageRate, 0) / analyzed
            : 0;
        const avgCoverageBeforeData = analyzed > 0
            ? rows.reduce((sum, row) => sum + row.coverageRateBeforeDataCollection, 0) / analyzed
            : 0;
        const fullCoverageCount = rows.filter(r => r.coverageRate >= 0.999).length;
        const earlyDataCount = rows.filter(r => r.earlyDataCollection).length;
        const backwardCount = rows.filter(r => r.backwardTransitions > 0).length;
        const avgUtilization = analyzed > 0
            ? rows.reduce((sum, row) => sum + row.timeUtilization, 0) / analyzed
            : 0;
        const endedTooEarlyCount = rows.filter(r => r.endedTooEarly).length;

        const worstCoverage = rows
            .slice()
            .sort((a, b) => a.coverageRate - b.coverageRate || b.backwardTransitions - a.backwardTransitions)
            .slice(0, 10);

        console.log('\nInterview Timing + Topic Coverage Report');
        console.log('=======================================');
        console.log(`Scope: ${args.conversationId ? `conversationId=${args.conversationId}` : `status=${args.status}`} ${args.botId ? `botId=${args.botId}` : 'botId=ANY'}`);
        console.log(`Conversations analyzed: ${analyzed}`);
        console.log(`Average topic coverage: ${(avgCoverageRate * 100).toFixed(1)}%`);
        console.log(`Average topic coverage before data collection: ${(avgCoverageBeforeData * 100).toFixed(1)}%`);
        console.log(`Full topic coverage: ${fullCoverageCount}/${analyzed}`);
        console.log(`Early data collection before full coverage: ${earlyDataCount}/${analyzed}`);
        console.log(`Conversations with backward topic jumps: ${backwardCount}/${analyzed}`);
        console.log(`Average time utilization vs plan: ${(avgUtilization * 100).toFixed(1)}%`);
        console.log(`Completed too early (<70% of planned time): ${endedTooEarlyCount}/${analyzed}`);

        if (worstCoverage.length) {
            console.log('\nWorst Coverage Conversations');
            console.log('----------------------------');
            for (const row of worstCoverage) {
                console.log(
                    `${row.id} | coverage=${(row.coverageRate * 100).toFixed(0)}% ` +
                    `beforeData=${(row.coverageRateBeforeDataCollection * 100).toFixed(0)}% ` +
                    `backward=${row.backwardTransitions} earlyData=${row.earlyDataCollection} ` +
                    `timeUtil=${(row.timeUtilization * 100).toFixed(0)}% ` +
                    `missing=[${row.missingTopics.join('; ')}]`
                );
            }
        }

        if (args.conversationId && rows[0]) {
            const row = rows[0];
            console.log('\nConversation Detail');
            console.log('-------------------');
            console.log(JSON.stringify(row, null, 2));
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('TIMING_COVERAGE_REPORT_ERROR', err);
    process.exit(1);
});
