import { PrismaClient } from '@prisma/client';
import { evaluateInterviewQuestionQuality, type QualitativePhase } from '../src/lib/interview/qualitative-evaluator';
import * as fs from 'node:fs';
import * as path from 'node:path';

type CliConfig = {
    limit: number;
    status: string;
    includeAllStatuses: boolean;
    botId?: string;
    csvOutputPath?: string;
};

type TurnRow = {
    conversationId: string;
    messageId: string;
    phase: QualitativePhase;
    score: number;
    passed: boolean;
    qualityGateEligible: boolean;
    qualityGateTrigger: boolean;
    issues: string[];
    assistantResponse: string;
    userResponse: string;
};

type ConversationSummary = {
    id: string;
    status: string;
    startedAt: Date;
    assistantTurns: number;
    evaluatedTurns: number;
    passedTurns: number;
    avgScore: number;
    topIssues: string[];
};

function parseArgs(): CliConfig {
    const limitArg = Number(process.argv[2] || 120);
    const statusArg = (process.argv[3] || 'COMPLETED').toUpperCase();
    const botIdArg = (process.argv[4] || '').trim();
    const csvArg = (process.argv[5] || '').trim();

    return {
        limit: Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : 120,
        status: statusArg,
        includeAllStatuses: statusArg === 'ALL',
        botId: botIdArg ? botIdArg : undefined,
        csvOutputPath: csvArg ? csvArg : undefined
    };
}

function normalizePhase(phase: unknown): QualitativePhase {
    if (phase === 'DEEP') return 'DEEP';
    if (phase === 'DEEP_OFFER') return 'DEEP_OFFER';
    if (phase === 'DATA_COLLECTION') return 'DATA_COLLECTION';
    return 'SCAN';
}

function inferPhaseFromMetadata(metadata: unknown, assistantResponse: string): QualitativePhase {
    const data = metadata as Record<string, unknown> | null;
    const response = (assistantResponse || '').toLowerCase();

    if (data && typeof data === 'object') {
        const explicitPhase = normalizePhase(data.phase);
        if (explicitPhase !== 'SCAN' || data.phase === 'SCAN') return explicitPhase;

        const status = String(data.supervisorStatus || '').toUpperCase();
        if (status.includes('DATA_COLLECTION') || status.includes('FINAL_GOODBYE')) return 'DATA_COLLECTION';
        if (status.includes('DEEP_OFFER')) return 'DEEP_OFFER';
        if (status.includes('DEEP')) return 'DEEP';
    }

    // Fallback inference for legacy rows without phase metadata.
    if (/\b(ancora tempo|proseguire|continuare|few more questions|a bit more time|continue)\b/i.test(response)) {
        return 'DEEP_OFFER';
    }
    if (/\b(email|mail|telefono|phone|contatt|nome e cognome|full name|linkedin)\b/i.test(response)) {
        return 'DATA_COLLECTION';
    }
    return 'SCAN';
}

