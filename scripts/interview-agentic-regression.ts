import { PrismaClient } from '@prisma/client';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import {
    evaluateTranscriptSemanticFlow,
    type TranscriptSemanticTurn,
} from '../src/lib/interview/transcript-semantic-evaluator';
import {
    getStructuredSubmissionDisplayText,
    type InterviewInteractionPayload,
    type StructuredInterviewSubmission,
} from '../src/lib/interview/structured-interactions';

dotenv.config({ path: '.env.local' });
dotenv.config();

type UserIntent = 'ACCEPT' | 'REFUSE' | 'NEUTRAL';
type TopicTactic = 'normal' | 'clarify_once' | 'off_topic_once';
type FieldDirective = 'valid' | 'invalid_then_valid' | 'skip' | 'already_told_then_valid';

type CliArgs = {
    botId: string;
    baseUrl: string;
    intervieweeModel: string;
    judgeModel: string | null;
    maxTurns: number;
    cleanup: boolean;
    outputPrefix: string;
    scenarioFilter?: string;
    seed: number;
};

type Persona = {
    name: string;
    style: string;
    detailBias: number;
    firstAnswers: string[];
    values: Record<string, string>;
};

type ScenarioDefinition = {
    id: string;
    description: string;
    deepOfferPlan: UserIntent[];
    consentPlan: UserIntent[];
    topicTactic: TopicTactic;
    forceTimePressure: boolean;
    buildFieldPlan: (candidateFields: string[]) => Record<string, FieldDirective>;
};

type RuntimeMetadata = {
    phase?: string;
    supervisorStatus?: string | null;
    topicLabel?: string;
    topicId?: string;
    responseLatencyMs?: number;
    flowFlags?: Record<string, unknown>;
    interactionPayload?: InterviewInteractionPayload | null;
};

type ObservedAssistantTurn = {
    content: string;
    metadata: RuntimeMetadata;
};

type UserReply = {
    text: string;
    structuredSubmission?: StructuredInterviewSubmission | null;
};

type ScenarioRunState = {
    deepOfferIndex: number;
    consentIndex: number;
    fieldAttempts: Record<string, number>;
    topicTurns: number;
    clarificationUsed: boolean;
    offTopicUsed: boolean;
};

type RunAssertion = {
    id: string;
    passed: boolean;
    expected: string;
    observed: string;
};

type JudgeResult = {
    overallScore: number;
    interviewerQuality: number;
    coherence: number;
    engagement: number;
    control: number;
    verdict: 'pass' | 'warn' | 'fail';
    strengths: string[];
    issues: string[];
};

type RunReport = {
    scenarioId: string;
    description: string;
    persona: string;
    conversationId: string;
    completed: boolean;
    assistantTurns: number;
    userTurns: number;
    phasesSeen: string[];
    semanticScore: number;
    semanticFailedTurns: number;
    transitionFailures: number;
    consentFailures: number;
    meanAssistantLatencyMs: number;
    p95AssistantLatencyMs: number;
    totalEffectiveSec: number;
    assertions: RunAssertion[];
    judge: JudgeResult | null;
    runError?: string | null;
    transcript: Array<{
        role: string;
        text: string;
        phase?: string;
        topicLabel?: string;
    }>;
    candidateProfile: Record<string, string>;
};

function normalizePgConnectionString(rawConnectionString: string): string {
    try {
        const url = new URL(rawConnectionString);
        const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase();
        const hasLibpqCompat = url.searchParams.has('uselibpqcompat');

        if (!hasLibpqCompat && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
            url.searchParams.set('uselibpqcompat', 'true');
        }

        return url.toString();
    } catch {
        return rawConnectionString;
    }
}

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('Missing DIRECT_URL or DATABASE_URL');
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require('@prisma/adapter-pg');

    const pool = new Pool({
        connectionString: normalizePgConnectionString(connectionString),
    });
    const adapter = new PrismaPg(pool);

    return new PrismaClient({ adapter });
}

function parseArgs(): CliArgs {
    const rawArgs = process.argv.slice(2);
    const named = new Map<string, string>();

    for (let i = 0; i < rawArgs.length; i++) {
        const current = rawArgs[i];
        if (!current.startsWith('--')) continue;
        const [rawKey, inlineValue] = current.split('=');
        if (inlineValue !== undefined) {
            named.set(rawKey, inlineValue);
            continue;
        }
        const nextValue = rawArgs[i + 1];
        if (nextValue && !nextValue.startsWith('--')) {
            named.set(rawKey, nextValue);
            i += 1;
        } else {
            named.set(rawKey, 'true');
        }
    }

    const positionalBotId = rawArgs.find((arg) => !arg.startsWith('--')) || '';
    const botId = String(named.get('--botId') || positionalBotId || '').trim();
    if (!botId) {
        console.error(
            'Usage: npx ts-node --compiler-options \'{"module":"commonjs"}\' scripts/interview-agentic-regression.ts ' +
            '--botId <botId> [--baseUrl http://127.0.0.1:3000] [--intervieweeModel gpt-4o-mini] ' +
            '[--judgeModel gpt-4.1] [--maxTurns 26] [--cleanup true] [--outputPrefix docs/analysis/interview-agentic-regression] ' +
            '[--scenario <partial-id>] [--seed 42]'
        );
        process.exit(1);
    }

    const parseBool = (value: string | undefined, fallback: boolean) => {
        if (value === undefined) return fallback;
        return /^(1|true|yes|on)$/i.test(value);
    };

    const parseNum = (value: string | undefined, fallback: number) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
    };

    const rawJudgeModel = String(named.get('--judgeModel') || 'gpt-4.1').trim();
    const judgeModel = /^(none|off|disabled|false)$/i.test(rawJudgeModel)
        ? null
        : rawJudgeModel;

    return {
        botId,
        baseUrl: String(named.get('--baseUrl') || 'http://127.0.0.1:3000').trim(),
        intervieweeModel: String(named.get('--intervieweeModel') || 'gpt-4o-mini').trim(),
        judgeModel,
        maxTurns: Math.max(8, parseNum(named.get('--maxTurns'), 26)),
        cleanup: parseBool(named.get('--cleanup'), true),
        outputPrefix: String(named.get('--outputPrefix') || 'docs/analysis/interview-agentic-regression').trim(),
        scenarioFilter: String(named.get('--scenario') || '').trim() || undefined,
        seed: parseNum(named.get('--seed'), 42),
    };
}

