import {
    onCompletionTag,
    onDeepCompleted,
    onDeepOfferUserIntent,
    onTopicPhaseClosureAttempt,
    type PhaseSimulatorState,
    type UserIntent
} from '../src/lib/interview/phase-simulator';

type SimConfig = {
    runs: number;
    seed: number;
};

type SimCounters = {
    runs: number;
    deepOfferAsked: number;
    closureAttemptsIntercepted: number;
    completionBlockedForConsent: number;
    completionBlockedForMissingField: number;
    prematureCompletionsAllowed: number;
    completedAfterGuards: number;
};

function mulberry32(seed: number): () => number {
    return () => {
        let t = seed += 0x6d2b79f5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pickIntent(rand: () => number): UserIntent {
    const v = rand();
    if (v < 0.45) return 'REFUSE';
    if (v < 0.8) return 'ACCEPT';
    return 'NEUTRAL';
}

function newBaseState(remainingSec: number): PhaseSimulatorState {
    return {
        phase: 'DEEPEN',
        shouldCollectData: true,
        candidateFieldIds: ['fullName', 'email', 'phone'],
        deepAccepted: null,
        consentGiven: null,
        dataCollectionRefused: false,
        missingField: 'email',
        remainingSec
    };
}

function runSingleSimulation(rand: () => number, counters: SimCounters): void {
    const remainingSec = Math.floor(rand() * 240) - 30; // from -30s to +209s
    let state = newBaseState(remainingSec);

    // 1) Try a premature closure during DEEP
    const closureAttempt = onTopicPhaseClosureAttempt(state);
    state = closureAttempt.state;
    if (closureAttempt.action === 'ASK_TOPIC_QUESTION' || closureAttempt.action === 'ASK_DEEP_OFFER') {
        counters.closureAttemptsIntercepted++;
    }
    if (closureAttempt.action === 'ASK_DEEP_OFFER') {
        counters.deepOfferAsked++;
    }

    // 2) End of DEEP path should offer continuation if time remains
    const deepCompleted = onDeepCompleted(state);
    state = deepCompleted.state;
    if (deepCompleted.action === 'ASK_DEEP_OFFER') {
        counters.deepOfferAsked++;
        // user responds to offer
        const firstIntent = pickIntent(rand);
        const offerDecision = onDeepOfferUserIntent(state, firstIntent);
        state = offerDecision.state;

        if (offerDecision.action === 'ASK_DEEP_OFFER') {
            // Neutral response -> ask again and resolve with deterministic second intent
            const secondIntent = pickIntent(rand) === 'NEUTRAL' ? 'REFUSE' : pickIntent(rand);
            const secondDecision = onDeepOfferUserIntent(state, secondIntent);
            state = secondDecision.state;
        }
    }

    // 3) Data collection closure gate
    // Force a completion-tag attempt before consent is guaranteed to test guardrail.
    state.phase = 'DATA_COLLECTION';
    state.consentGiven = state.consentGiven ?? false;
    state.missingField = 'email';

    const prematureCompletion = onCompletionTag(state);
    state = prematureCompletion.state;
    if (prematureCompletion.action === 'COMPLETE_INTERVIEW' || prematureCompletion.action === 'COMPLETE_WITHOUT_DATA') {
        counters.prematureCompletionsAllowed++;
    }
    if (prematureCompletion.action === 'ASK_DATA_CONSENT') {
        counters.completionBlockedForConsent++;
        state.consentGiven = true;
    }

    // completion attempt with missing field
    const withMissingField = onCompletionTag(state);
    state = withMissingField.state;
    if (withMissingField.action === 'ASK_MISSING_FIELD') {
        counters.completionBlockedForMissingField++;
        state.missingField = null;
    }

    // final completion once constraints are satisfied
    const finalCompletion = onCompletionTag(state);
    if (finalCompletion.action === 'COMPLETE_INTERVIEW') {
        counters.completedAfterGuards++;
    }
}

function runSimulation(config: SimConfig): SimCounters {
    const rand = mulberry32(config.seed);
    const counters: SimCounters = {
        runs: config.runs,
        deepOfferAsked: 0,
        closureAttemptsIntercepted: 0,
        completionBlockedForConsent: 0,
        completionBlockedForMissingField: 0,
        prematureCompletionsAllowed: 0,
        completedAfterGuards: 0
    };

    for (let i = 0; i < config.runs; i++) {
        runSingleSimulation(rand, counters);
    }
    return counters;
}

function printReport(counters: SimCounters): void {
    const pct = (value: number) => `${((value / counters.runs) * 100).toFixed(1)}%`;

    console.log('\nInterview Flow Simulation Report');
    console.log('================================');
    console.log(`Runs: ${counters.runs}`);
    console.log(`Premature closure attempts intercepted: ${counters.closureAttemptsIntercepted} (${pct(counters.closureAttemptsIntercepted)})`);
    console.log(`DEEP continuation offers triggered: ${counters.deepOfferAsked}`);
    console.log(`Completion blocked for missing consent: ${counters.completionBlockedForConsent} (${pct(counters.completionBlockedForConsent)})`);
    console.log(`Completion blocked for missing field: ${counters.completionBlockedForMissingField} (${pct(counters.completionBlockedForMissingField)})`);
    console.log(`Premature completions allowed (should be 0): ${counters.prematureCompletionsAllowed}`);
    console.log(`Completed only after guards passed: ${counters.completedAfterGuards} (${pct(counters.completedAfterGuards)})`);
}

function parseArgs(): SimConfig {
    const runsArg = Number(process.argv[2] || 50);
    const seedArg = Number(process.argv[3] || 42);
    return {
        runs: Number.isFinite(runsArg) && runsArg > 0 ? Math.floor(runsArg) : 50,
        seed: Number.isFinite(seedArg) ? Math.floor(seedArg) : 42
    };
}

const config = parseArgs();
const result = runSimulation(config);
printReport(result);
