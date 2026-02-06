import { describe, expect, it } from 'vitest';
import {
    onCompletionTag,
    onDeepCompleted,
    onDeepOfferUserIntent,
    onTopicPhaseClosureAttempt,
    type PhaseSimulatorState
} from '@/lib/interview/phase-simulator';

function baseState(overrides: Partial<PhaseSimulatorState> = {}): PhaseSimulatorState {
    return {
        phase: 'DEEP',
        shouldCollectData: true,
        candidateFieldIds: ['fullName', 'email'],
        deepAccepted: null,
        consentGiven: null,
        dataCollectionRefused: false,
        missingField: 'email',
        remainingSec: 120,
        ...overrides
    };
}

describe('phase-simulator integration-like sequences', () => {
    it('follows DEEP -> DEEP_OFFER -> DATA_COLLECTION consent when user declines continuation', () => {
        const deepDone = onDeepCompleted(baseState({ phase: 'DEEP', remainingSec: 90 }));
        expect(deepDone.action).toBe('ASK_DEEP_OFFER');
        expect(deepDone.state.phase).toBe('DEEP_OFFER');

        const offerDeclined = onDeepOfferUserIntent(deepDone.state, 'REFUSE');
        expect(offerDeclined.action).toBe('ASK_DATA_CONSENT');
        expect(offerDeclined.state.phase).toBe('DATA_COLLECTION');
        expect(offerDeclined.state.consentGiven).toBe(false);
    });

    it('intercepts premature closure attempt in DEEP and keeps topic questioning', () => {
        const closure = onTopicPhaseClosureAttempt(baseState({ phase: 'DEEP', remainingSec: 150 }));
        expect(closure.action).toBe('ASK_TOPIC_QUESTION');
        expect(closure.state.phase).toBe('DEEP');
    });

    it('switches to DEEP_OFFER when closure attempt happens with no remaining time', () => {
        const closure = onTopicPhaseClosureAttempt(baseState({ phase: 'DEEP', remainingSec: 0 }));
        expect(closure.action).toBe('ASK_DEEP_OFFER');
        expect(closure.state.phase).toBe('DEEP_OFFER');
    });

    it('blocks INTERVIEW_COMPLETED before contact consent', () => {
        const completion = onCompletionTag(baseState({
            phase: 'DATA_COLLECTION',
            consentGiven: false,
            missingField: null
        }));
        expect(completion.action).toBe('ASK_DATA_CONSENT');
        expect(completion.state.phase).toBe('DATA_COLLECTION');
    });

    it('blocks INTERVIEW_COMPLETED when a field is still missing after consent', () => {
        const completion = onCompletionTag(baseState({
            phase: 'DATA_COLLECTION',
            consentGiven: true,
            missingField: 'email'
        }));
        expect(completion.action).toBe('ASK_MISSING_FIELD');
        expect(completion.state.phase).toBe('DATA_COLLECTION');
    });

    it('allows completion only when consent is resolved and no fields are missing', () => {
        const completion = onCompletionTag(baseState({
            phase: 'DATA_COLLECTION',
            consentGiven: true,
            missingField: null
        }));
        expect(completion.action).toBe('COMPLETE_INTERVIEW');
    });
});