function mulberry32(seed: number): () => number {
    return () => {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick<T>(rand: () => number, items: T[]): T {
    return items[Math.max(0, Math.min(items.length - 1, Math.floor(rand() * items.length)))];
}

function mean(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function p95(values: number[]): number {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
    return sorted[index];
}

function slugify(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72);
}

function inferAskedField(question: string, language: string): string | null {
    const text = String(question || '').toLowerCase();
    const isItalian = language.startsWith('it');
    if (/\b(email|mail)\b/i.test(text)) return 'email';
    if (/\b(telefono|phone|numero)\b/i.test(text)) return 'phone';
    if (/\b(linkedin|profilo)\b/i.test(text)) return 'linkedin';
    if (/\b(azienda|company|organizzazione)\b/i.test(text)) return 'company';
    if (/\b(ruolo|role|posizione)\b/i.test(text)) return 'role';
    if (isItalian && /\b(nome|cognome)\b/i.test(text)) return 'name';
    if (!isItalian && /\b(full name|name)\b/i.test(text)) return 'name';
    return null;
}

function isConsentPrompt(question: string, language: string): boolean {
    const text = String(question || '').toLowerCase();
    if (language.startsWith('it')) {
        return /\b(contatt|consenso|permesso|dati di contatto|restare in contatto)\b/i.test(text);
    }
    return /\b(contact details|consent|permission|stay in touch)\b/i.test(text);
}

function intentToText(intent: UserIntent, language: string, context: 'deep_offer' | 'consent'): string {
    const isItalian = language.startsWith('it');
    if (intent === 'ACCEPT') {
        if (context === 'deep_offer') return isItalian ? 'sì, continuiamo pure' : 'yes, let us continue';
        return isItalian ? 'sì, va bene, puoi chiedermeli' : 'yes, that is fine';
    }
    if (intent === 'REFUSE') {
        if (context === 'deep_offer') return isItalian ? 'preferisco chiudere qui' : 'i prefer to stop here';
        return isItalian ? 'preferisco non lasciare i miei dati' : 'i prefer not to share my details';
    }
    if (context === 'deep_offer') {
        return isItalian ? 'dipende, non sono sicuro' : 'it depends, i am not sure';
    }
    return isItalian ? 'prima di dirti sì, a cosa servono?' : 'before saying yes, what would they be used for?';
}

function invalidFieldValue(field: string, language: string): string {
    const isItalian = language.startsWith('it');
    switch (field) {
        case 'email':
            return isItalian ? 'ti scrivo spesso, ma ora non ricordo la mail giusta' : 'i usually answer by email, but not sure which one now';
        case 'phone':
            return isItalian ? 'forse il numero vecchio dell ufficio' : 'maybe the old office number';
        case 'linkedin':
            return isItalian ? 'lo uso poco, non ho il link a portata di mano' : 'i use it rarely, i do not have the link handy';
        default:
            return isItalian ? 'non saprei dirtelo così' : 'i cannot answer that clearly right now';
    }
}

function makePersonas(): Persona[] {
    return [
        {
            name: 'manager_pragmatico',
            style: 'Risponde in modo concreto, con esempi operativi, tono professionale ma diretto.',
            detailBias: 0.45,
            firstAnswers: ['affidabilità operativa', 'governance chiara', 'casi reali applicabili'],
            values: {
                name: 'Luca Bianchi',
                email: 'luca.bianchi@example.com',
                phone: '+39 333 445 9988',
                company: 'Bianchi SRL',
                role: 'Operations Manager',
                linkedin: 'https://linkedin.com/in/luca-bianchi',
            },
        },
        {
            name: 'leader_collaborativo',
            style: 'Risponde con contesto, motivazioni, impatto sul team e un esempio breve.',
            detailBias: 0.8,
            firstAnswers: ['adozione guidata e misurabile', 'competenze diffuse', 'fiducia dei team'],
            values: {
                name: 'Francesca Ferri',
                email: 'francesca.ferri@example.com',
                phone: '+39 347 778 1122',
                company: 'Ferri SPA',
                role: 'CEO',
                linkedin: 'https://linkedin.com/in/francesca-ferri',
            },
        },
        {
            name: 'scettico_costruttivo',
            style: 'Parte critico, poi collabora se la domanda è chiara e non astratta.',
            detailBias: 0.55,
            firstAnswers: ['servono prove concrete', 'meno hype e più casi d uso', 'rischi ben governati'],
            values: {
                name: 'Marco Riva',
                email: 'marco.riva@example.com',
                phone: '+39 349 110 2200',
                company: 'Riva Tech',
                role: 'CTO',
                linkedin: 'https://linkedin.com/in/marco-riva',
            },
        },
    ];
}

function buildScenarioMatrix(candidateFields: string[]): ScenarioDefinition[] {
    const firstField = candidateFields[0] || 'email';
    const lastField = candidateFields[candidateFields.length - 1] || firstField;
    const invalidField = candidateFields.includes('email') ? 'email' : firstField;

    return [
        {
            id: 'happy-path-deep-accept',
            description: 'Percorso ideale: accetta deep offer, accetta consenso, compila tutto correttamente.',
            deepOfferPlan: ['ACCEPT'],
            consentPlan: ['ACCEPT'],
            topicTactic: 'normal',
            forceTimePressure: true,
            buildFieldPlan: () => ({}),
        },
        {
            id: 'deep-refuse-data-accept',
            description: 'Rifiuta il deep offer ma poi accetta la raccolta dati.',
            deepOfferPlan: ['REFUSE'],
            consentPlan: ['ACCEPT'],
            topicTactic: 'normal',
            forceTimePressure: true,
            buildFieldPlan: () => ({}),
        },
        {
            id: 'deep-neutral-then-accept-invalid-field',
            description: 'Prima risposta ambigua al deep offer, poi accetta; in data collection sbaglia un campo e poi lo corregge.',
            deepOfferPlan: ['NEUTRAL', 'ACCEPT'],
            consentPlan: ['ACCEPT'],
            topicTactic: 'normal',
            forceTimePressure: true,
            buildFieldPlan: () => ({ [invalidField]: 'invalid_then_valid' }),
        },
        {
            id: 'deep-neutral-then-refuse-data-refuse',
            description: 'Risposta ambigua al deep offer, poi rifiuto; rifiuta anche la data collection.',
            deepOfferPlan: ['NEUTRAL', 'REFUSE'],
            consentPlan: ['REFUSE'],
            topicTactic: 'normal',
            forceTimePressure: true,
            buildFieldPlan: () => ({}),
        },
        {
            id: 'clarification-then-complete',
            description: 'Durante il topic chiede chiarimento una volta, poi completa tutto.',
            deepOfferPlan: ['ACCEPT'],
            consentPlan: ['ACCEPT'],
            topicTactic: 'clarify_once',
            forceTimePressure: true,
            buildFieldPlan: () => ({}),
        },
        {
            id: 'off-topic-then-skip-last-field',
            description: 'Fa una deviazione off-topic e in data collection salta l ultimo campo.',
            deepOfferPlan: ['REFUSE'],
            consentPlan: ['ACCEPT'],
            topicTactic: 'off_topic_once',
            forceTimePressure: true,
            buildFieldPlan: () => ({ [lastField]: 'skip' }),
        },
        {
            id: 'already-told-then-valid',
            description: 'In data collection risponde "te l ho già detto" sul primo campo, poi lo fornisce.',
            deepOfferPlan: ['ACCEPT'],
            consentPlan: ['ACCEPT'],
            topicTactic: 'normal',
            forceTimePressure: true,
            buildFieldPlan: () => ({ [firstField]: 'already_told_then_valid' }),
        },
    ];
}

function estimateEffectiveSeconds(userText: string, rand: () => number, forceTimePressure: boolean): number {
    const words = String(userText || '').trim().split(/\s+/).filter(Boolean).length;
    const base = 8 + words * 1.8 + Math.round(rand() * 8);
    const raw = Math.max(6, Math.min(58, Math.round(base)));
    return forceTimePressure ? Math.max(42, raw) : raw;
}

async function callChat(params: {
    baseUrl: string;
    conversationId: string;
    botId: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    effectiveDuration: number;
    clientMessageId?: string;
    structuredSubmission?: StructuredInterviewSubmission | null;
}): Promise<{
    text: string;
    isCompleted: boolean;
    currentTopicId?: string | null;
    interactionPayload?: InterviewInteractionPayload | null;
    roundTripLatencyMs: number;
}> {
    const requestStartedAt = Date.now();
    const response = await fetch(`${params.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-chat-simulate': '1',
        },
        body: JSON.stringify({
            conversationId: params.conversationId,
            botId: params.botId,
            messages: params.messages,
            effectiveDuration: params.effectiveDuration,
            ...(params.clientMessageId ? { clientMessageId: params.clientMessageId } : {}),
            ...(params.structuredSubmission ? { structuredSubmission: params.structuredSubmission } : {}),
        }),
    });

    const payload = await response.json();
    const roundTripLatencyMs = Date.now() - requestStartedAt;
    if (!response.ok) {
        throw new Error(`CHAT_API_${response.status}: ${JSON.stringify(payload)}`);
    }

    return {
        text: String(payload.text || ''),
        isCompleted: Boolean(payload.isCompleted),
        currentTopicId: payload.currentTopicId,
        interactionPayload: (payload.interactionPayload && typeof payload.interactionPayload === 'object')
            ? (payload.interactionPayload as InterviewInteractionPayload)
            : null,
        roundTripLatencyMs,
    };
}

async function fetchAssistantTurn(
    prisma: PrismaClient,
    conversationId: string,
    clientMessageId?: string
): Promise<ObservedAssistantTurn> {
    const message = await prisma.message.findFirst({
        where: clientMessageId
            ? {
                conversationId,
                role: 'assistant',
                metadata: {
                    path: ['replyToClientMessageId'],
                    equals: clientMessageId,
                },
            }
            : {
                conversationId,
                role: 'assistant',
            },
        orderBy: { createdAt: 'desc' },
        select: {
            content: true,
            metadata: true,
        },
    });

    if (!message) {
        throw new Error(`Missing assistant turn for conversation=${conversationId} clientMessageId=${clientMessageId || 'initial'}`);
    }

    const metadata = (message.metadata && typeof message.metadata === 'object')
        ? (message.metadata as Record<string, unknown>)
        : {};

    return {
        content: String(message.content || ''),
        metadata: {
            phase: typeof metadata.phase === 'string' ? metadata.phase : undefined,
            supervisorStatus: typeof metadata.supervisorStatus === 'string' ? metadata.supervisorStatus : null,
            topicLabel: typeof metadata.topicLabel === 'string' ? metadata.topicLabel : undefined,
            topicId: typeof metadata.topicId === 'string' ? metadata.topicId : undefined,
            responseLatencyMs: typeof metadata.responseLatencyMs === 'number' ? metadata.responseLatencyMs : undefined,
            flowFlags: typeof metadata.flowFlags === 'object' ? (metadata.flowFlags as Record<string, unknown>) : undefined,
            interactionPayload: (metadata.interactionPayload && typeof metadata.interactionPayload === 'object')
                ? (metadata.interactionPayload as InterviewInteractionPayload)
                : null,
        },
    };
}

async function generateTopicAnswer(params: {
    openai: ReturnType<typeof createOpenAI>;
    model: string;
    language: string;
    persona: Persona;
    assistant: ObservedAssistantTurn;
    scenario: ScenarioDefinition;
    runState: ScenarioRunState;
    rand: () => number;
}): Promise<string> {
    const { openai, model, language, persona, assistant, scenario, runState, rand } = params;
    const isItalian = language.startsWith('it');

    if (scenario.topicTactic === 'clarify_once' && !runState.clarificationUsed) {
        runState.clarificationUsed = true;
        return isItalian ? 'Non mi è chiarissimo: intendi dal lato operativo o strategico?' : 'That is not fully clear: do you mean the operational side or the strategic one?';
    }

    if (scenario.topicTactic === 'off_topic_once' && !runState.offTopicUsed && runState.topicTurns >= 1) {
        runState.offTopicUsed = true;
        return isItalian ? 'Prima di rispondere: questo test porta anche a consigli pratici per il team?' : 'Before answering: will this also lead to practical advice for the team?';
    }

    if (runState.topicTurns === 0) {
        return pick(rand, persona.firstAnswers);
    }

    const prompt = [
        `Language: ${language}`,
        `Persona: ${persona.name}. ${persona.style}`,
        `Detail bias (0-1): ${persona.detailBias.toFixed(2)}`,
        `Interviewer question: "${assistant.content}"`,
        `Topic label: "${assistant.metadata.topicLabel || ''}"`,
        `Scenario goal: ${scenario.description}`,
        persona.detailBias > 0.65
            ? 'Rispondi in 1 frase con un esempio concreto e una conseguenza pratica. Max 38 parole.'
            : 'Rispondi in 1 frase sintetica, concreta e realistica. Max 20 parole.',
        'Niente meta-commenti, niente elenchi, niente tono da manuale.',
    ].join('\n');

    const result = await generateText({
        model: openai(model),
        prompt,
        temperature: 0.45,
    });

    const text = String(result.text || '').replace(/\s+/g, ' ').trim();
    return text || (isItalian ? 'L aspetto chiave per noi è avere esempi concreti e processi chiari.' : 'For us the key point is having concrete examples and clear processes.');
}

function nextIntent(plan: UserIntent[], index: number): UserIntent {
    return plan[Math.min(plan.length - 1, Math.max(0, index))] || 'ACCEPT';
}

function fieldResponseForDirective(params: {
    directive: FieldDirective;
    field: string;
    language: string;
    persona: Persona;
    attempt: number;
}): string {
    const { directive, field, language, persona, attempt } = params;
    if (directive === 'skip') {
        return language.startsWith('it') ? 'Preferisco non dirlo.' : 'I prefer not to say.';
    }
    if (directive === 'invalid_then_valid') {
        return attempt === 0
            ? invalidFieldValue(field, language)
            : (persona.values[field] || invalidFieldValue(field, language));
    }
    if (directive === 'already_told_then_valid') {
        return attempt === 0
            ? (language.startsWith('it') ? 'Te l ho già detto poco fa.' : 'I already told you a moment ago.')
            : (persona.values[field] || invalidFieldValue(field, language));
    }
    return persona.values[field] || invalidFieldValue(field, language);
}

function buildStructuredUserReply(params: {
    assistant: ObservedAssistantTurn;
    language: string;
    text: string;
    fieldId?: string;
    directive?: FieldDirective;
}): UserReply {
    const { assistant, language, text, fieldId, directive } = params;
    const interactionPayload = assistant.metadata.interactionPayload;

    if (!interactionPayload) {
        return { text };
    }

    if (interactionPayload.kind === 'consent') {
        const normalized = text.trim().toLowerCase();
        const action = /^(s[iì]|yes|ok|certo|va bene|accetto)/i.test(normalized) ? 'accept' : 'refuse';
        const structuredSubmission: StructuredInterviewSubmission = {
            kind: 'consent',
            interactionId: interactionPayload.interactionId,
            action,
        };
        return {
            text: getStructuredSubmissionDisplayText(structuredSubmission, language),
            structuredSubmission,
        };
    }

    if (interactionPayload.kind === 'field' && fieldId && interactionPayload.fieldId === fieldId) {
        const action = directive === 'skip' ? 'skip' : 'submit';
        const structuredSubmission: StructuredInterviewSubmission = {
            kind: 'field',
            interactionId: interactionPayload.interactionId,
            fieldId,
            action,
            ...(action === 'submit'
                ? (
                    interactionPayload.inputType === 'choice'
                        ? {
                            optionId: interactionPayload.options?.find((option) =>
                                option.id === text || option.label === text
                            )?.id || interactionPayload.options?.[0]?.id || null,
                        }
                        : { value: text }
                )
                : {}),
        };

        return {
            text: getStructuredSubmissionDisplayText(structuredSubmission, language),
            structuredSubmission,
        };
    }

    return { text };
}

async function generateUserReply(params: {
    openai: ReturnType<typeof createOpenAI>;
    model: string;
    language: string;
    persona: Persona;
    assistant: ObservedAssistantTurn;
    scenario: ScenarioDefinition;
    runState: ScenarioRunState;
    fieldPlan: Record<string, FieldDirective>;
    rand: () => number;
}): Promise<UserReply> {
    const { assistant, language, scenario, runState, fieldPlan, persona } = params;
    const phase = String(assistant.metadata.phase || '').toUpperCase();

    if (phase === 'DEEP_OFFER') {
        const intent = nextIntent(scenario.deepOfferPlan, runState.deepOfferIndex);
        runState.deepOfferIndex += 1;
        const text = intentToText(intent, language, 'deep_offer');
        return buildStructuredUserReply({ assistant, language, text });
    }

    if (phase === 'DATA_COLLECTION' && isConsentPrompt(assistant.content, language)) {
        const intent = nextIntent(scenario.consentPlan, runState.consentIndex);
        runState.consentIndex += 1;
        const text = intentToText(intent, language, 'consent');
        return buildStructuredUserReply({ assistant, language, text });
    }

    if (phase === 'DATA_COLLECTION') {
        const field = assistant.metadata.interactionPayload?.kind === 'field'
            ? assistant.metadata.interactionPayload.fieldId
            : inferAskedField(assistant.content, language);
        if (field) {
            const directive = fieldPlan[field] || 'valid';
            const attempt = runState.fieldAttempts[field] || 0;
            runState.fieldAttempts[field] = attempt + 1;
            const text = fieldResponseForDirective({
                directive,
                field,
                language,
                persona,
                attempt,
            });
            return buildStructuredUserReply({
                assistant,
                language,
                text,
                fieldId: field,
                directive,
            });
        }
    }

    runState.topicTurns += 1;
    return { text: await generateTopicAnswer(params) };
}

async function judgeRun(params: {
    openai: ReturnType<typeof createOpenAI>;
    model: string | null;
    language: string;
    transcript: Array<{ role: string; text: string; phase?: string; topicLabel?: string }>;
    scenario: ScenarioDefinition;
}): Promise<JudgeResult | null> {
    if (!params.model) {
        return null;
    }

    const schema = z.object({
        overallScore: z.number(),
        interviewerQuality: z.number(),
        coherence: z.number(),
        engagement: z.number(),
        control: z.number(),
        verdict: z.enum(['pass', 'warn', 'fail']),
        strengths: z.array(z.string()),
        issues: z.array(z.string()),
    });

    const transcriptText = params.transcript
        .slice(0, 60)
        .map((turn) => {
            const role = turn.role === 'assistant' ? 'A' : 'U';
            const meta = turn.role === 'assistant' ? `[${turn.phase || '-'}|${turn.topicLabel || '-'}]` : '';
            return `${role}${meta}: ${turn.text}`;
        })
        .join('\n');

    try {
        const result = await generateObject({
            model: params.openai(params.model),
            schema,
            prompt: [
                `Language: ${params.language}`,
                `Scenario under test: ${params.scenario.id} - ${params.scenario.description}`,
                'Valuta questa intervista come QA pre-release.',
                'Criteri: qualità delle domande, coerenza dei follow-up, gestione chiarimenti/off-topic, correttezza deep offer, correttezza data collection, naturalezza e capacità di mantenere coinvolgimento.',
                'Usa score 0-100. pass solo se la conversazione è pronta per test pubblico senza riserve sostanziali.',
                'Transcript:',
                transcriptText,
            ].join('\n'),
            temperature: 0,
        });

        const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(Number(value || 0))));
        return {
            overallScore: clampScore(result.object.overallScore),
            interviewerQuality: clampScore(result.object.interviewerQuality),
            coherence: clampScore(result.object.coherence),
            engagement: clampScore(result.object.engagement),
            control: clampScore(result.object.control),
            verdict: result.object.verdict,
            strengths: (result.object.strengths || []).slice(0, 5),
            issues: (result.object.issues || []).slice(0, 6),
        };
    } catch (error) {
        console.error(`[judge] Failed for scenario=${params.scenario.id}`, error);
        return null;
    }
}

function buildAssertions(params: {
    scenario: ScenarioDefinition;
    candidateFields: string[];
    language: string;
    transcript: Array<{ role: string; text: string; phase?: string; topicLabel?: string }>;
    candidateProfile: Record<string, string>;
    fieldQuestionCounts: Record<string, number>;
    phasesSeen: Set<string>;
}): RunAssertion[] {
    const { scenario, candidateFields, language, transcript, candidateProfile, fieldQuestionCounts, phasesSeen } = params;
    const assertions: RunAssertion[] = [];
    const normalizedPhases = new Set(Array.from(phasesSeen).map((phase) => phase.toUpperCase()));
    const sawDeepOffer = normalizedPhases.has('DEEP_OFFER');
    const sawDeepenAfterOffer = (() => {
        let sawOffer = false;
        for (const turn of transcript) {
            const phase = String(turn.phase || '').toUpperCase();
            if (phase === 'DEEP_OFFER') sawOffer = true;
            if (sawOffer && phase === 'DEEPEN') return true;
        }
        return false;
    })();
    const sawFieldAfterConsentRefusal = transcript.some((turn, index) => {
        if (turn.role !== 'user') return false;
        if (!/preferisco non lasciare i miei dati|i prefer not to share my details/i.test(turn.text)) return false;
        return transcript.slice(index + 1).some((nextTurn) =>
            nextTurn.role === 'assistant' &&
            String(nextTurn.phase || '').toUpperCase() === 'DATA_COLLECTION' &&
            Boolean(inferAskedField(nextTurn.text, language))
        );
    });

    assertions.push({
        id: 'deep_offer_seen',
        passed: sawDeepOffer,
        expected: 'Il flow deve raggiungere la fase DEEP_OFFER almeno una volta.',
        observed: sawDeepOffer ? 'DEEP_OFFER osservato.' : 'DEEP_OFFER mai osservato.',
    });

    const finalDeepIntent = scenario.deepOfferPlan[scenario.deepOfferPlan.length - 1];
    if (finalDeepIntent === 'ACCEPT') {
        assertions.push({
            id: 'deep_offer_accept_path',
            passed: sawDeepenAfterOffer,
            expected: 'Dopo l accettazione del deep offer deve esserci almeno un turno in DEEPEN.',
            observed: sawDeepenAfterOffer ? 'DEEPEN osservato dopo DEEP_OFFER.' : 'Nessun DEEPEN osservato dopo DEEP_OFFER.',
        });
    } else if (candidateFields.length > 0) {
        assertions.push({
            id: 'deep_offer_refuse_to_data_collection',
            passed: normalizedPhases.has('DATA_COLLECTION'),
            expected: 'Dopo il rifiuto del deep offer il flow deve passare in DATA_COLLECTION.',
            observed: normalizedPhases.has('DATA_COLLECTION') ? 'DATA_COLLECTION osservata.' : 'DATA_COLLECTION non osservata.',
        });
    }

    const finalConsentIntent = scenario.consentPlan[scenario.consentPlan.length - 1];
    if (candidateFields.length > 0 && finalConsentIntent === 'REFUSE') {
        assertions.push({
            id: 'consent_refusal_blocks_fields',
            passed: !sawFieldAfterConsentRefusal,
            expected: 'Se il consenso viene rifiutato, non devono essere chiesti campi dati.',
            observed: sawFieldAfterConsentRefusal ? 'Domande campo osservate dopo rifiuto consenso.' : 'Nessun campo chiesto dopo rifiuto consenso.',
        });
    }

    for (const [field, directive] of Object.entries(scenario.buildFieldPlan(candidateFields))) {
        if (directive === 'invalid_then_valid' || directive === 'already_told_then_valid') {
            assertions.push({
                id: `field_recovery_${field}`,
                passed: (fieldQuestionCounts[field] || 0) >= 2 && Boolean(candidateProfile[field]) && candidateProfile[field] !== '__SKIPPED__',
                expected: `${field} deve essere richiesto almeno due volte e poi raccolto correttamente.`,
                observed: `askCount=${fieldQuestionCounts[field] || 0} profileValue=${candidateProfile[field] || 'missing'}`,
            });
        }
        if (directive === 'skip') {
            assertions.push({
                id: `field_skip_${field}`,
                passed: candidateProfile[field] === '__SKIPPED__',
                expected: `${field} deve risultare saltato senza bloccare il completamento.`,
                observed: `profileValue=${candidateProfile[field] || 'missing'}`,
            });
        }
    }

    return assertions;
}

function buildMarkdownReport(params: {
    botId: string;
    botName: string;
    intervieweeModel: string;
    judgeModel: string | null;
    runs: RunReport[];
}): string {
    const lines: string[] = [];
    lines.push('# Interview Agentic Regression Report');
    lines.push('');
    lines.push(`- botId: ${params.botId}`);
    lines.push(`- botName: ${params.botName}`);
    lines.push(`- intervieweeModel: ${params.intervieweeModel}`);
    lines.push(`- judgeModel: ${params.judgeModel || 'disabled'}`);
    lines.push(`- latencyMetric: client_request_roundtrip_ms`);
    lines.push(`- runs: ${params.runs.length}`);
    lines.push('');

    for (const run of params.runs) {
        lines.push(`## ${run.scenarioId} (${run.persona})`);
        lines.push('');
        lines.push(`- description: ${run.description}`);
        lines.push(`- conversationId: ${run.conversationId}`);
        lines.push(`- completed: ${run.completed}`);
        lines.push(`- assistantTurns: ${run.assistantTurns}`);
        lines.push(`- userTurns: ${run.userTurns}`);
        lines.push(`- phasesSeen: ${run.phasesSeen.join(', ')}`);
        lines.push(`- semanticScore: ${run.semanticScore}`);
        lines.push(`- transitionFailures: ${run.transitionFailures}`);
        lines.push(`- consentFailures: ${run.consentFailures}`);
        lines.push(`- meanAssistantLatencyMs: ${Math.round(run.meanAssistantLatencyMs)}`);
        lines.push(`- p95AssistantLatencyMs: ${Math.round(run.p95AssistantLatencyMs)}`);
        lines.push(`- totalEffectiveSec: ${run.totalEffectiveSec}`);
        if (run.runError) {
            lines.push(`- runError: ${run.runError}`);
        }
        if (run.judge) {
            lines.push(`- judgeVerdict: ${run.judge.verdict}`);
            lines.push(`- judgeOverallScore: ${run.judge.overallScore}`);
            lines.push(`- judgeInterviewerQuality: ${run.judge.interviewerQuality}`);
            lines.push(`- judgeCoherence: ${run.judge.coherence}`);
            lines.push(`- judgeEngagement: ${run.judge.engagement}`);
            lines.push(`- judgeControl: ${run.judge.control}`);
        }
        lines.push('');
        lines.push('### Assertions');
        for (const assertion of run.assertions) {
            lines.push(`- [${assertion.passed ? 'x' : ' '}] ${assertion.id}: ${assertion.observed}`);
        }
        lines.push('');
        if (run.judge?.strengths?.length) {
            lines.push('### Judge Strengths');
            for (const strength of run.judge.strengths) lines.push(`- ${strength}`);
            lines.push('');
        }
        if (run.judge?.issues?.length) {
            lines.push('### Judge Issues');
            for (const issue of run.judge.issues) lines.push(`- ${issue}`);
            lines.push('');
        }
        lines.push('### Transcript');
        lines.push('```text');
        for (const turn of run.transcript) {
            const role = turn.role === 'assistant' ? 'A' : 'U';
            const meta = turn.role === 'assistant' ? `[${turn.phase || '-'}|${turn.topicLabel || '-'}]` : '';
            lines.push(`${role}${meta}: ${turn.text}`);
        }
        lines.push('```');
        lines.push('');
    }

    return lines.join('\n');
}

function buildJsonReport(params: {
    bot: { id: string; name: string | null };
    args: CliArgs;
    runs: RunReport[];
    fatalError?: string | null;
}) {
    const { bot, args, runs, fatalError } = params;

    return {
        botId: bot.id,
        botName: bot.name,
        generatedAt: new Date().toISOString(),
        baseUrl: args.baseUrl,
        intervieweeModel: args.intervieweeModel,
        judgeModel: args.judgeModel,
        cleanup: args.cleanup,
        fatalError: fatalError || null,
        latencyMetric: 'client_request_roundtrip_ms',
        runs,
        summary: {
            totalRuns: runs.length,
            completedRuns: runs.filter((run) => run.completed).length,
            meanSemanticScore: mean(runs.map((run) => run.semanticScore)),
            meanAssistantLatencyMs: mean(runs.map((run) => run.meanAssistantLatencyMs)),
            p95AssistantLatencyMs: p95(runs.map((run) => run.p95AssistantLatencyMs)),
            hardPassRuns: runs.filter((run) => run.assertions.every((assertion) => assertion.passed)).length,
            judgePassRuns: runs.filter((run) => run.judge?.verdict === 'pass').length,
            runErrors: runs.filter((run) => Boolean(run.runError)).length,
        },
    };
}

function logScenarioDebug(scenarioId: string, step: string, details?: Record<string, unknown>): void {
    const payload = details ? ` ${JSON.stringify(details)}` : '';
    console.log(`[scenario:${scenarioId}] ${step}${payload}`);
}

async function deleteConversation(prisma: PrismaClient, conversationId: string): Promise<void> {
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });
}

