import { PrismaClient } from '@prisma/client';
import { generateObject, generateText as aiGenerateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { evaluateTranscriptSemanticFlow, type TranscriptSemanticTurn } from '../src/lib/interview/transcript-semantic-evaluator';
import { buildTopicAnchors, responseMentionsAnchors } from '../src/lib/interview/topic-anchors';
import { writeFileSync } from 'node:fs';

type Phase = 'SCAN' | 'DEEP' | 'DEEP_OFFER' | 'DATA_COLLECTION' | 'DONE';
type TransitionMode = 'bridge' | 'clean_pivot';

type CliArgs = {
    botId: string;
    runs: number;
    seed: number;
    maxSteps: number;
    samples: number;
    model: string;
    outputPath?: string;
};

type Persona = {
    name: string;
    style: string;
    detailBias: number;
    confusionChance: number;
    deepRefuseChance: number;
    consentRefuseChance: number;
    fieldSkipChance: number;
    values: Record<string, string>;
};

type TopicPlan = {
    id: string;
    label: string;
    scanMaxTurns: number;
    deepMaxTurns: number;
    anchorRoots: string[];
    orderIndex: number;
};

type SimState = {
    phase: Phase;
    topicIndex: number;
    turnInTopic: number;
    effectiveSec: number;
    consentGiven: boolean | null;
    dataCollectionRefused: boolean;
    fieldAttempts: Record<string, number>;
    profile: Record<string, string>;
    pendingTransitionMode: TransitionMode | null;
    pendingTransitionSnippet: string | null;
};

type RunResult = {
    run: number;
    persona: string;
    transcript: TranscriptSemanticTurn[];
    semanticScore: number;
    failedTurns: number;
    transitionFailures: number;
    consentFailures: number;
    coverageRate: number;
    coverageBeforeDataRate: number;
    timeUtilization: number;
    earlyDataCollection: boolean;
    flowPass: boolean;
    qualityPass: boolean;
    overallPass: boolean;
    llmJudge?: {
        score: number;
        pass: boolean;
        strengths: string[];
        issues: string[];
    };
};

function parseArgs(): CliArgs {
    const botId = String(process.argv[2] || '').trim();
    if (!botId) {
        console.error('Usage: npx ts-node --compiler-options \'{"module":"commonjs"}\' scripts/interview-live-llm-batch.ts <botId> [runs] [seed] [maxSteps] [samples] [model] [outputPath]');
        process.exit(1);
    }
    const runs = Number(process.argv[3] || 8);
    const seed = Number(process.argv[4] || 42);
    const maxSteps = Number(process.argv[5] || 80);
    const samples = Number(process.argv[6] || 3);
    const model = String(process.argv[7] || 'gpt-4o-mini').trim();
    const outputPath = String(process.argv[8] || '').trim() || undefined;
    return {
        botId,
        runs: Number.isFinite(runs) && runs > 0 ? Math.floor(runs) : 8,
        seed: Number.isFinite(seed) ? Math.floor(seed) : 42,
        maxSteps: Number.isFinite(maxSteps) && maxSteps > 0 ? Math.floor(maxSteps) : 80,
        samples: Number.isFinite(samples) && samples > 0 ? Math.floor(samples) : 3,
        model,
        outputPath
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

function pick<T>(rand: () => number, values: T[]): T {
    return values[Math.min(values.length - 1, Math.floor(rand() * values.length))];
}

function normalizeFieldIds(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const out = raw
        .map(v => (typeof v === 'string' ? v : ''))
        .map(v => v.trim())
        .filter(Boolean);
    return Array.from(new Set(out));
}

function estimateTurnSeconds(userText: string, rand: () => number): number {
    const words = String(userText || '').trim().split(/\s+/).filter(Boolean).length;
    const sec = 8 + words * 1.6 + Math.round(rand() * 8);
    return Math.max(6, Math.min(55, Math.round(sec)));
}

function shortSnippet(text: string, maxWords: number = 6): string {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/[?!.,;:()[\]{}"'`]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, maxWords)
        .join(' ');
}

function getNextMissingField(
    fields: string[],
    profile: Record<string, string>,
    attempts: Record<string, number>,
    maxAttempts: number = 3
): string | null {
    for (const field of fields) {
        const value = profile[field];
        const done = value && value !== '__SKIPPED__';
        const skipped = value === '__SKIPPED__';
        const exhausted = (attempts[field] || 0) >= maxAttempts;
        if (!done && !skipped && !exhausted) return field;
    }
    return null;
}

function extractFieldValue(field: string, text: string): string | null {
    const input = String(text || '').trim();
    if (!input) return null;
    if (field === 'email') {
        const m = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        return m ? m[0] : null;
    }
    if (field === 'phone') {
        const m = input.match(/\+?[0-9][0-9\s().-]{6,}[0-9]/);
        return m ? m[0].replace(/\s+/g, ' ').trim() : null;
    }
    if (field === 'linkedin' || field === 'portfolio') {
        const m = input.match(/https?:\/\/[^\s]+/i);
        return m ? m[0] : null;
    }
    const cleaned = input.replace(/[.!?,;:]/g, '').trim();
    if (!cleaned) return null;
    return cleaned;
}

function buildTopicPlan(params: {
    topics: Array<{ id: string; label: string; orderIndex: number; maxTurns: number; subGoals: string[] }>;
    maxDurationMins: number;
    language: string;
}): TopicPlan[] {
    const { topics, maxDurationMins, language } = params;
    const totalSec = Math.max(60, maxDurationMins * 60);
    const perTopicSec = totalSec / Math.max(1, topics.length);
    const timeBasedMax = Math.max(1, Math.floor(perTopicSec / 45));
    return topics
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((topic, idx) => {
            const scanMaxTurns = perTopicSec < 60
                ? 1
                : Math.max(1, Math.min(Number(topic.maxTurns || timeBasedMax), timeBasedMax));
            const anchors = buildTopicAnchors(
                {
                    id: topic.id,
                    label: topic.label,
                    description: '',
                    orderIndex: idx,
                    subGoals: topic.subGoals || []
                } as any,
                language
            );
            return {
                id: topic.id,
                label: topic.label,
                scanMaxTurns,
                deepMaxTurns: 2,
                anchorRoots: anchors.anchorRoots,
                orderIndex: topic.orderIndex
            };
        });
}

function makePersonas(): Persona[] {
    return [
        {
            name: 'manager_rapido',
            style: 'Risponde in modo pratico e sintetico.',
            detailBias: 0.35,
            confusionChance: 0.06,
            deepRefuseChance: 0.6,
            consentRefuseChance: 0.4,
            fieldSkipChance: 0.2,
            values: {
                name: 'Luca Bianchi',
                email: 'luca.bianchi@example.com',
                company: 'Bianchi SRL',
                role: 'Operations Manager',
                phone: '+39 333 445 9988'
            }
        },
        {
            name: 'leader_collaborativo',
            style: 'Risponde con esempi, tono collaborativo e orientato a miglioramento.',
            detailBias: 0.8,
            confusionChance: 0.03,
            deepRefuseChance: 0.25,
            consentRefuseChance: 0.1,
            fieldSkipChance: 0.05,
            values: {
                name: 'Francesca Ferri',
                email: 'francesca.ferri@example.com',
                company: 'Ferri SPA',
                role: 'CEO',
                phone: '+39 347 778 1122'
            }
        },
        {
            name: 'scettico_impegnato',
            style: 'All inizio è scettico, poi apre se la domanda è concreta.',
            detailBias: 0.45,
            confusionChance: 0.12,
            deepRefuseChance: 0.55,
            consentRefuseChance: 0.45,
            fieldSkipChance: 0.25,
            values: {
                name: 'Marco Riva',
                email: 'marco.riva@example.com',
                company: 'Riva Tech',
                role: 'CTO',
                phone: '+39 349 110 2200'
            }
        }
    ];
}

function isConfusionSignal(text: string, language: string): boolean {
    const lower = String(text || '').toLowerCase();
    if (!lower) return false;
    if (language.startsWith('it')) {
        return /\b(non capisco|non ho capito|non mi è chiaro|puoi spiegare)\b/i.test(lower);
    }
    return /\b(i do not understand|i don't understand|not clear|can you explain)\b/i.test(lower);
}

function ensureSingleQuestion(text: string): string {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    const parts = compact.split('?').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return `${compact.replace(/[.!?]+$/g, '')}?`;
    if (parts.length === 1 && compact.endsWith('?')) return compact;
    return `${parts[0]}?`;
}

async function generateConversationalAssistantTurn(params: {
    openai: ReturnType<typeof createOpenAI>;
    model: string;
    language: string;
    phase: 'SCAN' | 'DEEP';
    topicLabel: string;
    lastUser: string;
    lastAssistant: string;
    isFirstTurn: boolean;
    transitionMode: TransitionMode | null;
    transitionSnippet: string | null;
    justEnteredDeep: boolean;
}): Promise<string> {
    const schema = z.object({
        acknowledgment: z.string(),
        question: z.string()
    });

    const transitionInstruction = params.transitionMode === 'bridge'
        ? `Sei in transizione topic. Apri con un ponte naturale legato a "${params.transitionSnippet || ''}" e poi passa al nuovo topic.`
        : params.transitionMode === 'clean_pivot'
            ? 'Sei in transizione topic. Fai pivot pulito verso il nuovo topic senza eco letterale della frase utente.'
            : 'Nessuna transizione speciale.';

    const phaseIntent = params.phase === 'SCAN'
        ? 'SCAN: esplora il tema in modo ampio e naturale, senza entrare troppo nel tecnico.'
        : 'DEEP: approfondisci un dettaglio citato dall utente (cause, impatto, esempio concreto).';

    const style = params.language.startsWith('it')
        ? 'Tono: conversazionale, empatico, professionale ma NON formale da questionario.'
        : 'Tone: conversational, empathetic, professional but not formal questionnaire style.';

    const prompt = [
        `Language: ${params.language}`,
        `Phase: ${params.phase}`,
        `Topic: ${params.topicLabel}`,
        phaseIntent,
        style,
        transitionInstruction,
        params.justEnteredDeep ? 'Nota: stai entrando in DEEP, esplicita in modo naturale che stai approfondendo.' : null,
        `Last user message: "${params.lastUser}"`,
        `Last assistant message: "${params.lastAssistant}"`,
        params.isFirstTurn
            ? 'Task: fai una domanda iniziale aperta sul topic (nessun preambolo lungo).'
            : isConfusionSignal(params.lastUser, params.language)
                ? 'Task: riconosci la difficoltà e riformula in modo più semplice, poi fai UNA domanda chiara.'
                : 'Task: fai un breve riconoscimento della risposta utente (max 10 parole), poi UNA domanda di follow-up coerente.',
        'Vincoli: niente chiusura intervista, niente richiesta contatti, niente elenchi.',
        'Output JSON con acknowledgment e question. question deve terminare con "?".'
    ].filter(Boolean).join('\n');

    try {
        const result = await generateObject({
            model: params.openai(params.model),
            schema,
            prompt,
            temperature: 0.3
        });
        const ackRaw = String(result.object.acknowledgment || '').replace(/\s+/g, ' ').trim();
        let question = ensureSingleQuestion(result.object.question || '');
        if (!question) {
            question = params.language.startsWith('it')
                ? `Riguardo a ${params.topicLabel}, qual è l'aspetto più importante per te?`
                : `Regarding ${params.topicLabel}, what matters most to you?`;
        }
        if (params.isFirstTurn && !ackRaw) return question;
        const ack = ackRaw || (params.language.startsWith('it') ? 'Capisco.' : 'I see.');
        return `${ack.replace(/[!?]+$/g, '.')} ${question}`.trim();
    } catch {
        const fallback = await aiGenerateText({
            model: params.openai(params.model),
            prompt,
            temperature: 0.25
        });
        const cleaned = ensureSingleQuestion(fallback.text || '');
        return cleaned || (params.language.startsWith('it')
            ? `Capisco. Su ${params.topicLabel}, qual è l'aspetto più importante per te?`
            : `I see. On ${params.topicLabel}, what matters most to you?`);
    }
}

async function generateText(openai: ReturnType<typeof createOpenAI>, model: string, prompt: string, temperature: number): Promise<string> {
    const result = await aiGenerateText({
        model: openai(model),
        prompt,
        temperature
    });
    return String(result.text || '').trim();
}

function detectIntent(text: string, language: string): 'ACCEPT' | 'REFUSE' | 'NEUTRAL' {
    const lower = String(text || '').toLowerCase();
    const isIt = language.startsWith('it');
    const accept = isIt
        ? /\b(si|sì|ok|va bene|certo|continuiamo|procedi)\b/i
        : /\b(yes|sure|ok|go ahead|continue)\b/i;
    const refuse = isIt
        ? /\b(no|preferisco|basta|concludere|non voglio)\b/i
        : /\b(no|prefer not|stop|conclude|i do not want)\b/i;
    if (accept.test(lower)) return 'ACCEPT';
    if (refuse.test(lower)) return 'REFUSE';
    return 'NEUTRAL';
}

async function runSingle(params: {
    run: number;
    openai: ReturnType<typeof createOpenAI>;
    model: string;
    language: string;
    topics: TopicPlan[];
    plannedDurationSec: number;
    collectData: boolean;
    candidateFields: string[];
    persona: Persona;
    rand: () => number;
    maxSteps: number;
}): Promise<RunResult> {
    const {
        run, openai, model, language, topics, plannedDurationSec,
        collectData, candidateFields, persona, rand, maxSteps
    } = params;
    const isIt = language.startsWith('it');
    const transcript: TranscriptSemanticTurn[] = [];
    const state: SimState = {
        phase: 'SCAN',
        topicIndex: 0,
        turnInTopic: 0,
        effectiveSec: 0,
        consentGiven: null,
        dataCollectionRefused: false,
        fieldAttempts: {},
        profile: {},
        pendingTransitionMode: null,
        pendingTransitionSnippet: null
    };

    let deepOfferWhileTimeLeft = 0;
    let repeatedFieldAfterCollected = 0;
    let coverageEarlyData = false;
    const covered = new Set<string>();
    const coveredBeforeData = new Set<string>();

    for (let step = 0; step < maxSteps; step++) {
        if (state.phase === 'DONE') break;
        const topic = topics[Math.max(0, Math.min(topics.length - 1, state.topicIndex))];

        let assistantText = '';
        let assistantPhase: Phase = state.phase;
        let askedField: string | null = null;
        const lastUser = transcript.slice().reverse().find(t => t.role === 'user')?.content || '';
        const lastAssistant = transcript.slice().reverse().find(t => t.role === 'assistant')?.content || '';
        const isFirstAssistantTurn = transcript.every(t => t.role !== 'assistant');

        if (state.phase === 'SCAN' || state.phase === 'DEEP') {
            covered.add(topic.label);
            if (!coverageEarlyData) coveredBeforeData.add(topic.label);
            assistantText = await generateConversationalAssistantTurn({
                openai,
                model,
                language,
                phase: state.phase,
                topicLabel: topic.label,
                lastUser,
                lastAssistant,
                isFirstTurn: isFirstAssistantTurn,
                transitionMode: state.pendingTransitionMode,
                transitionSnippet: state.pendingTransitionSnippet,
                justEnteredDeep: state.phase === 'DEEP' && state.turnInTopic === 0
            });
            state.pendingTransitionMode = null;
            state.pendingTransitionSnippet = null;
        } else if (state.phase === 'DEEP_OFFER') {
            const remaining = plannedDurationSec - state.effectiveSec;
            if (remaining > 0) deepOfferWhileTimeLeft += 1;
            assistantText = await generateText(
                openai,
                model,
                [
                    `Lingua: ${language}`,
                    'Task: chiedi SOLO se l utente vuole continuare con qualche domanda in piu (si/no).',
                    'Vincoli: una singola domanda, tono leggero, niente chiusura.'
                ].join('\n'),
                0.2
            );
            if (!assistantText.includes('?')) assistantText = `${assistantText.replace(/[.!?]+$/g, '')}?`;
        } else {
            coverageEarlyData = true;
            if (!collectData || candidateFields.length === 0 || state.dataCollectionRefused) {
                assistantText = isIt
                    ? 'Grazie per il contributo, possiamo chiudere qui l intervista.'
                    : 'Thank you for your input, we can close the interview here.';
                state.phase = 'DONE';
                assistantPhase = 'DATA_COLLECTION';
            } else if (state.consentGiven !== true) {
                assistantText = await generateText(
                    openai,
                    model,
                    [
                        `Lingua: ${language}`,
                        `Ultima risposta utente: "${lastUser}"`,
                        'Task: in modo naturale, chiedi SOLO il consenso a raccogliere i contatti (si/no).',
                        'Vincoli: una singola domanda, tono rispettoso.'
                    ].join('\n'),
                    0.2
                );
                if (!assistantText.includes('?')) assistantText = `${assistantText.replace(/[.!?]+$/g, '')}?`;
            } else {
                const missing = getNextMissingField(candidateFields, state.profile, state.fieldAttempts, 3);
                if (!missing) {
                    assistantText = isIt
                        ? 'Perfetto, grazie. Intervista conclusa.'
                        : 'Perfect, thank you. Interview completed.';
                    state.phase = 'DONE';
                    assistantPhase = 'DATA_COLLECTION';
                } else {
                    askedField = missing;
                    if (state.profile[missing] && state.profile[missing] !== '__SKIPPED__') {
                        repeatedFieldAfterCollected += 1;
                    }
                    assistantText = await generateText(
                        openai,
                        model,
                        [
                            `Lingua: ${language}`,
                            `Ultima risposta utente: "${lastUser}"`,
                            `Task: chiedi SOLO questo campo: ${missing}.`,
                            'Vincoli: una singola domanda, tono conversazionale, nessun altro campo.'
                        ].join('\n'),
                        0.2
                    );
                    if (!assistantText.includes('?')) assistantText = `${assistantText.replace(/[.!?]+$/g, '')}?`;
                    state.fieldAttempts[missing] = (state.fieldAttempts[missing] || 0) + 1;
                }
            }
        }

        transcript.push({
            role: 'assistant',
            phase: assistantPhase as any,
            topicLabel: topic.label,
            content: assistantText
        });

        if (state.phase === 'DONE') break;

        let userText = '';
        if (state.phase === 'SCAN' || state.phase === 'DEEP') {
            if (rand() < persona.confusionChance) {
                userText = isIt ? 'non capisco bene la domanda' : 'i do not understand the question';
            } else {
                userText = await generateText(
                    openai,
                    model,
                    [
                        `Lingua: ${language}`,
                        `Persona: ${persona.name}. ${persona.style}`,
                        `Bias dettaglio 0-1: ${persona.detailBias.toFixed(2)}`,
                        `Domanda intervistatore: "${assistantText}"`,
                        `Rispondi come persona reale in 1 frase ${persona.detailBias > 0.6 ? 'con un esempio pratico concreto' : 'in modo sintetico e diretto'}.`,
                        `Lunghezza: ${persona.detailBias > 0.6 ? 'max 35 parole' : 'max 18 parole'}.`,
                        'Stile: colloquiale professionale, niente tono da articolo o manuale, niente meta-commenti.'
                    ].join('\n'),
                    0.45
                );
            }
        } else if (state.phase === 'DEEP_OFFER') {
            if (rand() < persona.deepRefuseChance) {
                userText = isIt ? 'preferisco concludere' : 'i prefer to conclude';
            } else {
                userText = isIt ? 'si continuiamo' : 'yes continue';
            }
        } else {
            if (state.consentGiven !== true) {
                if (rand() < persona.consentRefuseChance) {
                    userText = isIt ? 'preferisco non lasciare i miei dati' : 'i prefer not to share my details';
                } else {
                    userText = isIt ? 'si va bene' : 'yes sure';
                }
            } else {
                const missing = getNextMissingField(candidateFields, state.profile, state.fieldAttempts, 3);
                if (!missing) {
                    userText = isIt ? 'ok' : 'ok';
                } else if (rand() < persona.fieldSkipChance) {
                    userText = isIt ? 'preferisco non dirlo' : 'i prefer not to say';
                } else {
                    userText = persona.values[missing] || (isIt ? 'non saprei' : 'not sure');
                }
            }
        }

        transcript.push({ role: 'user', content: userText });
        state.effectiveSec += estimateTurnSeconds(userText, rand);

        if (state.phase === 'SCAN' || state.phase === 'DEEP') {
            const turnsLimit = state.phase === 'SCAN' ? topic.scanMaxTurns : topic.deepMaxTurns;
            state.turnInTopic += 1;
            if (state.turnInTopic >= turnsLimit) {
                const hasNext = state.topicIndex + 1 < topics.length;
                if (hasNext) {
                    const nextTopic = topics[state.topicIndex + 1];
                    const touchesNext = responseMentionsAnchors(userText, nextTopic.anchorRoots);
                    state.pendingTransitionMode = touchesNext && userText.split(/\s+/).filter(Boolean).length >= 5
                        ? 'bridge'
                        : 'clean_pivot';
                    state.pendingTransitionSnippet = state.pendingTransitionMode === 'bridge'
                        ? shortSnippet(userText, 6)
                        : null;
                    state.topicIndex += 1;
                    state.turnInTopic = 0;
                } else {
                    if (state.phase === 'SCAN') {
                        const remaining = plannedDurationSec - state.effectiveSec;
                        if (remaining > 0) {
                            state.phase = 'DEEP';
                            state.topicIndex = 0;
                            state.turnInTopic = 0;
                            state.pendingTransitionMode = 'clean_pivot';
                            state.pendingTransitionSnippet = null;
                        } else {
                            state.phase = 'DEEP_OFFER';
                        }
                    } else {
                        state.phase = 'DATA_COLLECTION';
                        state.topicIndex = Math.max(0, topics.length - 1);
                        state.turnInTopic = 0;
                        state.consentGiven = null;
                    }
                }
            }
        } else if (state.phase === 'DEEP_OFFER') {
            const intent = detectIntent(userText, language);
            if (intent === 'ACCEPT') {
                state.phase = 'DEEP';
                state.topicIndex = 0;
                state.turnInTopic = 0;
                state.pendingTransitionMode = 'clean_pivot';
                state.pendingTransitionSnippet = null;
            } else {
                state.phase = 'DATA_COLLECTION';
                state.consentGiven = null;
            }
        } else {
            if (state.consentGiven !== true) {
                const intent = detectIntent(userText, language);
                if (intent === 'ACCEPT') {
                    state.consentGiven = true;
                } else if (intent === 'REFUSE') {
                    state.consentGiven = false;
                    state.dataCollectionRefused = true;
                    state.phase = 'DONE';
                }
            } else {
                const missing = getNextMissingField(candidateFields, state.profile, state.fieldAttempts, 3);
                if (missing) {
                    if (/\b(preferisco non|skip|non voglio)\b/i.test(userText.toLowerCase())) {
                        state.profile[missing] = '__SKIPPED__';
                    } else {
                        const value = extractFieldValue(missing, userText);
                        if (value) state.profile[missing] = value;
                        if (!value && (state.fieldAttempts[missing] || 0) >= 3) {
                            state.profile[missing] = '__SKIPPED__';
                        }
                    }
                }
                const nextMissing = getNextMissingField(candidateFields, state.profile, state.fieldAttempts, 3);
                if (!nextMissing) state.phase = 'DONE';
            }
        }
    }

    const expectedTopics = topics.length;
    const coverageRate = expectedTopics > 0 ? covered.size / expectedTopics : 0;
    const coverageBeforeDataRate = expectedTopics > 0 ? coveredBeforeData.size / expectedTopics : 0;
    const earlyDataCollection = coverageEarlyData && coveredBeforeData.size < expectedTopics;
    const timeUtilization = plannedDurationSec > 0 ? state.effectiveSec / plannedDurationSec : 0;

    const semantic = evaluateTranscriptSemanticFlow({
        turns: transcript,
        language
    });

    const flowPass =
        deepOfferWhileTimeLeft === 0 &&
        !earlyDataCollection &&
        repeatedFieldAfterCollected === 0;
    const qualityPass =
        semantic.score >= 75 &&
        semantic.transitionFailures <= 3 &&
        semantic.consentFailures === 0;

    return {
        run,
        persona: persona.name,
        transcript,
        semanticScore: semantic.score,
        failedTurns: semantic.failedTurns,
        transitionFailures: semantic.transitionFailures,
        consentFailures: semantic.consentFailures,
        coverageRate,
        coverageBeforeDataRate,
        timeUtilization,
        earlyDataCollection,
        flowPass,
        qualityPass,
        overallPass: flowPass && qualityPass
    };
}

async function judgeTranscript(params: {
    openai: ReturnType<typeof createOpenAI>;
    model: string;
    language: string;
    transcript: TranscriptSemanticTurn[];
}): Promise<{ score: number; pass: boolean; strengths: string[]; issues: string[] }> {
    const schema = z.object({
        score: z.number(),
        pass: z.boolean(),
        strengths: z.array(z.string()).max(5),
        issues: z.array(z.string()).max(6)
    });
    const lines = params.transcript.slice(0, 40).map(t => {
        const role = t.role === 'assistant' ? 'A' : 'U';
        const phase = t.role === 'assistant' ? `[${t.phase || 'SCAN'}|${t.topicLabel || '-'}]` : '';
        return `${role}${phase}: ${String(t.content || '').replace(/\s+/g, ' ').trim()}`;
    }).join('\n');
    const prompt = [
        `Language: ${params.language}`,
        'Valuta questa trascrizione di intervista qualitativa.',
        'Criteri: naturalezza, coerenza semantica follow-up, transizioni topic, gestione consenso/data collection, assenza di ripetizioni generiche.',
        'Assegna score 0-100 e pass=true solo se pronta per go-live qualitativo.',
        'Transcript:',
        lines
    ].join('\n');
    const result = await generateObject({
        model: params.openai(params.model),
        schema,
        prompt,
        temperature: 0
    });
    const score = Math.max(0, Math.min(100, Math.round(Number(result.object.score || 0))));
    return {
        score,
        pass: Boolean(result.object.pass),
        strengths: result.object.strengths || [],
        issues: result.object.issues || []
    };
}

function printTranscript(run: RunResult, maxTurns?: number): void {
    console.log(`\nRun #${run.run} persona=${run.persona}`);
    console.log(
        `overallPass=${run.overallPass} flowPass=${run.flowPass} qualityPass=${run.qualityPass} ` +
        `semantic=${run.semanticScore} transitionFailures=${run.transitionFailures} consentFailures=${run.consentFailures}`
    );
    console.log(
        `coverage=${(run.coverageRate * 100).toFixed(0)}% beforeData=${(run.coverageBeforeDataRate * 100).toFixed(0)}% ` +
        `timeUtil=${(run.timeUtilization * 100).toFixed(0)}% earlyData=${run.earlyDataCollection}`
    );
    if (run.llmJudge) {
        console.log(
            `LLM_JUDGE score=${run.llmJudge.score} pass=${run.llmJudge.pass} ` +
            `strengths=${run.llmJudge.strengths.join(' | ')} issues=${run.llmJudge.issues.join(' | ')}`
        );
    }
    console.log('Transcript:');
    const turns = typeof maxTurns === 'number' ? run.transcript.slice(0, maxTurns) : run.transcript;
    for (const turn of turns) {
        const role = turn.role === 'assistant' ? 'A' : 'U';
        const phase = turn.role === 'assistant' ? `[${turn.phase || 'SCAN'}|${turn.topicLabel || '-'}]` : '';
        const text = String(turn.content || '').replace(/\s+/g, ' ').trim();
        console.log(`${role}${phase}: ${text}`);
    }
}

function buildMarkdownReport(params: {
    botId: string;
    botName: string;
    model: string;
    runs: RunResult[];
}): string {
    const lines: string[] = [];
    lines.push('# Live LLM Interview Batch - Full Transcripts');
    lines.push('');
    lines.push(`- botId: ${params.botId}`);
    lines.push(`- botName: ${params.botName}`);
    lines.push(`- model: ${params.model}`);
    lines.push(`- runs: ${params.runs.length}`);
    lines.push('');

    for (const run of params.runs) {
        lines.push(`## Run ${run.run} (${run.persona})`);
        lines.push('');
        lines.push(`- overallPass: ${run.overallPass}`);
        lines.push(`- flowPass: ${run.flowPass}`);
        lines.push(`- qualityPass: ${run.qualityPass}`);
        lines.push(`- semanticScore: ${run.semanticScore}`);
        lines.push(`- transitionFailures: ${run.transitionFailures}`);
        lines.push(`- consentFailures: ${run.consentFailures}`);
        lines.push(`- coverage: ${(run.coverageRate * 100).toFixed(1)}%`);
        lines.push(`- coverageBeforeData: ${(run.coverageBeforeDataRate * 100).toFixed(1)}%`);
        lines.push(`- timeUtilization: ${(run.timeUtilization * 100).toFixed(1)}%`);
        if (run.llmJudge) {
            lines.push(`- llmJudgeScore: ${run.llmJudge.score}`);
            lines.push(`- llmJudgePass: ${run.llmJudge.pass}`);
            if (run.llmJudge.strengths.length) {
                lines.push(`- llmJudgeStrengths: ${run.llmJudge.strengths.join(' | ')}`);
            }
            if (run.llmJudge.issues.length) {
                lines.push(`- llmJudgeIssues: ${run.llmJudge.issues.join(' | ')}`);
            }
        }
        lines.push('');
        lines.push('```text');
        for (const turn of run.transcript) {
            const role = turn.role === 'assistant' ? 'A' : 'U';
            const phase = turn.role === 'assistant' ? `[${turn.phase || 'SCAN'}|${turn.topicLabel || '-'}]` : '';
            const text = String(turn.content || '').replace(/\s+/g, ' ').trim();
            lines.push(`${role}${phase}: ${text}`);
        }
        lines.push('```');
        lines.push('');
    }
    return lines.join('\n');
}

async function main() {
    const args = parseArgs();
    const prisma = new PrismaClient();
    const rand = mulberry32(args.seed);

    try {
        const bot = await prisma.bot.findUnique({
            where: { id: args.botId },
            include: {
                topics: {
                    orderBy: { orderIndex: 'asc' },
                    select: { id: true, label: true, orderIndex: true, maxTurns: true, subGoals: true }
                }
            }
        });
        if (!bot) {
            console.error(`Bot not found: ${args.botId}`);
            process.exit(1);
        }

        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' },
            select: { openaiApiKey: true }
        });
        const apiKey = process.env.OPENAI_API_KEY || bot.openaiApiKey || globalConfig?.openaiApiKey || '';
        if (!apiKey) {
            console.error('No OpenAI API key available (env/bot/global).');
            process.exit(1);
        }

        const openai = createOpenAI({ apiKey });
        const language = bot.language || 'it';
        const plannedDurationSec = Math.max(60, Number(bot.maxDurationMins || 10) * 60);
        const candidateFields = normalizeFieldIds(bot.candidateDataFields);
        const topics = buildTopicPlan({
            topics: bot.topics.map(t => ({
                id: t.id,
                label: t.label,
                orderIndex: t.orderIndex,
                maxTurns: t.maxTurns,
                subGoals: t.subGoals || []
            })),
            maxDurationMins: bot.maxDurationMins || 10,
            language
        });
        const personas = makePersonas();

        const runs: RunResult[] = [];
        for (let i = 0; i < args.runs; i++) {
            const persona = pick(rand, personas);
            const run = await runSingle({
                run: i + 1,
                openai,
                model: args.model,
                language,
                topics,
                plannedDurationSec,
                collectData: Boolean(bot.collectCandidateData),
                candidateFields,
                persona,
                rand,
                maxSteps: args.maxSteps
            });
            runs.push(run);
        }

        const sortedForSamples = runs.slice().sort((a, b) => {
            if (a.overallPass !== b.overallPass) return Number(a.overallPass) - Number(b.overallPass);
            return a.semanticScore - b.semanticScore;
        });
        const sampleCount = Math.min(args.samples, runs.length);
        const sampleSet: RunResult[] = [
            ...sortedForSamples.slice(0, sampleCount),
            ...runs.slice().sort((a, b) => b.semanticScore - a.semanticScore).slice(0, sampleCount)
        ];
        const uniqueSamples = Array.from(new Map(sampleSet.map(r => [r.run, r])).values());

        for (const sample of uniqueSamples) {
            sample.llmJudge = await judgeTranscript({
                openai,
                model: args.model,
                language,
                transcript: sample.transcript
            });
        }

        const avg = (vals: number[]) => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        console.log('\nLive LLM Interview Batch');
        console.log('========================');
        console.log(`botId=${bot.id}`);
        console.log(`botName=${bot.name}`);
        console.log(`model=${args.model}`);
        console.log(`runs=${runs.length} seed=${args.seed}`);
        console.log(`topics=${topics.length} plannedDurationSec=${plannedDurationSec}`);
        console.log(`collectCandidateData=${bot.collectCandidateData} fields=[${candidateFields.join(', ')}]`);
        console.log(`overallPass=${runs.filter(r => r.overallPass).length}/${runs.length} (${((runs.filter(r => r.overallPass).length / runs.length) * 100).toFixed(1)}%)`);
        console.log(`flowPass=${runs.filter(r => r.flowPass).length}/${runs.length} (${((runs.filter(r => r.flowPass).length / runs.length) * 100).toFixed(1)}%)`);
        console.log(`qualityPass=${runs.filter(r => r.qualityPass).length}/${runs.length} (${((runs.filter(r => r.qualityPass).length / runs.length) * 100).toFixed(1)}%)`);
        console.log(`avgSemanticScore=${avg(runs.map(r => r.semanticScore)).toFixed(1)}`);
        console.log(`avgTransitionFailures=${avg(runs.map(r => r.transitionFailures)).toFixed(2)}`);
        console.log(`avgConsentFailures=${avg(runs.map(r => r.consentFailures)).toFixed(2)}`);
        console.log(`avgCoverage=${(avg(runs.map(r => r.coverageRate)) * 100).toFixed(1)}%`);
        console.log(`avgCoverageBeforeData=${(avg(runs.map(r => r.coverageBeforeDataRate)) * 100).toFixed(1)}%`);
        console.log(`avgTimeUtilization=${(avg(runs.map(r => r.timeUtilization)) * 100).toFixed(1)}%`);
        console.log(`earlyDataRuns=${runs.filter(r => r.earlyDataCollection).length}/${runs.length}`);

        console.log('\nSample Transcripts (for calibration)');
        console.log('------------------------------------');
        for (const sample of uniqueSamples) {
            printTranscript(sample);
        }

        if (args.outputPath) {
            const report = buildMarkdownReport({
                botId: bot.id,
                botName: bot.name,
                model: args.model,
                runs
            });
            writeFileSync(args.outputPath, report, 'utf8');
            console.log(`\nFull transcripts written to: ${args.outputPath}`);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('LIVE_LLM_BATCH_ERROR', err);
    process.exit(1);
});
