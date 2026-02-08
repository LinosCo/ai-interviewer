import { PrismaClient } from '@prisma/client';
import { evaluateTranscriptSemanticFlow, type TranscriptSemanticTurn } from '../src/lib/interview/transcript-semantic-evaluator';
import { buildTopicAnchors } from '../src/lib/interview/topic-anchors';

type CliArgs = {
    limit: number;
    status: string;
    topValid: number;
    topCandidates: number;
    botId?: string;
    minScore: number;
    maxFailedTurns: number;
    maxFailedRate: number;
    minEvaluatedTurns: number;
    maxTransitionFailures: number;
    maxConsentFailures: number;
};

function parseArgs(): CliArgs {
    const limit = Number(process.argv[2] || 120);
    const status = (process.argv[3] || 'COMPLETED').toUpperCase();
    const topValid = Number(process.argv[4] || 3);
    const botId = (process.argv[5] || '').trim() || undefined;
    const minScore = Number(process.argv[6] || 88);
    const maxFailedTurns = Number(process.argv[7] || 1);
    const maxFailedRate = Number(process.argv[8] || 0.25);
    const minEvaluatedTurns = Number(process.argv[9] || 6);
    const maxTransitionFailures = Number(process.argv[10] || 0);
    const maxConsentFailures = Number(process.argv[11] || 0);
    const topCandidates = Number(process.argv[12] || 5);
    return {
        limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 120,
        status,
        topValid: Number.isFinite(topValid) && topValid > 0 ? Math.floor(topValid) : 3,
        topCandidates: Number.isFinite(topCandidates) && topCandidates > 0 ? Math.floor(topCandidates) : 5,
        botId,
        minScore: Number.isFinite(minScore) ? minScore : 88,
        maxFailedTurns: Number.isFinite(maxFailedTurns) ? Math.floor(maxFailedTurns) : 1,
        maxFailedRate: Number.isFinite(maxFailedRate) ? Math.max(0, Math.min(1, maxFailedRate)) : 0.25,
        minEvaluatedTurns: Number.isFinite(minEvaluatedTurns) ? Math.floor(minEvaluatedTurns) : 6,
        maxTransitionFailures: Number.isFinite(maxTransitionFailures) ? Math.floor(maxTransitionFailures) : 0,
        maxConsentFailures: Number.isFinite(maxConsentFailures) ? Math.floor(maxConsentFailures) : 0
    };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function inferPhaseFromText(text: string): 'SCAN' | 'DEEP_OFFER' | 'DATA_COLLECTION' {
    const lower = String(text || '').toLowerCase();
    if (/\b(continuare|proseguire|hai ancora tempo|few more questions|a bit more time|continue)\b/i.test(lower)) {
        return 'DEEP_OFFER';
    }
    if (/\b(email|mail|telefono|phone|contatt|nome|cognome|linkedin)\b/i.test(lower)) {
        return 'DATA_COLLECTION';
    }
    return 'SCAN';
}

function scoreTopicLabel(text: string, topic: { label: string; subGoals?: string[] }, language: string): number {
    const anchors = buildTopicAnchors(
        {
            id: '',
            orderIndex: 0,
            label: topic.label,
            description: '',
            subGoals: topic.subGoals || []
        } as any,
        language
    );
    const lower = String(text || '').toLowerCase();
    if (!lower) return 0;
    let score = 0;
    for (const root of anchors.anchorRoots) {
        if (root && lower.includes(root)) score += 1;
    }
    return score;
}

function inferTopicLabel(
    text: string,
    topics: Array<{ label: string; subGoals?: string[] }>,
    language: string,
    previousTopicLabel?: string
): string | undefined {
    if (!topics.length) return previousTopicLabel;
    let best = { label: '', score: -1 };
    for (const topic of topics) {
        const score = scoreTopicLabel(text, topic, language);
        if (score > best.score) best = { label: topic.label, score };
    }
    if (best.score > 0) return best.label;
    return previousTopicLabel || topics[0].label;
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();

    try {
        const whereClause: Record<string, unknown> = {};
        if (args.status !== 'ALL') whereClause.status = args.status;
        if (args.botId) whereClause.botId = args.botId;

        const conversations = await prisma.conversation.findMany({
            where: whereClause as any,
            orderBy: { startedAt: 'desc' },
            take: args.limit,
            include: {
                bot: {
                    select: {
                        id: true,
                        name: true,
                        language: true,
                        topics: {
                            orderBy: { orderIndex: 'asc' },
                            select: { label: true, subGoals: true }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        role: true,
                        content: true,
                        metadata: true,
                        createdAt: true
                    }
                }
            }
        });

        const evaluated = conversations.map(conv => {
            const language = conv.bot?.language || 'it';
            const topics = conv.bot?.topics || [];
            let currentTopicLabel: string | undefined = topics[0]?.label;

            const turns: TranscriptSemanticTurn[] = conv.messages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => {
                    if (m.role === 'user') {
                        return {
                            role: 'user',
                            content: String(m.content || '')
                        };
                    }

                    const meta = asRecord(m.metadata);
                    const metaPhase = typeof meta?.phase === 'string' ? meta.phase.toUpperCase() : '';
                    const metaTopicLabel = typeof meta?.topicLabel === 'string' ? meta.topicLabel : undefined;

                    const phase = (metaPhase === 'DEEP' || metaPhase === 'DEEP_OFFER' || metaPhase === 'DATA_COLLECTION')
                        ? metaPhase
                        : inferPhaseFromText(String(m.content || ''));

                    const topicLabel = metaTopicLabel || inferTopicLabel(
                        String(m.content || ''),
                        topics as Array<{ label: string; subGoals?: string[] }>,
                        language,
                        currentTopicLabel
                    );
                    currentTopicLabel = topicLabel || currentTopicLabel;

                    return {
                        role: 'assistant',
                        content: String(m.content || ''),
                        phase: phase as any,
                        topicLabel
                    };
                });

            const semantic = evaluateTranscriptSemanticFlow({
                turns,
                language
            });
            const failedRate = semantic.evaluatedTurns > 0
                ? semantic.failedTurns / semantic.evaluatedTurns
                : 1;

            const isValid =
                semantic.evaluatedTurns >= args.minEvaluatedTurns &&
                semantic.score >= args.minScore &&
                failedRate <= args.maxFailedRate &&
                semantic.transitionFailures <= args.maxTransitionFailures &&
                semantic.consentFailures <= args.maxConsentFailures &&
                semantic.failedTurns <= args.maxFailedTurns;

            return {
                id: conv.id,
                status: conv.status,
                botId: conv.botId,
                botName: conv.bot?.name || 'Untitled',
                startedAt: conv.startedAt.toISOString(),
                semantic,
                failedRate,
                isValid,
                turns
            };
        });

        const valid = evaluated
            .filter(r => r.isValid)
            .sort((a, b) => {
                if (b.semantic.score !== a.semantic.score) return b.semantic.score - a.semantic.score;
                return b.semantic.evaluatedTurns - a.semantic.evaluatedTurns;
            })
            .slice(0, args.topValid);
        const candidates = evaluated
            .slice()
            .sort((a, b) => {
                if (b.semantic.score !== a.semantic.score) return b.semantic.score - a.semantic.score;
                if (a.semantic.failedTurns !== b.semantic.failedTurns) return a.semantic.failedTurns - b.semantic.failedTurns;
                return b.semantic.evaluatedTurns - a.semantic.evaluatedTurns;
            })
            .slice(0, args.topCandidates);

        console.log('\nSemantic Transcript Audit');
        console.log('========================');
        console.log(`Conversations scanned: ${evaluated.length}`);
        console.log(
            `Thresholds: minScore=${args.minScore}, maxFailedTurns=${args.maxFailedTurns}, ` +
            `maxFailedRate=${args.maxFailedRate}, minEvaluatedTurns=${args.minEvaluatedTurns}, ` +
            `maxTransitionFailures=${args.maxTransitionFailures}, ` +
            `maxConsentFailures=${args.maxConsentFailures}`
        );
        console.log(`Valid by semantic criteria: ${evaluated.filter(e => e.isValid).length}`);
        console.log(`Returned transcripts: ${valid.length}`);

        if (!valid.length) {
            console.log('\nNo interviews matched current "valid" thresholds.');
            if (candidates.length) {
                console.log('\nTop candidates (best semantic score even if not fully valid):');
                for (const item of candidates) {
                    console.log(
                        `- ${item.id} score=${item.semantic.score} evaluatedTurns=${item.semantic.evaluatedTurns} ` +
                        `failedTurns=${item.semantic.failedTurns} failedRate=${item.failedRate.toFixed(2)} ` +
                        `transitionFailures=${item.semantic.transitionFailures} ` +
                        `consentFailures=${item.semantic.consentFailures}`
                    );
                }
            }
            return;
        }

        valid.forEach((item, idx) => {
            console.log(`\n--- VALID #${idx + 1} ---`);
            console.log(`conversationId=${item.id}`);
            console.log(`bot=${item.botName} (${item.botId})`);
            console.log(`status=${item.status} startedAt=${item.startedAt}`);
            console.log(
                `semanticScore=${item.semantic.score} evaluatedTurns=${item.semantic.evaluatedTurns} ` +
                `failedTurns=${item.semantic.failedTurns} failedRate=${item.failedRate.toFixed(2)} ` +
                `transitionFailures=${item.semantic.transitionFailures} consentFailures=${item.semantic.consentFailures}`
            );
            if (item.semantic.issues.length > 0) {
                console.log(`topIssues=${item.semantic.issues.join(' | ')}`);
            }
            console.log('transcript:');
            for (const turn of item.turns.slice(0, 22)) {
                const role = turn.role === 'user' ? 'U' : 'A';
                const text = String(turn.content || '').replace(/\s+/g, ' ').trim();
                const clipped = text.length > 240 ? `${text.slice(0, 237)}...` : text;
                const phaseTag = turn.role === 'assistant' ? ` [${turn.phase || 'SCAN'} | ${turn.topicLabel || '-'}]` : '';
                console.log(`${role}${phaseTag}: ${clipped}`);
            }
        });
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('SEMANTIC_TRANSCRIPT_AUDIT_ERROR', err);
    process.exit(1);
});