async function runScenario(params: {
    prisma: PrismaClient;
    openai: ReturnType<typeof createOpenAI>;
    args: CliArgs;
    bot: {
        id: string;
        name: string;
        language: string | null;
        candidateDataFields: unknown;
    };
    persona: Persona;
    scenario: ScenarioDefinition;
    rand: () => number;
}): Promise<RunReport> {
    const { prisma, openai, args, bot, persona, scenario, rand } = params;
    logScenarioDebug(scenario.id, 'start', {
        persona: persona.name,
        baseUrl: args.baseUrl,
        intervieweeModel: args.intervieweeModel,
    });
    const language = bot.language || 'it';
    const candidateFields = Array.isArray(bot.candidateDataFields)
        ? bot.candidateDataFields.map((value) => String(value || '').trim()).filter(Boolean)
        : [];
    const fieldPlan = scenario.buildFieldPlan(candidateFields);
    const runState: ScenarioRunState = {
        deepOfferIndex: 0,
        consentIndex: 0,
        fieldAttempts: {},
        topicTurns: 0,
        clarificationUsed: false,
        offTopicUsed: false,
    };

    logScenarioDebug(scenario.id, 'conversation.create.begin');
    const conversation = await prisma.conversation.create({
        data: {
            botId: bot.id,
            participantId: `agentic-${scenario.id}-${Date.now()}`,
            status: 'STARTED',
            metadata: {
                simulationHarness: 'agentic-regression',
                scenarioId: scenario.id,
                persona: persona.name,
            },
        },
    });
    logScenarioDebug(scenario.id, 'conversation.create.done', { conversationId: conversation.id });

    const transcriptLocal: Array<{ role: 'assistant' | 'user'; content: string }> = [];
    const assistantLatencies: number[] = [];
    const phasesSeen = new Set<string>();
    let effectiveDuration = 0;
    let completed = false;

    try {
        logScenarioDebug(scenario.id, 'callChat.initial.begin', {
            conversationId: conversation.id,
        });
        const firstReply = await callChat({
            baseUrl: args.baseUrl,
            conversationId: conversation.id,
            botId: bot.id,
            messages: [],
            effectiveDuration: 0,
        });
        logScenarioDebug(scenario.id, 'callChat.initial.done', {
            completed: firstReply.isCompleted,
            textLength: String(firstReply.text || '').length,
        });
        let firstAssistant: ObservedAssistantTurn;
        try {
            logScenarioDebug(scenario.id, 'fetchAssistantTurn.initial.begin', {
                conversationId: conversation.id,
            });
            firstAssistant = await fetchAssistantTurn(prisma, conversation.id);
            logScenarioDebug(scenario.id, 'fetchAssistantTurn.initial.done', {
                phase: firstAssistant.metadata.phase || null,
                textLength: String(firstAssistant.content || '').length,
            });
        } catch {
            logScenarioDebug(scenario.id, 'fetchAssistantTurn.initial.fallback');
            firstAssistant = {
                content: String(firstReply.text || ''),
                metadata: {},
            };
        }
        transcriptLocal.push({ role: 'assistant', content: firstAssistant.content });
        assistantLatencies.push(firstReply.roundTripLatencyMs);
        if (firstAssistant.metadata.phase) phasesSeen.add(firstAssistant.metadata.phase);
        completed = firstReply.isCompleted;
        let currentAssistant = firstAssistant;

        while (!completed && transcriptLocal.filter((turn) => turn.role === 'user').length < args.maxTurns) {
            logScenarioDebug(scenario.id, 'turn.begin', {
                userTurns: transcriptLocal.filter((turn) => turn.role === 'user').length,
                phase: currentAssistant.metadata.phase || null,
            });
            const userReply = await generateUserReply({
                openai,
                model: args.intervieweeModel,
                language,
                persona,
                assistant: currentAssistant,
                scenario,
                runState,
                fieldPlan,
                rand,
            });
            const userText = userReply.text;

            transcriptLocal.push({ role: 'user', content: userText });
            effectiveDuration += estimateEffectiveSeconds(userText, rand, scenario.forceTimePressure);
            const clientMessageId = `${scenario.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const startedAt = Date.now();
            logScenarioDebug(scenario.id, 'callChat.turn.begin', {
                clientMessageId,
                effectiveDuration,
            });
            const chatReply = await callChat({
                baseUrl: args.baseUrl,
                conversationId: conversation.id,
                botId: bot.id,
                messages: transcriptLocal,
                effectiveDuration,
                clientMessageId,
                structuredSubmission: userReply.structuredSubmission,
            });
            logScenarioDebug(scenario.id, 'callChat.turn.done', {
                clientMessageId,
                completed: chatReply.isCompleted,
                textLength: String(chatReply.text || '').length,
            });
            logScenarioDebug(scenario.id, 'fetchAssistantTurn.turn.begin', { clientMessageId });
            const assistant = await fetchAssistantTurn(prisma, conversation.id, clientMessageId);
            logScenarioDebug(scenario.id, 'fetchAssistantTurn.turn.done', {
                clientMessageId,
                phase: assistant.metadata.phase || null,
                textLength: String(assistant.content || '').length,
            });
            const latency = chatReply.roundTripLatencyMs || (Date.now() - startedAt);
            assistantLatencies.push(latency);
            if (assistant.metadata.phase) phasesSeen.add(assistant.metadata.phase);
            transcriptLocal.push({ role: 'assistant', content: assistant.content });
            completed = chatReply.isCompleted;
            currentAssistant = assistant;
        }

        logScenarioDebug(scenario.id, 'conversation.snapshot.begin', {
            conversationId: conversation.id,
        });
        const conversationSnapshot = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            select: {
                status: true,
                candidateProfile: true,
                messages: {
                    orderBy: { createdAt: 'asc' },
                    select: { role: true, content: true, metadata: true },
                },
            },
        });
        logScenarioDebug(scenario.id, 'conversation.snapshot.done', {
            status: conversationSnapshot?.status || null,
            messageCount: conversationSnapshot?.messages?.length || 0,
        });

        const candidateProfile = (conversationSnapshot?.candidateProfile && typeof conversationSnapshot.candidateProfile === 'object')
            ? (conversationSnapshot.candidateProfile as Record<string, string>)
            : {};

        const transcript = (conversationSnapshot?.messages || [])
            .filter((message) => message.role === 'assistant' || message.role === 'user')
            .map((message) => {
                const metadata = (message.metadata && typeof message.metadata === 'object')
                    ? (message.metadata as Record<string, unknown>)
                    : {};
                const phase = typeof metadata.phase === 'string' ? metadata.phase : undefined;
                const topicLabel = typeof metadata.topicLabel === 'string' ? metadata.topicLabel : undefined;
                return {
                    role: message.role,
                    text: String(message.content || '').replace(/\s+/g, ' ').trim(),
                    phase,
                    topicLabel,
                };
            });

        const semanticTurns: TranscriptSemanticTurn[] = transcript.map((turn) => ({
            role: turn.role as 'assistant' | 'user',
            content: turn.text,
            phase: turn.phase as TranscriptSemanticTurn['phase'],
            topicLabel: turn.topicLabel,
        }));
        const semantic = evaluateTranscriptSemanticFlow({
            turns: semanticTurns,
            language,
        });

        const fieldQuestionCounts = transcript.reduce<Record<string, number>>((acc, turn) => {
            if (turn.role !== 'assistant' || String(turn.phase || '').toUpperCase() !== 'DATA_COLLECTION') return acc;
            const field = inferAskedField(turn.text, language);
            if (!field) return acc;
            acc[field] = (acc[field] || 0) + 1;
            return acc;
        }, {});

        const assertions = buildAssertions({
            scenario,
            candidateFields,
            language,
            transcript,
            candidateProfile,
            fieldQuestionCounts,
            phasesSeen,
        });
        const judge = await judgeRun({
            openai,
            model: args.judgeModel,
            language,
            transcript,
            scenario,
        });

        return {
            scenarioId: scenario.id,
            description: scenario.description,
            persona: persona.name,
            conversationId: conversation.id,
            completed: Boolean(conversationSnapshot?.status === 'COMPLETED' || completed),
            assistantTurns: transcript.filter((turn) => turn.role === 'assistant').length,
            userTurns: transcript.filter((turn) => turn.role === 'user').length,
            phasesSeen: Array.from(phasesSeen),
            semanticScore: semantic.score,
            semanticFailedTurns: semantic.failedTurns,
            transitionFailures: semantic.transitionFailures,
            consentFailures: semantic.consentFailures,
            meanAssistantLatencyMs: mean(assistantLatencies),
            p95AssistantLatencyMs: p95(assistantLatencies),
            totalEffectiveSec: effectiveDuration,
            assertions,
            judge,
            transcript,
            candidateProfile,
        };
    } finally {
        logScenarioDebug(scenario.id, 'cleanup.begin', {
            cleanup: args.cleanup,
            conversationId: conversation.id,
        });
        if (args.cleanup) {
            await deleteConversation(prisma, conversation.id);
        }
        logScenarioDebug(scenario.id, 'cleanup.done', {
            cleanup: args.cleanup,
            conversationId: conversation.id,
        });
    }
}

async function main() {
    const args = parseArgs();
    const prisma = createPrismaClient();
    const rand = mulberry32(args.seed);

    try {
        const bot = await prisma.bot.findUnique({
            where: { id: args.botId },
            select: {
                id: true,
                name: true,
                language: true,
                candidateDataFields: true,
                openaiApiKey: true,
            },
        });
        if (!bot) {
            throw new Error(`Bot not found: ${args.botId}`);
        }

        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' },
            select: { openaiApiKey: true },
        });
        const apiKey = process.env.OPENAI_API_KEY || bot.openaiApiKey || globalConfig?.openaiApiKey || '';
        if (!apiKey) {
            throw new Error('OpenAI API key missing (env / bot / globalConfig).');
        }

        const candidateFields = Array.isArray(bot.candidateDataFields)
            ? bot.candidateDataFields.map((value) => String(value || '').trim()).filter(Boolean)
            : [];
        const scenarios = buildScenarioMatrix(candidateFields).filter((scenario) =>
            args.scenarioFilter ? scenario.id.includes(args.scenarioFilter) : true
        );
        if (scenarios.length === 0) {
            throw new Error(`No scenarios matched filter "${args.scenarioFilter}"`);
        }

        const openai = createOpenAI({ apiKey });
        const personas = makePersonas();
        const runs: RunReport[] = [];
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `${args.outputPrefix}-${slugify(bot.name || bot.id)}-${timestamp}`;
        const jsonPath = path.resolve(`${baseName}.json`);
        const markdownPath = path.resolve(`${baseName}.md`);
        mkdirSync(path.dirname(jsonPath), { recursive: true });

        const persistReports = (fatalError?: string | null) => {
            const jsonReport = buildJsonReport({
                bot,
                args,
                runs,
                fatalError,
            });

            writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');
            writeFileSync(markdownPath, buildMarkdownReport({
                botId: bot.id,
                botName: bot.name,
                intervieweeModel: args.intervieweeModel,
                judgeModel: args.judgeModel,
                runs,
            }), 'utf8');
        };

        console.log('\nInterview Agentic Regression');
        console.log('============================');
        console.log(`botId=${bot.id}`);
        console.log(`botName=${bot.name}`);
        console.log(`baseUrl=${args.baseUrl}`);
        console.log(`intervieweeModel=${args.intervieweeModel}`);
        console.log(`judgeModel=${args.judgeModel || 'disabled'}`);
        console.log(`cleanup=${args.cleanup}`);
        console.log(`candidateFields=[${candidateFields.join(', ')}]`);
        console.log(`scenarios=${scenarios.map((scenario) => scenario.id).join(', ')}`);
        console.log(`report_json=${jsonPath}`);
        console.log(`report_md=${markdownPath}`);

        for (const scenario of scenarios) {
            const persona = pick(rand, personas);
            let run: RunReport;

            try {
                run = await runScenario({
                    prisma,
                    openai,
                    args,
                    bot,
                    persona,
                    scenario,
                    rand,
                });
            } catch (error) {
                const message = error instanceof Error ? error.stack || error.message : String(error);
                console.error(`[scenario] Failed for scenario=${scenario.id}`, error);
                run = {
                    scenarioId: scenario.id,
                    description: scenario.description,
                    persona: persona.name,
                    conversationId: 'unknown',
                    completed: false,
                    assistantTurns: 0,
                    userTurns: 0,
                    phasesSeen: [],
                    semanticScore: 0,
                    semanticFailedTurns: 0,
                    transitionFailures: 0,
                    consentFailures: 0,
                    meanAssistantLatencyMs: 0,
                    p95AssistantLatencyMs: 0,
                    totalEffectiveSec: 0,
                    assertions: [{
                        id: 'scenario_execution',
                        passed: false,
                        expected: 'Lo scenario deve completarsi senza errori del runner.',
                        observed: message,
                    }],
                    judge: null,
                    runError: message,
                    transcript: [],
                    candidateProfile: {},
                };
            }
            runs.push(run);
            persistReports();

            const hardFailures = run.assertions.filter((assertion) => !assertion.passed).length;
            console.log(
                `scenario=${run.scenarioId} persona=${run.persona} completed=${run.completed} ` +
                `semantic=${run.semanticScore} hardFailures=${hardFailures} ` +
                `judge=${run.judge?.verdict || 'n/a'} latencyP95=${Math.round(run.p95AssistantLatencyMs)}ms`
            );
        }
        persistReports();

        console.log('\nSummary');
        console.log('-------');
        console.log(`runs=${runs.length}`);
        console.log(`completed=${runs.filter((run) => run.completed).length}/${runs.length}`);
        console.log(`hardPass=${runs.filter((run) => run.assertions.every((assertion) => assertion.passed)).length}/${runs.length}`);
        console.log(`judgePass=${runs.filter((run) => run.judge?.verdict === 'pass').length}/${runs.length}`);
        console.log(`avgSemantic=${mean(runs.map((run) => run.semanticScore)).toFixed(1)}`);
        console.log(`avgAssistantLatencyMs=${Math.round(mean(runs.map((run) => run.meanAssistantLatencyMs)))}`);
        console.log(`p95AssistantLatencyMs=${Math.round(p95(runs.map((run) => run.p95AssistantLatencyMs)))}`);
        console.log(`report_json=${jsonPath}`);
        console.log(`report_md=${markdownPath}`);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error('INTERVIEW_AGENTIC_REGRESSION_ERROR', error);
    process.exit(1);
});
