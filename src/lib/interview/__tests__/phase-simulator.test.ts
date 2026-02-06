import { describe, expect, it } from 'vitest';
import {
    onCompletionTag,
    onDeepCompleted,
    onScanCompleted,
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
    it('starts DEEP when SCAN is completed with remaining time', () => {
        const scanDone = onScanCompleted(baseState({ phase: 'SCAN', remainingSec: 59 }));
        expect(scanDone.action).toBe('START_DEEP');
        expect(scanDone.state.phase).toBe('DEEP');
        expect(scanDone.state.deepAccepted).toBeNull();
    });

    it('asks DEEP_OFFER when SCAN is completed with no remaining time', () => {
        const scanDone = onScanCompleted(baseState({ phase: 'SCAN', remainingSec: 0 }));
        expect(scanDone.action).toBe('ASK_DEEP_OFFER');
        expect(scanDone.state.phase).toBe('DEEP_OFFER');
        expect(scanDone.state.deepAccepted).toBeNull();
    });

    it('moves directly from DEEP completion to DATA_COLLECTION consent', () => {
        const deepDone = onDeepCompleted(baseState({ phase: 'DEEP', remainingSec: 90 }));
        expect(deepDone.action).toBe('ASK_DATA_CONSENT');
        expect(deepDone.state.phase).toBe('DATA_COLLECTION');
        expect(deepDone.state.consentGiven).toBe(false);
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
