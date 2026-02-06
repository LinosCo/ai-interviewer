import { prisma } from '@/lib/prisma';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export type InterviewAlertSeverity = 'critical' | 'warning' | 'info';

export interface InterviewQualityThresholds {
    minEvaluatedTurns: number;
    minAssistantTurnsForCoverage: number;
    telemetryCoverageWarn: number;
    passRateWarn: number;
    passRateCritical: number;
    gateTriggerWarn: number;
    gateTriggerCritical: number;
    fallbackWarn: number;
    fallbackCritical: number;
    completionGuardWarn: number;
    passRateDropWarn: number;
}

export interface InterviewQualityAlert {
    id: string;
    severity: InterviewAlertSeverity;
    title: string;
    description: string;
}

export interface InterviewQualityBotSummary {
    botId: string;
    botName: string;
    organizationId: string | null;
    organizationName: string | null;
    assistantTurns: number;
    telemetryTurns: number;
    eligibleTurns: number;
    evaluatedTurns: number;
    passTurns: number;
    failTurns: number;
    passRate: number;
    avgScore: number | null;
    gateTriggeredTurns: number;
    gateTriggerRate: number;
    fallbackTurns: number;
    fallbackRate: number;
    completionGuardIntercepts: number;
}

export interface InterviewQualityWindowSummary {
    assistantTurns: number;
    telemetryTurns: number;
    telemetryCoverage: number;
    eligibleTurns: number;
    evaluatedTurns: number;
    passTurns: number;
    failTurns: number;
    passRate: number;
    avgScore: number | null;
    gateTriggeredTurns: number;
    gateTriggerRate: number;
    regeneratedTurns: number;
    regenerationRate: number;
    fallbackTurns: number;
    fallbackRate: number;
    topicClosureIntercepts: number;
    deepOfferClosureIntercepts: number;
    completionGuardIntercepts: number;
    completionBlockedForConsent: number;
    completionBlockedForMissingField: number;
    completionGuardRate: number;
    truncated: boolean;
    byBot: InterviewQualityBotSummary[];
}

export interface InterviewQualityDashboardData {
    generatedAt: string;
    windowHours: number;
    maxTurns: number;
    current: InterviewQualityWindowSummary;
    previous: InterviewQualityWindowSummary;
    delta: {
        passRate: number;
        avgScore: number | null;
        gateTriggerRate: number;
        fallbackRate: number;
    };
    topFailingBots: InterviewQualityBotSummary[];
    alerts: InterviewQualityAlert[];
    thresholds: InterviewQualityThresholds;
    aiReview?: InterviewQualityAiReview;
}

export interface InterviewQualityAiReview {
    generated: boolean;
    model: string;
    summary: string;
    priorities: string[];
    risks: string[];
}

interface DashboardOptions {
    windowHours?: number;
    maxTurns?: number;
    botId?: string;
    now?: Date;
    thresholds?: Partial<InterviewQualityThresholds>;
    includeAiReview?: boolean;
}

interface RawAssistantTurn {
    botId: string;
    botName: string;
    organizationId: string | null;
    organizationName: string | null;
    metadata: unknown;
}

interface ParsedAssistantTurnTelemetry {
    hasQualityTelemetry: boolean;
    hasFlowTelemetry: boolean;
    quality: {
        eligible: boolean;
        evaluated: boolean;
        score: number | null;
        passed: boolean | null;
        gateTriggered: boolean;
        regenerated: boolean;
        fallbackUsed: boolean;
    };
    flow: {
        topicClosureIntercepted: boolean;
        deepOfferClosureIntercepted: boolean;
        completionGuardIntercepted: boolean;
        completionBlockedForConsent: boolean;
        completionBlockedForMissingField: boolean;
    };
}

const DEFAULT_THRESHOLDS: InterviewQualityThresholds = {
    minEvaluatedTurns: 40,
    minAssistantTurnsForCoverage: 30,
    telemetryCoverageWarn: 0.9,
    passRateWarn: 0.85,
    passRateCritical: 0.75,
    gateTriggerWarn: 0.25,
    gateTriggerCritical: 0.4,
    fallbackWarn: 0.03,
    fallbackCritical: 0.08,
    completionGuardWarn: 0.05,
    passRateDropWarn: 0.1
};

function clampInt(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.floor(value)));
}

function safeRate(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
}

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function asBoolean(value: unknown, fallback: boolean = false): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value;
}

function asString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback;
}

