import { PrismaClient } from '@prisma/client';
import { evaluateTranscriptSemanticFlow, type TranscriptSemanticTurn } from '../src/lib/interview/transcript-semantic-evaluator';
import { buildTopicAnchors, responseMentionsAnchors } from '../src/lib/interview/topic-anchors';

type Phase = 'SCAN' | 'DEEP' | 'DEEP_OFFER' | 'DATA_COLLECTION' | 'DONE';
type AssistantAction = 'ASK_TOPIC' | 'ASK_DEEP_OFFER' | 'ASK_CONSENT' | 'ASK_FIELD' | 'FINAL_CLOSE';
type TransitionMode = 'bridge' | 'clean_pivot' | null;

type CliArgs = {
    botId: string;
    runs: number;
    seed: number;
    maxSteps: number;
    samples: number;
};

type Persona = {
    name: string;
    brevity: number;
    confusionChance: number;
    refuseDeepOfferChance: number;
    refuseConsentChance: number;
    skipFieldChance: number;
    frustrationChance: number;
    values: {
        name: string;
        email: string;
        company: string;
        role: string;
        phone: string;
    };
};

type TopicPlan = {
    id: string;
    label: string;
    orderIndex: number;
    scanMaxTurns: number;
    deepMaxTurns: number;
    anchorRoots: string[];
};

type SimState = {
    phase: Phase;
    topicIndex: number;
    turnInTopic: number;
    deepAccepted: boolean | null;
    consentGiven: boolean | null;
    dataCollectionRefused: boolean;
    lastAskedField: string | null;
    dataCollectionAttempts: number;
    fieldAttemptCounts: Record<string, number>;
    profile: Record<string, string>;
    effectiveSec: number;
    pendingTransitionMode: TransitionMode;
    pendingTransitionSnippet: string | null;
    deepOfferAskedCount: number;
    shouldSendFinalClose: boolean;
};

type SimMetrics = {
    deepOfferWhileTimeLeft: number;
    earlyDataCollection: boolean;
    repeatedFieldAfterCollected: number;
    completionWithoutConsentResolution: boolean;
    backwardTopicJumps: number;
    coveredTopics: number;
    expectedTopics: number;
    coverageRate: number;
    coverageBeforeDataRate: number;
    plannedDurationSec: number;
    effectiveDurationSec: number;
    timeUtilization: number;
    endedTooEarly: boolean;
};

type SimRun = {
    run: number;
    persona: string;
    transcript: TranscriptSemanticTurn[];
    semanticScore: number;
    semanticFailedTurns: number;
    transitionFailures: number;
    consentFailures: number;
    metrics: SimMetrics;
    flowPass: boolean;
    qualityPass: boolean;
    overallPass: boolean;
};

function parseArgs(): CliArgs {
    const botId = String(process.argv[2] || '').trim();
    if (!botId) {
        console.error('Usage: npx ts-node --compiler-options \'{"module":"commonjs"}\' scripts/interview-simulated-runs.ts <botId> [runs] [seed] [maxSteps] [samples]');
        process.exit(1);
    }
    const runs = Number(process.argv[3] || 20);
    const seed = Number(process.argv[4] || 42);
    const maxSteps = Number(process.argv[5] || 80);
    const samples = Number(process.argv[6] || 2);
    return {
        botId,
        runs: Number.isFinite(runs) && runs > 0 ? Math.floor(runs) : 20,
        seed: Number.isFinite(seed) ? Math.floor(seed) : 42,
        maxSteps: Number.isFinite(maxSteps) && maxSteps > 0 ? Math.floor(maxSteps) : 80,
        samples: Number.isFinite(samples) && samples > 0 ? Math.floor(samples) : 2
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
    const idx = Math.max(0, Math.min(values.length - 1, Math.floor(rand() * values.length)));
    return values[idx];
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function normalizeFieldIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .map(v => (typeof v === 'string' ? v : ''))
            .map(v => v.trim())
            .filter(Boolean)
    ));
}

