import { describe, expect, it } from 'vitest';
import {
    getCompletionGuardAction,
    shouldInterceptDeepOfferClosure,
    shouldInterceptTopicPhaseClosure,
    shouldOfferContinuationAfterDeep
} from '@/lib/interview/phase-flow';

describe('phase-flow', () => {
    describe('shouldOfferContinuationAfterDeep', () => {
        it('offers continuation when DEEP ended before hard time and no prior explicit accept', () => {
            expect(shouldOfferContinuationAfterDeep({ remainingSec: 120, deepAccepted: null })).toBe(true);
            expect(shouldOfferContinuationAfterDeep({ remainingSec: 120, deepAccepted: false })).toBe(true);
        });

        it('does not offer continuation when no time remains or continuation already accepted', () => {
            expect(shouldOfferContinuationAfterDeep({ remainingSec: 0, deepAccepted: null })).toBe(false);
            expect(shouldOfferContinuationAfterDeep({ remainingSec: 45, deepAccepted: true })).toBe(false);
        });
    });

    describe('shouldInterceptTopicPhaseClosure', () => {
        it('blocks premature completion/closure in SCAN or DEEP', () => {
            expect(shouldInterceptTopicPhaseClosure({
                phase: 'DEEP',
                isGoodbyeResponse: false,
                isGoodbyeWithQuestion: false,
                hasNoQuestion: false,
                isPrematureContactRequest: false,
                hasCompletionTag: true
            })).toBe(true);

            expect(shouldInterceptTopicPhaseClosure({
                phase: 'SCAN',
                isGoodbyeResponse: false,
                isGoodbyeWithQuestion: false,
                hasNoQuestion: false,
                isPrematureContactRequest: true,
                hasCompletionTag: false
            })).toBe(true);
        });

        it('does not block normal topic questions', () => {
            expect(shouldInterceptTopicPhaseClosure({
                phase: 'DEEP',
                isGoodbyeResponse: false,
                isGoodbyeWithQuestion: false,
                hasNoQuestion: false,
                isPrematureContactRequest: false,
                hasCompletionTag: false
            })).toBe(false);
        });
    });

    describe('shouldInterceptDeepOfferClosure', () => {
        it('forces DEEP_OFFER to remain an explicit yes/no continuation prompt', () => {
            expect(shouldInterceptDeepOfferClosure({
                phase: 'DEEP_OFFER',
                isGoodbyeResponse: false,
                isGoodbyeWithQuestion: false,
                hasNoQuestion: true,
                hasCompletionTag: false
            })).toBe(true);

            expect(shouldInterceptDeepOfferClosure({
                phase: 'DEEP_OFFER',
                isGoodbyeResponse: false,
                isGoodbyeWithQuestion: false,
                hasNoQuestion: false,
                hasCompletionTag: true
            })).toBe(true);
        });
    });

    describe('getCompletionGuardAction', () => {
        it('asks consent before allowing completion when contact collection is still unresolved', () => {
            const action = getCompletionGuardAction({
                shouldCollectData: true,
                candidateFieldIds: ['email', 'phone'],
                consentGiven: false,
                dataCollectionRefused: false,
                missingField: null
            });
            expect(action).toBe('ask_consent');
        });

        it('asks the specific missing field after consent', () => {
            const action = getCompletionGuardAction({
                shouldCollectData: true,
                candidateFieldIds: ['email', 'phone'],
                consentGiven: true,
                dataCollectionRefused: false,
                missingField: 'email'
            });
            expect(action).toBe('ask_missing_field');
        });

        it('allows completion when collection is done or legitimately skipped', () => {
            expect(getCompletionGuardAction({
                shouldCollectData: true,
                candidateFieldIds: ['email'],
                consentGiven: true,
                dataCollectionRefused: false,
                missingField: null
            })).toBe('allow_completion');

            expect(getCompletionGuardAction({
                shouldCollectData: true,
                candidateFieldIds: ['email'],
                consentGiven: false,
                dataCollectionRefused: true,
                missingField: 'email'
            })).toBe('allow_completion');
        });
    });
});