export function parseInterviewAssistantTelemetry(metadata: unknown): ParsedAssistantTurnTelemetry {
    const meta = asObject(metadata);
    const quality = meta ? asObject(meta.quality) : null;
    const flow = meta ? asObject(meta.flowFlags) : null;

    return {
        hasQualityTelemetry: Boolean(quality),
        hasFlowTelemetry: Boolean(flow),
        quality: {
            eligible: asBoolean(quality?.eligible),
            evaluated: asBoolean(quality?.evaluated),
            score: asNumber(quality?.score),
            passed: typeof quality?.passed === 'boolean' ? quality.passed : null,
            gateTriggered: asBoolean(quality?.gateTriggered),
            regenerated: asBoolean(quality?.regenerated),
            fallbackUsed: asBoolean(quality?.fallbackUsed)
        },
        flow: {
            topicClosureIntercepted: asBoolean(flow?.topicClosureIntercepted),
            deepOfferClosureIntercepted: asBoolean(flow?.deepOfferClosureIntercepted),
            completionGuardIntercepted: asBoolean(flow?.completionGuardIntercepted),
            completionBlockedForConsent: asBoolean(flow?.completionBlockedForConsent),
            completionBlockedForMissingField: asBoolean(flow?.completionBlockedForMissingField)
        }
    };
}

export function summarizeInterviewQualityTurns(turns: RawAssistantTurn[], truncated: boolean = false): InterviewQualityWindowSummary {
    const botMap = new Map<string, {
        botId: string;
        botName: string;
        organizationId: string | null;
        organizationName: string | null;
        assistantTurns: number;
        telemetryTurns: number;
        eligibleTurns: number;
        evaluatedTurns: number;
        passTurns: number;
        failTurns: number;
        scoreSum: number;
        scoredTurns: number;
        gateTriggeredTurns: number;
        fallbackTurns: number;
        completionGuardIntercepts: number;
    }>();

    let assistantTurns = 0;
    let telemetryTurns = 0;
    let eligibleTurns = 0;
    let evaluatedTurns = 0;
    let passTurns = 0;
    let failTurns = 0;
    let scoreSum = 0;
    let scoredTurns = 0;
    let gateTriggeredTurns = 0;
    let regeneratedTurns = 0;
    let fallbackTurns = 0;
    let topicClosureIntercepts = 0;
    let deepOfferClosureIntercepts = 0;
    let completionGuardIntercepts = 0;
    let completionBlockedForConsent = 0;
    let completionBlockedForMissingField = 0;

    for (const turn of turns) {
        assistantTurns++;
        const parsed = parseInterviewAssistantTelemetry(turn.metadata);

        if (parsed.hasQualityTelemetry || parsed.hasFlowTelemetry) telemetryTurns++;
        if (parsed.quality.eligible) eligibleTurns++;

        if (parsed.quality.evaluated) {
            evaluatedTurns++;
            if (parsed.quality.passed === true) {
                passTurns++;
            } else {
                failTurns++;
            }
            if (parsed.quality.score !== null) {
                scoredTurns++;
                scoreSum += parsed.quality.score;
            }
        }

        if (parsed.quality.gateTriggered) gateTriggeredTurns++;
        if (parsed.quality.regenerated) regeneratedTurns++;
        if (parsed.quality.fallbackUsed) fallbackTurns++;

        if (parsed.flow.topicClosureIntercepted) topicClosureIntercepts++;
        if (parsed.flow.deepOfferClosureIntercepted) deepOfferClosureIntercepts++;
        if (parsed.flow.completionGuardIntercepted) completionGuardIntercepts++;
        if (parsed.flow.completionBlockedForConsent) completionBlockedForConsent++;
        if (parsed.flow.completionBlockedForMissingField) completionBlockedForMissingField++;

        const existing = botMap.get(turn.botId) || {
            botId: turn.botId,
            botName: turn.botName,
            organizationId: turn.organizationId,
            organizationName: turn.organizationName,
            assistantTurns: 0,
            telemetryTurns: 0,
            eligibleTurns: 0,
            evaluatedTurns: 0,
            passTurns: 0,
            failTurns: 0,
            scoreSum: 0,
            scoredTurns: 0,
            gateTriggeredTurns: 0,
            fallbackTurns: 0,
            completionGuardIntercepts: 0
        };

        existing.assistantTurns++;
        if (parsed.hasQualityTelemetry || parsed.hasFlowTelemetry) existing.telemetryTurns++;
        if (parsed.quality.eligible) existing.eligibleTurns++;
        if (parsed.quality.evaluated) {
            existing.evaluatedTurns++;
            if (parsed.quality.passed === true) existing.passTurns++;
            else existing.failTurns++;
            if (parsed.quality.score !== null) {
                existing.scoreSum += parsed.quality.score;
                existing.scoredTurns++;
            }
        }
        if (parsed.quality.gateTriggered) existing.gateTriggeredTurns++;
        if (parsed.quality.fallbackUsed) existing.fallbackTurns++;
        if (parsed.flow.completionGuardIntercepted) existing.completionGuardIntercepts++;

        botMap.set(turn.botId, existing);
    }

    const byBot: InterviewQualityBotSummary[] = [...botMap.values()].map(bot => ({
        botId: bot.botId,
        botName: bot.botName,
        organizationId: bot.organizationId,
        organizationName: bot.organizationName,
        assistantTurns: bot.assistantTurns,
        telemetryTurns: bot.telemetryTurns,
        eligibleTurns: bot.eligibleTurns,
        evaluatedTurns: bot.evaluatedTurns,
        passTurns: bot.passTurns,
        failTurns: bot.failTurns,
        passRate: safeRate(bot.passTurns, bot.evaluatedTurns),
        avgScore: bot.scoredTurns > 0 ? Math.round(bot.scoreSum / bot.scoredTurns) : null,
        gateTriggeredTurns: bot.gateTriggeredTurns,
        gateTriggerRate: safeRate(bot.gateTriggeredTurns, bot.eligibleTurns),
        fallbackTurns: bot.fallbackTurns,
        fallbackRate: safeRate(bot.fallbackTurns, bot.evaluatedTurns),
        completionGuardIntercepts: bot.completionGuardIntercepts
    }));

    return {
        assistantTurns,
        telemetryTurns,
        telemetryCoverage: safeRate(telemetryTurns, assistantTurns),
        eligibleTurns,
        evaluatedTurns,
        passTurns,
        failTurns,
        passRate: safeRate(passTurns, evaluatedTurns),
        avgScore: scoredTurns > 0 ? Math.round(scoreSum / scoredTurns) : null,
        gateTriggeredTurns,
        gateTriggerRate: safeRate(gateTriggeredTurns, eligibleTurns),
        regeneratedTurns,
        regenerationRate: safeRate(regeneratedTurns, evaluatedTurns),
        fallbackTurns,
        fallbackRate: safeRate(fallbackTurns, evaluatedTurns),
        topicClosureIntercepts,
        deepOfferClosureIntercepts,
        completionGuardIntercepts,
        completionBlockedForConsent,
        completionBlockedForMissingField,
        completionGuardRate: safeRate(completionGuardIntercepts, eligibleTurns),
        truncated,
        byBot
    };
}