function safeString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function topKIssues(rows: TurnRow[], k: number = 3): string[] {
    const counts = new Map<string, number>();
    for (const row of rows) {
        for (const issue of row.issues) {
            counts.set(issue, (counts.get(issue) || 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map(([issue, count]) => `${issue} (${count})`);
}

function buildConversationSummary(conversationId: string, status: string, startedAt: Date, rows: TurnRow[], totalAssistantTurns: number): ConversationSummary {
    const evaluatedTurns = rows.length;
    const passedTurns = rows.filter(r => r.passed).length;
    const avgScore = evaluatedTurns > 0
        ? Math.round(rows.reduce((acc, row) => acc + row.score, 0) / evaluatedTurns)
        : 0;

    return {
        id: conversationId,
        status,
        startedAt,
        assistantTurns: totalAssistantTurns,
        evaluatedTurns,
        passedTurns,
        avgScore,
        topIssues: topKIssues(rows, 3)
    };
}

function csvCell(value: unknown): string {
    const str = String(value ?? '');
    return `"${str.replace(/"/g, '""')}"`;
}

function toCsv(rows: TurnRow[], convoMeta: Map<string, { botId: string; status: string; startedAt: string }>): string {
    const headers = [
        'conversationId',
        'botId',
        'status',
        'startedAt',
        'messageId',
        'phase',
        'score',
        'passed',
        'qualityGateEligible',
        'qualityGateTrigger',
        'issues',
        'userResponse',
        'assistantResponse'
    ];

    const lines = [headers.join(',')];
    for (const row of rows) {
        const meta = convoMeta.get(row.conversationId);
        const values = [
            row.conversationId,
            meta?.botId || '',
            meta?.status || '',
            meta?.startedAt || '',
            row.messageId,
            row.phase,
            row.score,
            row.passed,
            row.qualityGateEligible,
            row.qualityGateTrigger,
            row.issues.join(' | '),
            row.userResponse,
            row.assistantResponse
        ];
        lines.push(values.map(csvCell).join(','));
    }
    return lines.join('\n');
}

async function main(): Promise<void> {
    const config = parseArgs();
    const prisma = new PrismaClient();

    try {
        const whereClause: Record<string, unknown> = {};
        if (!config.includeAllStatuses) whereClause.status = config.status;
        if (config.botId) whereClause.botId = config.botId;

        const conversations = await prisma.conversation.findMany({
            where: whereClause,
            orderBy: { startedAt: 'desc' },
            take: config.limit,
            include: {
                bot: {
                    select: {
                        language: true
                    }
                },
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        const allRows: TurnRow[] = [];
        const conversationSummaries: ConversationSummary[] = [];
        const convoMeta = new Map<string, { botId: string; status: string; startedAt: string }>();

        for (const conv of conversations) {
            const rowsForConversation: TurnRow[] = [];
            const assistantTurns = conv.messages.filter(m => m.role === 'assistant').length;
            convoMeta.set(conv.id, {
                botId: conv.botId,
                status: conv.status,
                startedAt: conv.startedAt.toISOString()
            });

            for (let i = 0; i < conv.messages.length; i++) {
                const msg = conv.messages[i];
                if (msg.role !== 'assistant') continue;

                const assistantResponse = safeString(msg.content);
                if (!assistantResponse || !assistantResponse.includes('?')) continue;

                // Evaluate against the latest user response before this assistant turn.
                let userResponse = '';
                for (let j = i - 1; j >= 0; j--) {
                    if (conv.messages[j].role === 'user') {
                        userResponse = safeString(conv.messages[j].content);
                        break;
                    }
                }
                if (!userResponse) continue;

                let previousAssistantResponse = '';
                for (let j = i - 1; j >= 0; j--) {
                    if (conv.messages[j].role === 'assistant') {
                        previousAssistantResponse = safeString(conv.messages[j].content);
                        break;
                    }
                }

                const phase = inferPhaseFromMetadata(msg.metadata, assistantResponse);
                const result = evaluateInterviewQuestionQuality({
                    phase,
                    topicLabel: '',
                    userResponse,
                    assistantResponse,
                    previousAssistantResponse,
                    language: conv.bot?.language || 'it'
                });
                const qualityGateEligible = phase === 'SCAN' || phase === 'DEEP' || phase === 'DEEP_OFFER';
                const isTopicPhaseForGate = phase === 'SCAN' || phase === 'DEEP';
                const qualityGateTrigger =
                    qualityGateEligible && (
                    !result.checks.oneQuestion ||
                    !result.checks.avoidsClosure ||
                    !result.checks.avoidsPrematureContact ||
                    (isTopicPhaseForGate && !result.checks.referencesUserContext) ||
                    (isTopicPhaseForGate && !result.checks.topicalAnchor) ||
                    (isTopicPhaseForGate && !result.checks.nonRepetitive) ||
                    (isTopicPhaseForGate && !result.checks.probingWhenUserIsBrief) ||
                    (phase === 'DEEP_OFFER' && !result.checks.deepOfferIntent)
                    );

                const row: TurnRow = {
                    conversationId: conv.id,
                    messageId: msg.id,
                    phase,
                    score: result.score,
                    passed: result.passed,
                    qualityGateEligible,
                    qualityGateTrigger,
                    issues: result.issues,
                    assistantResponse,
                    userResponse
                };

                rowsForConversation.push(row);
                allRows.push(row);
            }

            conversationSummaries.push(
                buildConversationSummary(
                    conv.id,
                    conv.status,
                    conv.startedAt,
                    rowsForConversation,
                    assistantTurns
                )
            );
        }

        const byPhase = new Map<QualitativePhase, TurnRow[]>();
        for (const phase of ['SCAN', 'DEEP', 'DEEP_OFFER', 'DATA_COLLECTION'] as QualitativePhase[]) {
            byPhase.set(phase, []);
        }
        for (const row of allRows) {
            byPhase.get(row.phase)?.push(row);
        }

        const globalPass = allRows.filter(r => r.passed).length;
        const globalFail = allRows.length - globalPass;
        const qualityGateEligibleTurns = allRows.filter(r => r.qualityGateEligible).length;
        const qualityGateTriggered = allRows.filter(r => r.qualityGateTrigger).length;
        const qualityGateEligibleFailures = allRows.filter(r => !r.passed && r.qualityGateEligible).length;
        const coveredFailures = allRows.filter(r => !r.passed && r.qualityGateTrigger).length;
        const uncoveredFailures = globalFail - coveredFailures;
        const ineligibleFailures = globalFail - qualityGateEligibleFailures;
        const qualityGateEligibleDenominator = qualityGateEligibleTurns === 0 ? '0' : String(qualityGateEligibleTurns);
        const globalScore = allRows.length > 0
            ? Math.round(allRows.reduce((acc, row) => acc + row.score, 0) / allRows.length)
            : 0;

        const issueCounts = new Map<string, number>();
        for (const row of allRows) {
            for (const issue of row.issues) {
                issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
            }
        }
        const topIssues = [...issueCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        const worstConversations = conversationSummaries
            .filter(s => s.evaluatedTurns > 0)
            .sort((a, b) => a.avgScore - b.avgScore)
            .slice(0, 8);

        console.log('\nInterview DB Quality Report');
        console.log('===========================');
        const scopeBits = [
            config.includeAllStatuses ? 'status=ALL' : `status=${config.status}`,
            config.botId ? `botId=${config.botId}` : 'botId=ANY'
        ];
        console.log(`Scope: ${scopeBits.join(', ')}`);
        console.log(`Conversations fetched: ${conversations.length}`);
        console.log(`Turns evaluated (assistant question turns): ${allRows.length}`);
        console.log(`Pass: ${globalPass}`);
        console.log(`Fail: ${globalFail}`);
        console.log(`Average score: ${globalScore}/100`);
        console.log(`Quality gate eligible turns: ${qualityGateEligibleTurns}/${allRows.length}`);
        console.log(`Quality gate would trigger on: ${qualityGateTriggered}/${qualityGateEligibleDenominator} eligible turns`);
        console.log(`Failing turns covered by quality gate: ${coveredFailures}/${globalFail}`);
        console.log(`Failing turns not covered by quality gate: ${uncoveredFailures}`);
        console.log(`Failing turns in ineligible phases: ${ineligibleFailures}`);

        console.log('\nBy Phase');
        for (const phase of ['SCAN', 'DEEP', 'DEEP_OFFER', 'DATA_COLLECTION'] as QualitativePhase[]) {
            const rows = byPhase.get(phase) || [];
            const phasePass = rows.filter(r => r.passed).length;
            const phaseScore = rows.length > 0
                ? Math.round(rows.reduce((acc, row) => acc + row.score, 0) / rows.length)
                : 0;
            console.log(`- ${phase}: turns=${rows.length}, pass=${phasePass}, avg=${phaseScore}/100`);
        }

        console.log('\nTop Issues');
        if (topIssues.length === 0) {
            console.log('- none');
        } else {
            for (const [issue, count] of topIssues) {
                console.log(`- ${issue}: ${count}`);
            }
        }

        console.log('\nWorst Conversations');
        if (worstConversations.length === 0) {
            console.log('- none');
        } else {
            for (const conv of worstConversations) {
                console.log(`- ${conv.id} | status=${conv.status} | startedAt=${conv.startedAt.toISOString()} | avg=${conv.avgScore}/100 | evaluated=${conv.evaluatedTurns} | pass=${conv.passedTurns}`);
                if (conv.topIssues.length > 0) {
                    console.log(`  issues: ${conv.topIssues.join('; ')}`);
                }
            }
        }

        console.log('\nExamples Of Failing Turns');
        const failingExamples = allRows.filter(r => !r.passed).slice(0, 12);
        if (failingExamples.length === 0) {
            console.log('- none');
        } else {
            for (const row of failingExamples) {
                console.log(`- conv=${row.conversationId} msg=${row.messageId} phase=${row.phase} score=${row.score}`);
                console.log(`  user: ${row.userResponse.slice(0, 140).replace(/\s+/g, ' ')}`);
                console.log(`  bot : ${row.assistantResponse.slice(0, 180).replace(/\s+/g, ' ')}`);
                console.log(`  issues: ${row.issues.join(' | ')}`);
            }
        }

        if (config.csvOutputPath) {
            const failingRows = allRows.filter(r => !r.passed);
            const csv = toCsv(failingRows, convoMeta);
            const resolved = path.resolve(config.csvOutputPath);
            fs.writeFileSync(resolved, csv, 'utf8');
            console.log(`\nCSV exported: ${resolved} (${failingRows.length} failing turns)`);
        }

    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('QUALITY_REPORT_ERROR', err);
    process.exit(1);
});