function buildPlanTopics(params: {
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
            const configuredMax = Number(topic.maxTurns || timeBasedMax);
            const scanMaxTurns = perTopicSec < 60
                ? 1
                : Math.max(1, Math.min(configuredMax, timeBasedMax));
            const deepMaxTurns = 2;
            const anchors = buildTopicAnchors(
                {
                    id: topic.id,
                    label: topic.label,
                    orderIndex: idx,
                    description: '',
                    subGoals: topic.subGoals || []
                } as any,
                language
            );
            return {
                id: topic.id,
                label: topic.label,
                orderIndex: topic.orderIndex,
                scanMaxTurns,
                deepMaxTurns,
                anchorRoots: anchors.anchorRoots
            };
        });
}

function makePersonas(): Persona[] {
    return [
        {
            name: 'concise_cooperative',
            brevity: 0.65,
            confusionChance: 0.03,
            refuseDeepOfferChance: 0.45,
            refuseConsentChance: 0.2,
            skipFieldChance: 0.12,
            frustrationChance: 0.08,
            values: {
                name: 'Luca Bianchi',
                email: 'luca.bianchi@example.com',
                company: 'Bianchi SRL',
                role: 'Operations Manager',
                phone: '+39 333 445 9988'
            }
        },
        {
            name: 'detailed_cooperative',
            brevity: 0.18,
            confusionChance: 0.02,
            refuseDeepOfferChance: 0.25,
            refuseConsentChance: 0.1,
            skipFieldChance: 0.06,
            frustrationChance: 0.03,
            values: {
                name: 'Francesca Ferri',
                email: 'francesca.ferri@example.com',
                company: 'Ferri SPA',
                role: 'CEO',
                phone: '+39 347 778 1122'
            }
        },
        {
            name: 'skeptical_but_open',
            brevity: 0.45,
            confusionChance: 0.1,
            refuseDeepOfferChance: 0.5,
            refuseConsentChance: 0.4,
            skipFieldChance: 0.2,
            frustrationChance: 0.2,
            values: {
                name: 'Elena Neri',
                email: 'elena.neri@example.com',
                company: 'Neri Consulting',
                role: 'Innovation Lead',
                phone: '+39 331 889 7744'
            }
        },
        {
            name: 'busy_impatient',
            brevity: 0.78,
            confusionChance: 0.14,
            refuseDeepOfferChance: 0.75,
            refuseConsentChance: 0.55,
            skipFieldChance: 0.35,
            frustrationChance: 0.35,
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

function estimateTurnSeconds(userText: string, rand: () => number): number {
    const words = String(userText || '').trim().split(/\s+/).filter(Boolean).length;
    const base = 8 + words * 1.8 + Math.round(rand() * 10);
    return clamp(Math.round(base), 6, 55);
}

function detectIntent(text: string, language: string): 'ACCEPT' | 'REFUSE' | 'NEUTRAL' {
    const lower = String(text || '').toLowerCase();
    const isItalian = language.startsWith('it');
    const accept = isItalian
        ? /\b(si|sì|ok|va bene|certo|procedi|continuiamo|possiamo)\b/i
        : /\b(yes|sure|ok|go ahead|continue)\b/i;
    const refuse = isItalian
        ? /\b(no|preferisco|fermiamoci|basta|concludere|non voglio)\b/i
        : /\b(no|prefer not|stop|let us stop|i do not want)\b/i;
    if (accept.test(lower)) return 'ACCEPT';
    if (refuse.test(lower)) return 'REFUSE';
    return 'NEUTRAL';
}

function nextMissingField(
    fields: string[],
    profile: Record<string, string>,
    attempts: Record<string, number>,
    maxAttempts: number = 3
): string | null {
    for (const field of fields) {
        const value = profile[field];
        const isCollected = typeof value === 'string' && value.trim() !== '' && value !== '__SKIPPED__';
        const isSkipped = value === '__SKIPPED__';
        const exceeded = (attempts[field] || 0) >= maxAttempts;
        if (isCollected || isSkipped || exceeded) continue;
        return field;
    }
    return null;
}

function getFieldQuestion(field: string, language: string): string {
    const isItalian = language.startsWith('it');
    const labels: Record<string, string> = isItalian
        ? {
            name: 'Mi dici il tuo nome e cognome?',
            fullName: 'Mi dici il tuo nome e cognome?',
            email: 'Qual e il tuo indirizzo email?',
            phone: 'Qual e il tuo numero di telefono?',
            company: 'Qual e il nome della tua azienda?',
            role: 'Qual e il tuo ruolo attuale?',
            linkedin: 'Mi condividi il tuo profilo LinkedIn?'
        }
        : {
            name: 'Can you share your full name?',
            fullName: 'Can you share your full name?',
            email: 'What is your email address?',
            phone: 'What is your phone number?',
            company: 'What is your company name?',
            role: 'What is your current role?',
            linkedin: 'Can you share your LinkedIn profile URL?'
        };
    return labels[field] || (isItalian ? `Puoi indicarmi ${field}?` : `Can you provide ${field}?`);
}

function generateTopicQuestion(params: {
    language: string;
    topicLabel: string;
    transitionMode: TransitionMode;
    transitionSnippet: string | null;
    lastUser: string;
}): string {
    const isItalian = params.language.startsWith('it');
    const probe = isItalian
        ? [
            `quale impatto concreto vedi su ${params.topicLabel}`,
            `puoi farmi un esempio pratico legato a ${params.topicLabel}`,
            `in che modo questo influenza ${params.topicLabel}`
        ]
        : [
            `what concrete impact do you see on ${params.topicLabel}`,
            `can you share one practical example about ${params.topicLabel}`,
            `in what way does this affect ${params.topicLabel}`
        ];
    const selectedProbe = probe[Math.abs(params.lastUser.length) % probe.length];

    if (params.transitionMode === 'bridge') {
        const snippet = params.transitionSnippet || shortSnippet(params.lastUser, 5);
        if (isItalian) {
            return snippet
                ? `Interessante quello che hai detto su "${snippet}". Riguardo a ${params.topicLabel}, ${selectedProbe}?`
                : `Interessante il tuo punto. Riguardo a ${params.topicLabel}, ${selectedProbe}?`;
        }
        return snippet
            ? `Interesting point on "${snippet}". Regarding ${params.topicLabel}, ${selectedProbe}?`
            : `Interesting point. Regarding ${params.topicLabel}, ${selectedProbe}?`;
    }

    if (params.transitionMode === 'clean_pivot') {
        return isItalian
            ? `Riguardo a ${params.topicLabel}, ${selectedProbe}?`
            : `Regarding ${params.topicLabel}, ${selectedProbe}?`;
    }

    return isItalian
        ? `Capisco. Su ${params.topicLabel}, ${selectedProbe}?`
        : `I see. On ${params.topicLabel}, ${selectedProbe}?`;
}

function generateUserTopicReply(params: {
    persona: Persona;
    topic: TopicPlan;
    language: string;
    rand: () => number;
}): string {
    const { persona, topic, language, rand } = params;
    const isItalian = language.startsWith('it');
    if (rand() < persona.confusionChance) {
        return isItalian ? 'non capisco bene la domanda' : 'i do not understand the question';
    }

    const keyword = topic.anchorRoots[0] || topic.label;
    const shortResponses = isItalian
        ? ['affidabilita', 'governance', 'adozione graduale', 'impatto sul team', 'formazione']
        : ['reliability', 'governance', 'gradual adoption', 'team impact', 'training'];

    if (rand() < persona.brevity) {
        return pick(rand, shortResponses);
    }

    if (isItalian) {
        return `Nel nostro contesto ${keyword} e importante: stiamo lavorando su processi piu chiari, metriche e responsabilita condivise, con esempi concreti nei team operativi.`;
    }
    return `In our context ${keyword} is crucial: we are improving processes, metrics, and ownership with concrete examples across operational teams.`;
}

function extractFieldValue(field: string, text: string): string | null {
    const raw = String(text || '').trim();
    if (!raw) return null;

    if (field === 'email') {
        const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        return match ? match[0] : null;
    }
    if (field === 'phone') {
        const match = raw.match(/\+?[0-9][0-9\s().-]{6,}[0-9]/);
        return match ? match[0].replace(/\s+/g, ' ').trim() : null;
    }
    if (field === 'linkedin') {
        const match = raw.match(/https?:\/\/[^\s]+/i);
        return match ? match[0] : null;
    }
    if (field === 'name' || field === 'fullName') {
        const cleaned = raw.replace(/[.!?,;:]/g, '').trim();
        if (cleaned.length > 1 && cleaned.length < 60) return cleaned;
        return null;
    }
    if (field === 'company' || field === 'role') {
        const cleaned = raw.replace(/[.!?,;:]/g, '').trim();
        if (cleaned.length > 1 && cleaned.length < 120) return cleaned;
        return null;
    }
    return raw;
}

function generateUserDataReply(params: {
    persona: Persona;
    action: AssistantAction;
    askedField: string | null;
    language: string;
    rand: () => number;
    alreadyCollected: boolean;
}): string {
    const { persona, action, askedField, language, rand, alreadyCollected } = params;
    const isItalian = language.startsWith('it');

    if (action === 'ASK_CONSENT') {
        if (rand() < persona.refuseConsentChance) {
            return isItalian ? 'preferisco non lasciare i miei dati' : 'i prefer not to share my details';
        }
        return isItalian ? 'si va bene' : 'yes sure';
    }

    if (action === 'ASK_DEEP_OFFER') {
        if (rand() < persona.refuseDeepOfferChance) {
            return isItalian ? 'preferisco concludere' : 'i prefer to conclude';
        }
        return isItalian ? 'si continuiamo' : 'yes continue';
    }

    if (action === 'ASK_FIELD' && askedField) {
        if (alreadyCollected && rand() < 0.7) {
            return isItalian ? 'te l ho gia detto' : 'i already told you';
        }
        if (rand() < persona.skipFieldChance) {
            return isItalian ? 'preferisco non dirlo' : 'i prefer not to say';
        }
        if (rand() < persona.frustrationChance) {
            return isItalian ? 'stai ripetendo la domanda' : 'you are repeating the question';
        }
        if (askedField === 'company' && rand() < 0.35) {
            return `${persona.values.company} e sono ${persona.values.role}`;
        }
        if (askedField === 'role' && rand() < 0.35) {
            return `${persona.values.company} e sono ${persona.values.role}`;
        }
        if (askedField === 'name' || askedField === 'fullName') return persona.values.name;
        if (askedField === 'email') return persona.values.email;
        if (askedField === 'phone') return persona.values.phone;
        if (askedField === 'company') return persona.values.company;
        if (askedField === 'role') return persona.values.role;
        if (askedField === 'linkedin') return 'https://linkedin.com/in/sim-user';
        return 'ok';
    }

    return isItalian ? 'ok' : 'ok';
}

function buildInitialState(): SimState {
    return {
        phase: 'SCAN',
        topicIndex: 0,
        turnInTopic: 0,
        deepAccepted: null,
        consentGiven: null,
        dataCollectionRefused: false,
        lastAskedField: null,
        dataCollectionAttempts: 0,
        fieldAttemptCounts: {},
        profile: {},
        effectiveSec: 0,
        pendingTransitionMode: null,
        pendingTransitionSnippet: null,
        deepOfferAskedCount: 0,
        shouldSendFinalClose: false
    };
}

function runSingleSimulation(params: {
    run: number;
    botLanguage: string;
    topics: TopicPlan[];
    collectCandidateData: boolean;
    candidateFields: string[];
    plannedDurationSec: number;
    rand: () => number;
    maxSteps: number;
    persona: Persona;
}): SimRun {
    const {
        run,
        botLanguage,
        topics,
        collectCandidateData,
        candidateFields,
        plannedDurationSec,
        rand,
        maxSteps,
        persona
    } = params;

    const transcript: TranscriptSemanticTurn[] = [];
    const state = buildInitialState();
    const coveredTopics = new Set<string>();
    const coveredBeforeData = new Set<string>();
    const topicOrderTrack: number[] = [];
    let dataStarted = false;
    let deepOfferWhileTimeLeft = 0;
    let repeatedFieldAfterCollected = 0;
    let completionWithoutConsentResolution = false;

    for (let step = 0; step < maxSteps; step++) {
        if (state.phase === 'DONE') {
            if (state.shouldSendFinalClose) {
                const closeText = botLanguage.startsWith('it')
                    ? 'Grazie per il tempo condiviso. Intervista conclusa.'
                    : 'Thank you for your time. Interview completed.';
                transcript.push({
                    role: 'assistant',
                    phase: 'DATA_COLLECTION',
                    topicLabel: topics[Math.max(0, Math.min(topics.length - 1, state.topicIndex))]?.label || '',
                    content: closeText
                });
                state.shouldSendFinalClose = false;
            }
            break;
        }

        const currentTopic = topics[Math.max(0, Math.min(topics.length - 1, state.topicIndex))];
        let action: AssistantAction;
        let assistantText: string;
        let askedField: string | null = null;

        if (state.phase === 'SCAN' || state.phase === 'DEEP') {
            action = 'ASK_TOPIC';
            assistantText = generateTopicQuestion({
                language: botLanguage,
                topicLabel: currentTopic.label,
                transitionMode: state.pendingTransitionMode,
                transitionSnippet: state.pendingTransitionSnippet,
                lastUser: transcript.slice().reverse().find(t => t.role === 'user')?.content || ''
            });
            state.pendingTransitionMode = null;
            state.pendingTransitionSnippet = null;

            coveredTopics.add(currentTopic.label);
            if (!dataStarted) coveredBeforeData.add(currentTopic.label);
            topicOrderTrack.push(currentTopic.orderIndex);
        } else if (state.phase === 'DEEP_OFFER') {
            action = 'ASK_DEEP_OFFER';
            assistantText = botLanguage.startsWith('it')
                ? 'Abbiamo ancora poco tempo: ti va di continuare con qualche domanda piu approfondita?'
                : 'We still have a bit of time: would you like to continue with a few deeper questions?';
            state.deepOfferAskedCount += 1;
            const remaining = plannedDurationSec - state.effectiveSec;
            if (remaining > 0) deepOfferWhileTimeLeft += 1;
        } else {
            dataStarted = true;
            if (!collectCandidateData || candidateFields.length === 0 || state.dataCollectionRefused) {
                action = 'FINAL_CLOSE';
                assistantText = botLanguage.startsWith('it')
                    ? 'Grazie per il contributo. Chiudiamo qui l intervista.'
                    : 'Thank you for your contribution. We can close the interview here.';
                state.phase = 'DONE';
                state.shouldSendFinalClose = false;
            } else if (state.consentGiven !== true) {
                action = 'ASK_CONSENT';
                assistantText = botLanguage.startsWith('it')
                    ? 'Prima di salutarci, posso chiederti i tuoi dati di contatto per restare in contatto?'
                    : 'Before closing, may I ask your contact details so we can stay in touch?';
                state.dataCollectionAttempts += 1;
            } else {
                const missing = nextMissingField(candidateFields, state.profile, state.fieldAttemptCounts, 3);
                if (!missing) {
                    action = 'FINAL_CLOSE';
                    assistantText = botLanguage.startsWith('it')
                        ? 'Perfetto, grazie. Intervista conclusa.'
                        : 'Perfect, thank you. Interview completed.';
                    state.phase = 'DONE';
                    state.shouldSendFinalClose = false;
                } else {
                    action = 'ASK_FIELD';
                    askedField = missing;
                    const alreadyCollected = Boolean(state.profile[missing] && state.profile[missing] !== '__SKIPPED__');
                    if (alreadyCollected) repeatedFieldAfterCollected += 1;
                    assistantText = getFieldQuestion(missing, botLanguage);
                    state.lastAskedField = missing;
                    state.fieldAttemptCounts[missing] = (state.fieldAttemptCounts[missing] || 0) + 1;
                    state.dataCollectionAttempts += 1;
                }
            }
        }

        transcript.push({
            role: 'assistant',
            content: assistantText,
            phase: state.phase === 'DONE' ? 'DATA_COLLECTION' : (state.phase as Exclude<Phase, 'DONE'>),
            topicLabel: currentTopic.label
        });

        if (action === 'FINAL_CLOSE') {
            break;
        }

        const alreadyCollected = Boolean(askedField && state.profile[askedField] && state.profile[askedField] !== '__SKIPPED__');
        const userText = action === 'ASK_TOPIC'
            ? generateUserTopicReply({
                persona,
                topic: currentTopic,
                language: botLanguage,
                rand
            })
            : generateUserDataReply({
                persona,
                action,
                askedField,
                language: botLanguage,
                rand,
                alreadyCollected
            });

        transcript.push({ role: 'user', content: userText });
        state.effectiveSec += estimateTurnSeconds(userText, rand);

        // State transitions after user answer.
        if (action === 'ASK_TOPIC') {
            const phaseBefore = state.phase;
            const turnsLimit = phaseBefore === 'SCAN' ? currentTopic.scanMaxTurns : currentTopic.deepMaxTurns;
            state.turnInTopic += 1;

            if (state.turnInTopic >= turnsLimit) {
                const hasNextTopic = state.topicIndex + 1 < topics.length;
                if (hasNextTopic) {
                    const nextTopic = topics[state.topicIndex + 1];
                    const userTouchesNext = responseMentionsAnchors(userText, nextTopic.anchorRoots);
                    state.pendingTransitionMode = userTouchesNext && userText.split(/\s+/).filter(Boolean).length >= 5
                        ? 'bridge'
                        : 'clean_pivot';
                    state.pendingTransitionSnippet = state.pendingTransitionMode === 'bridge'
                        ? shortSnippet(userText, 6)
                        : null;
                    state.topicIndex += 1;
                    state.turnInTopic = 0;
                } else {
                    if (phaseBefore === 'SCAN') {
                        const remaining = plannedDurationSec - state.effectiveSec;
                        if (remaining > 0) {
                            state.phase = 'DEEP';
                            state.topicIndex = 0;
                            state.turnInTopic = 0;
                            state.pendingTransitionMode = 'clean_pivot';
                            state.pendingTransitionSnippet = null;
                        } else {
                            state.phase = 'DEEP_OFFER';
                            state.deepAccepted = null;
                            state.turnInTopic = 0;
                        }
                    } else {
                        state.phase = 'DATA_COLLECTION';
                        state.topicIndex = Math.max(0, topics.length - 1);
                        state.turnInTopic = 0;
                        state.consentGiven = null;
                    }
                }
            }
        } else if (action === 'ASK_DEEP_OFFER') {
            const intent = detectIntent(userText, botLanguage);
            if (intent === 'ACCEPT') {
                state.phase = 'DEEP';
                state.deepAccepted = true;
                state.topicIndex = 0;
                state.turnInTopic = 0;
                state.pendingTransitionMode = 'clean_pivot';
                state.pendingTransitionSnippet = null;
            } else if (intent === 'REFUSE' || state.deepOfferAskedCount >= 2) {
                state.phase = 'DATA_COLLECTION';
                state.consentGiven = null;
                state.turnInTopic = 0;
            }
        } else if (action === 'ASK_CONSENT') {
            const intent = detectIntent(userText, botLanguage);
            if (intent === 'ACCEPT') {
                state.consentGiven = true;
            } else if (intent === 'REFUSE') {
                state.consentGiven = false;
                state.dataCollectionRefused = true;
                state.phase = 'DONE';
                state.shouldSendFinalClose = true;
            }
        } else if (action === 'ASK_FIELD' && askedField) {
            const lower = userText.toLowerCase();
            const wantsSkip = /\b(preferisco non|non voglio|skip|non posso)\b/i.test(lower);
            if (wantsSkip) {
                state.profile[askedField] = '__SKIPPED__';
            } else {
                const value = extractFieldValue(askedField, userText);
                if (value) {
                    state.profile[askedField] = value;
                } else if (state.fieldAttemptCounts[askedField] >= 3) {
                    state.profile[askedField] = '__SKIPPED__';
                }
            }
            const missing = nextMissingField(candidateFields, state.profile, state.fieldAttemptCounts, 3);
            if (!missing) {
                state.phase = 'DONE';
                state.shouldSendFinalClose = true;
            }
        }

        if (state.phase === 'DATA_COLLECTION' && coveredBeforeData.size < topics.length) {
            // Marked later as earlyDataCollection.
        }
    }

    const backwardTopicJumps = topicOrderTrack.reduce((acc, item, idx) => {
        if (idx === 0) return acc;
        return acc + (item < topicOrderTrack[idx - 1] ? 1 : 0);
    }, 0);

    const expectedTopics = topics.length;
    const coverageRate = expectedTopics > 0 ? coveredTopics.size / expectedTopics : 0;
    const coverageBeforeDataRate = expectedTopics > 0 ? coveredBeforeData.size / expectedTopics : 0;
    const earlyDataCollection = coverageBeforeDataRate < 1 && transcript.some(t => t.role === 'assistant' && t.phase === 'DATA_COLLECTION');
    const timeUtilization = plannedDurationSec > 0 ? state.effectiveSec / plannedDurationSec : 0;
    const endedTooEarly = state.phase === 'DONE' && timeUtilization < 0.7;

    const semantic = evaluateTranscriptSemanticFlow({
        turns: transcript,
        language: botLanguage
    });

    if (collectCandidateData && candidateFields.length > 0) {
        const consentResolved = state.consentGiven === true || state.dataCollectionRefused;
        if (!consentResolved && state.phase === 'DONE') {
            completionWithoutConsentResolution = true;
        }
    }

    const metrics: SimMetrics = {
        deepOfferWhileTimeLeft,
        earlyDataCollection,
        repeatedFieldAfterCollected,
        completionWithoutConsentResolution,
        backwardTopicJumps,
        coveredTopics: coveredTopics.size,
        expectedTopics,
        coverageRate,
        coverageBeforeDataRate,
        plannedDurationSec,
        effectiveDurationSec: state.effectiveSec,
        timeUtilization,
        endedTooEarly
    };

    const flowPass =
        deepOfferWhileTimeLeft === 0 &&
        !earlyDataCollection &&
        repeatedFieldAfterCollected === 0 &&
        !completionWithoutConsentResolution;
    const qualityPass =
        semantic.score >= 80 &&
        semantic.transitionFailures <= 2 &&
        semantic.consentFailures === 0;
    const overallPass = flowPass && qualityPass;

    return {
        run,
        persona: persona.name,
        transcript,
        semanticScore: semantic.score,
        semanticFailedTurns: semantic.failedTurns,
        transitionFailures: semantic.transitionFailures,
        consentFailures: semantic.consentFailures,
        metrics,
        flowPass,
        qualityPass,
        overallPass
    };
}

function printTranscriptSample(run: SimRun, maxTurns: number = 22): void {
    console.log(`\nRun #${run.run} (${run.persona})`);
    console.log(`flowPass=${run.flowPass} qualityPass=${run.qualityPass} overallPass=${run.overallPass}`);
    console.log(
        `semantic=${run.semanticScore} failedTurns=${run.semanticFailedTurns} ` +
        `transitionFailures=${run.transitionFailures} consentFailures=${run.consentFailures}`
    );
    console.log(
        `coverage=${(run.metrics.coverageRate * 100).toFixed(0)}% ` +
        `coverageBeforeData=${(run.metrics.coverageBeforeDataRate * 100).toFixed(0)}% ` +
        `timeUtil=${(run.metrics.timeUtilization * 100).toFixed(0)}% ` +
        `deepOfferWhileTimeLeft=${run.metrics.deepOfferWhileTimeLeft} ` +
        `repeatedFieldAfterCollected=${run.metrics.repeatedFieldAfterCollected}`
    );
    console.log('Transcript:');
    for (const turn of run.transcript.slice(0, maxTurns)) {
        const role = turn.role === 'assistant' ? 'A' : 'U';
        const phase = turn.role === 'assistant' ? `${turn.phase || 'SCAN'}|${turn.topicLabel || '-'}` : '-';
        const text = String(turn.content || '').replace(/\s+/g, ' ').trim();
        const clipped = text.length > 220 ? `${text.slice(0, 217)}...` : text;
        console.log(`${role} [${phase}] ${clipped}`);
    }
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
                    select: {
                        id: true,
                        label: true,
                        orderIndex: true,
                        maxTurns: true,
                        subGoals: true
                    }
                }
            }
        });

        if (!bot) {
            console.error(`Bot not found: ${args.botId}`);
            process.exit(1);
        }

        const topics = buildPlanTopics({
            topics: bot.topics.map(t => ({
                id: t.id,
                label: t.label,
                orderIndex: t.orderIndex,
                maxTurns: t.maxTurns,
                subGoals: t.subGoals || []
            })),
            maxDurationMins: bot.maxDurationMins || 10,
            language: bot.language || 'it'
        });

        const collectCandidateData = Boolean(bot.collectCandidateData);
        const candidateFields = normalizeFieldIds(bot.candidateDataFields);
        const plannedDurationSec = Math.max(60, Number(bot.maxDurationMins || 10) * 60);
        const personas = makePersonas();

        const runs: SimRun[] = [];
        for (let i = 0; i < args.runs; i++) {
            const persona = pick(rand, personas);
            const result = runSingleSimulation({
                run: i + 1,
                botLanguage: bot.language || 'it',
                topics,
                collectCandidateData,
                candidateFields,
                plannedDurationSec,
                rand,
                maxSteps: args.maxSteps,
                persona
            });
            runs.push(result);
        }

        const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        const flowPasses = runs.filter(r => r.flowPass).length;
        const qualityPasses = runs.filter(r => r.qualityPass).length;
        const overallPasses = runs.filter(r => r.overallPass).length;

        console.log('\nSynthetic Interview Flow Simulation');
        console.log('=================================');
        console.log(`botId=${bot.id}`);
        console.log(`botName=${bot.name}`);
        console.log(`runs=${runs.length} seed=${args.seed}`);
        console.log(`topics=${topics.length} plannedDurationSec=${plannedDurationSec}`);
        console.log(`collectCandidateData=${collectCandidateData} candidateFields=[${candidateFields.join(', ')}]`);
        console.log('');
        console.log(`Flow pass rate: ${flowPasses}/${runs.length} (${((flowPasses / runs.length) * 100).toFixed(1)}%)`);
        console.log(`Quality pass rate: ${qualityPasses}/${runs.length} (${((qualityPasses / runs.length) * 100).toFixed(1)}%)`);
        console.log(`Overall pass rate: ${overallPasses}/${runs.length} (${((overallPasses / runs.length) * 100).toFixed(1)}%)`);
        console.log(`Avg semantic score: ${avg(runs.map(r => r.semanticScore)).toFixed(1)}`);
        console.log(`Avg transition failures: ${avg(runs.map(r => r.transitionFailures)).toFixed(2)}`);
        console.log(`Avg consent failures: ${avg(runs.map(r => r.consentFailures)).toFixed(2)}`);
        console.log(`Avg topic coverage: ${(avg(runs.map(r => r.metrics.coverageRate)) * 100).toFixed(1)}%`);
        console.log(`Avg topic coverage before data collection: ${(avg(runs.map(r => r.metrics.coverageBeforeDataRate)) * 100).toFixed(1)}%`);
        console.log(`Avg time utilization: ${(avg(runs.map(r => r.metrics.timeUtilization)) * 100).toFixed(1)}%`);
        console.log(`Deep offer while time left (total): ${runs.reduce((sum, r) => sum + r.metrics.deepOfferWhileTimeLeft, 0)}`);
        console.log(`Early data collection runs: ${runs.filter(r => r.metrics.earlyDataCollection).length}/${runs.length}`);
        console.log(`Repeated field-after-collected runs: ${runs.filter(r => r.metrics.repeatedFieldAfterCollected > 0).length}/${runs.length}`);
        console.log(`Completion without consent resolution runs: ${runs.filter(r => r.metrics.completionWithoutConsentResolution).length}/${runs.length}`);

        const worst = runs
            .slice()
            .sort((a, b) => {
                if (a.overallPass !== b.overallPass) return Number(a.overallPass) - Number(b.overallPass);
                if (a.flowPass !== b.flowPass) return Number(a.flowPass) - Number(b.flowPass);
                if (a.qualityPass !== b.qualityPass) return Number(a.qualityPass) - Number(b.qualityPass);
                return a.semanticScore - b.semanticScore;
            })
            .slice(0, args.samples);

        const best = runs
            .slice()
            .sort((a, b) => b.semanticScore - a.semanticScore)
            .slice(0, args.samples);

        console.log('\nSample Worst Runs');
        console.log('-----------------');
        for (const run of worst) printTranscriptSample(run);

        console.log('\nSample Best Runs');
        console.log('----------------');
        for (const run of best) printTranscriptSample(run);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('SIMULATION_ERROR', err);
    process.exit(1);
});