export function buildInterviewQualityAlerts(params: {
    current: InterviewQualityWindowSummary;
    previous: InterviewQualityWindowSummary;
    thresholds?: Partial<InterviewQualityThresholds>;
}): InterviewQualityAlert[] {
    const thresholds: InterviewQualityThresholds = {
        ...DEFAULT_THRESHOLDS,
        ...(params.thresholds || {})
    };

    const alerts: InterviewQualityAlert[] = [];
    const { current, previous } = params;

    if (current.assistantTurns >= thresholds.minAssistantTurnsForCoverage && current.telemetryCoverage < thresholds.telemetryCoverageWarn) {
        alerts.push({
            id: 'telemetry-coverage-low',
            severity: 'warning',
            title: 'Copertura telemetria bassa',
            description: `Solo il ${(current.telemetryCoverage * 100).toFixed(1)}% dei turni ha telemetry quality/flow.`
        });
    }

    if (current.evaluatedTurns < thresholds.minEvaluatedTurns) {
        alerts.push({
            id: 'sample-too-small',
            severity: 'info',
            title: 'Campione ancora limitato',
            description: `Turni valutati ${current.evaluatedTurns}/${thresholds.minEvaluatedTurns}: attendi piu traffico prima di decisioni forti.`
        });
    } else {
        if (current.passRate < thresholds.passRateCritical) {
            alerts.push({
                id: 'pass-rate-critical',
                severity: 'critical',
                title: 'Quality pass-rate critico',
                description: `Pass-rate ${(current.passRate * 100).toFixed(1)}%, sotto la soglia critica ${(thresholds.passRateCritical * 100).toFixed(0)}%.`
            });
        } else if (current.passRate < thresholds.passRateWarn) {
            alerts.push({
                id: 'pass-rate-warning',
                severity: 'warning',
                title: 'Quality pass-rate in calo',
                description: `Pass-rate ${(current.passRate * 100).toFixed(1)}%, sotto la soglia ${(thresholds.passRateWarn * 100).toFixed(0)}%.`
            });
        }

        if (current.gateTriggerRate > thresholds.gateTriggerCritical) {
            alerts.push({
                id: 'gate-trigger-critical',
                severity: 'critical',
                title: 'Quality gate trigger troppo alto',
                description: `Il gate interviene nel ${(current.gateTriggerRate * 100).toFixed(1)}% dei turni eleggibili.`
            });
        } else if (current.gateTriggerRate > thresholds.gateTriggerWarn) {
            alerts.push({
                id: 'gate-trigger-warning',
                severity: 'warning',
                title: 'Quality gate trigger elevato',
                description: `Il gate interviene nel ${(current.gateTriggerRate * 100).toFixed(1)}% dei turni eleggibili.`
            });
        }

        if (current.fallbackRate > thresholds.fallbackCritical) {
            alerts.push({
                id: 'fallback-critical',
                severity: 'critical',
                title: 'Fallback deterministico frequente',
                description: `Fallback attivato nel ${(current.fallbackRate * 100).toFixed(1)}% dei turni valutati.`
            });
        } else if (current.fallbackRate > thresholds.fallbackWarn) {
            alerts.push({
                id: 'fallback-warning',
                severity: 'warning',
                title: 'Fallback deterministico sopra soglia',
                description: `Fallback attivato nel ${(current.fallbackRate * 100).toFixed(1)}% dei turni valutati.`
            });
        }

        if (current.completionGuardRate > thresholds.completionGuardWarn) {
            alerts.push({
                id: 'completion-guard-warning',
                severity: 'warning',
                title: 'Intercettazioni completion elevate',
                description: `Completion guard intervenuto ${current.completionGuardIntercepts} volte (${(current.completionGuardRate * 100).toFixed(1)}%).`
            });
        }
    }

    if (current.evaluatedTurns >= thresholds.minEvaluatedTurns && previous.evaluatedTurns >= thresholds.minEvaluatedTurns) {
        const passRateDelta = current.passRate - previous.passRate;
        if (passRateDelta <= -thresholds.passRateDropWarn) {
            alerts.push({
                id: 'pass-rate-drop',
                severity: 'warning',
                title: 'Calo quality rispetto alla finestra precedente',
                description: `Pass-rate ${(current.passRate * 100).toFixed(1)}% (delta ${(passRateDelta * 100).toFixed(1)} punti).`
            });
        }
    }

    const severityRank: Record<InterviewAlertSeverity, number> = {
        critical: 3,
        warning: 2,
        info: 1
    };

    return alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
}

