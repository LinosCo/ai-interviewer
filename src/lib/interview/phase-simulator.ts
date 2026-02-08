import { getCompletionGuardAction, shouldInterceptTopicPhaseClosure } from './phase-flow';

export type InterviewPhase = 'SCAN' | 'DEEP' | 'DEEP_OFFER' | 'DATA_COLLECTION';
export type UserIntent = 'ACCEPT' | 'REFUSE' | 'NEUTRAL';

export interface PhaseSimulatorState {
    phase: InterviewPhase;
    shouldCollectData: boolean;
    candidateFieldIds: string[];
    deepAccepted: boolean | null;
    consentGiven: boolean | null;
    dataCollectionRefused?: boolean;
    missingField: string | null;
    remainingSec: number;
}

export type PhaseAction =
    | 'ASK_DEEP_OFFER'
    | 'ASK_TOPIC_QUESTION'
    | 'ASK_DATA_CONSENT'
    | 'ASK_MISSING_FIELD'
    | 'START_DEEP'
    | 'COMPLETE_WITHOUT_DATA'
    | 'COMPLETE_INTERVIEW'
    | 'NO_OP';

export interface PhaseTransitionResult {
    state: PhaseSimulatorState;
    action: PhaseAction;
}

export function onScanCompleted(state: PhaseSimulatorState): PhaseTransitionResult {
    if (state.remainingSec > 0) {
        return {
            state: {
                ...state,
                phase: 'DEEP',
                deepAccepted: null
            },
            action: 'START_DEEP'
        };
    }

    return {
        state: {
            ...state,
            phase: 'DEEP_OFFER',
            deepAccepted: false
        },
        action: 'ASK_DEEP_OFFER'
    };
}

export function onDeepCompleted(state: PhaseSimulatorState): PhaseTransitionResult {
    if (state.shouldCollectData) {
        return {
            state: {
                ...state,
                phase: 'DATA_COLLECTION',
                consentGiven: false
            },
            action: 'ASK_DATA_CONSENT'
        };
    }

    return {
        state: {
            ...state,
            phase: 'DATA_COLLECTION'
        },
        action: 'COMPLETE_WITHOUT_DATA'
    };
}

export function onTopicPhaseClosureAttempt(state: PhaseSimulatorState): PhaseTransitionResult {
    const shouldIntercept = shouldInterceptTopicPhaseClosure({
        phase: state.phase,
        isGoodbyeResponse: true,
        isGoodbyeWithQuestion: false,
        hasNoQuestion: true,
        isPrematureContactRequest: false,
        hasCompletionTag: false
    });

    if (!shouldIntercept) {
        return { state, action: 'NO_OP' };
    }

    const shouldOfferExtraTime = state.phase === 'DEEP' && state.remainingSec <= 0 && state.deepAccepted !== true;
    if (shouldOfferExtraTime) {
        return {
            state: {
                ...state,
                phase: 'DEEP_OFFER',
                deepAccepted: false
            },
            action: 'ASK_DEEP_OFFER'
        };
    }

    return {
        state,
        action: 'ASK_TOPIC_QUESTION'
    };
}

export function onDeepOfferUserIntent(state: PhaseSimulatorState, intent: UserIntent): PhaseTransitionResult {
    if (state.phase !== 'DEEP_OFFER') return { state, action: 'NO_OP' };

    if (intent === 'ACCEPT') {
        return {
            state: {
                ...state,
                phase: 'DEEP',
                deepAccepted: true
            },
            action: 'START_DEEP'
        };
    }

    if (intent === 'REFUSE') {
        if (state.shouldCollectData) {
            return {
                state: {
                    ...state,
                    phase: 'DATA_COLLECTION',
                    consentGiven: false
                },
                action: 'ASK_DATA_CONSENT'
            };
        }

        return {
            state: {
                ...state,
                phase: 'DATA_COLLECTION'
            },
            action: 'COMPLETE_WITHOUT_DATA'
        };
    }

    return {
        state,
        action: 'ASK_DEEP_OFFER'
    };
}

export function onCompletionTag(state: PhaseSimulatorState): PhaseTransitionResult {
    const guardAction = getCompletionGuardAction({
        shouldCollectData: state.shouldCollectData,
        candidateFieldIds: state.candidateFieldIds,
        consentGiven: state.consentGiven,
        dataCollectionRefused: state.dataCollectionRefused,
        missingField: state.missingField
    });

    if (guardAction === 'ask_consent') {
        return {
            state: {
                ...state,
                phase: 'DATA_COLLECTION',
                consentGiven: false
            },
            action: 'ASK_DATA_CONSENT'
        };
    }

    if (guardAction === 'ask_missing_field') {
        return {
            state: {
                ...state,
                phase: 'DATA_COLLECTION'
            },
            action: 'ASK_MISSING_FIELD'
        };
    }

    return {
        state,
        action: state.dataCollectionRefused ? 'COMPLETE_WITHOUT_DATA' : 'COMPLETE_INTERVIEW'
    };
}