async function generateInterviewQualityAiReview(params: {
    windowHours: number;
    current: InterviewQualityWindowSummary;
    previous: InterviewQualityWindowSummary;
    delta: {
        passRate: number;
        avgScore: number | null;
        gateTriggerRate: number;
        fallbackRate: number;
    };
    alerts: InterviewQualityAlert[];
    topFailingBots: InterviewQualityBotSummary[];
}): Promise<InterviewQualityAiReview> {
    const modelName = 'gpt-4o-mini';
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return {
            generated: false,
            model: modelName,
            summary: 'OPENAI_API_KEY non configurata: report AI non disponibile.',
            priorities: [],
            risks: []
        };
    }

    const openai = createOpenAI({ apiKey });
    const reviewSchema = z.object({
        summary: z.string().min(20).max(400),
        priorities: z.array(z.string().min(8).max(220)).min(1).max(5),
        risks: z.array(z.string().min(8).max(220)).min(1).max(5)
    });

    const compactPayload = {
        windowHours: params.windowHours,
        current: {
            passRate: params.current.passRate,
            avgScore: params.current.avgScore,
            gateTriggerRate: params.current.gateTriggerRate,
            fallbackRate: params.current.fallbackRate,
            completionGuardRate: params.current.completionGuardRate,
            evaluatedTurns: params.current.evaluatedTurns
        },
        previous: {
            passRate: params.previous.passRate,
            avgScore: params.previous.avgScore,
            gateTriggerRate: params.previous.gateTriggerRate,
            fallbackRate: params.previous.fallbackRate,
            evaluatedTurns: params.previous.evaluatedTurns
        },
        delta: params.delta,
        alerts: params.alerts.slice(0, 8).map(a => ({
            severity: a.severity,
            title: a.title,
            description: a.description
        })),
        topFailingBots: params.topFailingBots.slice(0, 6).map(bot => ({
            botName: bot.botName,
            organizationName: bot.organizationName,
            evaluatedTurns: bot.evaluatedTurns,
            passRate: bot.passRate,
            gateTriggerRate: bot.gateTriggerRate,
            fallbackRate: bot.fallbackRate
        }))
    };

    try {
        const result = await generateObject({
            model: openai(modelName),
            schema: reviewSchema,
            temperature: 0.2,
            prompt: `Sei un reviewer QA per interview-bot.
Analizza il seguente report sintetico e produci output operativo per admin.

Regole:
- Sii concreto e sintetico.
- Non inventare metriche.
- Evidenzia priorita tecniche che riducono errori di flow e qualità.
- Rispondi in italiano.

Report:
${JSON.stringify(compactPayload, null, 2)}`
        });

        return {
            generated: true,
            model: modelName,
            summary: result.object.summary.trim(),
            priorities: result.object.priorities.map(v => v.trim()).filter(Boolean),
            risks: result.object.risks.map(v => v.trim()).filter(Boolean)
        };
    } catch (error) {
        console.error('Interview quality AI review failed:', error);
        return {
            generated: false,
            model: modelName,
            summary: `Generazione AI non riuscita: ${String(error)}`,
            priorities: [],
            risks: []
        };
    }
}

async function fetchInterviewAssistantTurns(params: {
    from: Date;
    to: Date;
    maxTurns: number;
    botId?: string;
}): Promise<{ turns: RawAssistantTurn[]; truncated: boolean }> {
    const rows = await prisma.message.findMany({
        where: {
            role: 'assistant',
            createdAt: {
                gte: params.from,
                lt: params.to
            },
            conversation: {
                ...(params.botId ? { botId: params.botId } : {}),
                bot: {
                    botType: 'interview'
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: params.maxTurns,
        select: {
            metadata: true,
            conversation: {
                select: {
                    botId: true,
                    bot: {
                        select: {
                            name: true,
                            project: {
                                select: {
                                    organizationId: true,
                                    organization: {
                                        select: {
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    return {
        turns: rows.map(row => ({
            botId: row.conversation.botId,
            botName: asString(row.conversation.bot.name, 'Untitled bot'),
            organizationId: row.conversation.bot.project.organizationId || null,
            organizationName: row.conversation.bot.project.organization?.name || null,
            metadata: row.metadata
        })),
        truncated: rows.length >= params.maxTurns
    };
}

export async function getInterviewQualityDashboardData(options: DashboardOptions = {}): Promise<InterviewQualityDashboardData> {
    const windowHours = clampInt(options.windowHours ?? 24, 1, 168);
    const maxTurns = clampInt(options.maxTurns ?? 5000, 500, 20000);
    const now = options.now || new Date();
    const windowMs = windowHours * 60 * 60 * 1000;

    const currentFrom = new Date(now.getTime() - windowMs);
    const previousFrom = new Date(now.getTime() - (windowMs * 2));

    const [currentRaw, previousRaw] = await Promise.all([
        fetchInterviewAssistantTurns({ from: currentFrom, to: now, maxTurns, botId: options.botId }),
        fetchInterviewAssistantTurns({ from: previousFrom, to: currentFrom, maxTurns, botId: options.botId })
    ]);

    const current = summarizeInterviewQualityTurns(currentRaw.turns, currentRaw.truncated);
    const previous = summarizeInterviewQualityTurns(previousRaw.turns, previousRaw.truncated);
    const thresholds: InterviewQualityThresholds = {
        ...DEFAULT_THRESHOLDS,
        ...(options.thresholds || {})
    };

    const topFailingBots = [...current.byBot]
        .filter(bot => bot.evaluatedTurns >= 8)
        .sort((a, b) => {
            if (a.passRate !== b.passRate) return a.passRate - b.passRate;
            return b.failTurns - a.failTurns;
        })
        .slice(0, 12);

    const alerts = buildInterviewQualityAlerts({
        current,
        previous,
        thresholds
    });

    const deltaAvgScore =
        current.avgScore === null || previous.avgScore === null
            ? null
            : current.avgScore - previous.avgScore;

    const delta = {
        passRate: current.passRate - previous.passRate,
        avgScore: deltaAvgScore,
        gateTriggerRate: current.gateTriggerRate - previous.gateTriggerRate,
        fallbackRate: current.fallbackRate - previous.fallbackRate
    };

    const aiReview = options.includeAiReview
        ? await generateInterviewQualityAiReview({
            windowHours,
            current,
            previous,
            delta,
            alerts,
            topFailingBots
        })
        : undefined;

    return {
        generatedAt: now.toISOString(),
        windowHours,
        maxTurns,
        current,
        previous,
        delta,
        topFailingBots,
        alerts,
        thresholds,
        aiReview
    };
}
