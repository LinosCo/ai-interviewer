import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateObjectMock = vi.fn();

vi.mock('ai', () => ({
    generateObject: (...args: any[]) => generateObjectMock(...args),
}));

vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: () => () => 'mock-model',
}));

import {
    checkUserIntent,
    detectSemanticUserTurnSignal,
    evaluateDataCollectionUserTurn,
    evaluateAssistantTurn,
    evaluateTopicalUserTurn,
    isAssistantClarificationResponse,
    isAssistantExtensionOffer,
    isAssistantRequestingField,
    isAssistantScopeBoundaryResponse,
} from '@/lib/interview/chat-intent';

describe('chat-intent semantic recognizers', () => {
    beforeEach(() => {
        generateObjectMock.mockReset();
    });

    it('skips user-turn signal detection outside topical phases', async () => {
        const result = await detectSemanticUserTurnSignal({
            userMessage: 'Can you clarify that?',
            apiKey: 'test',
            language: 'en',
            phase: 'DATA_COLLECTION',
        });

        expect(result).toBe('none');
        expect(generateObjectMock).not.toHaveBeenCalled();
    });

    it('classifies a clarification turn semantically', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: { signal: 'clarification', reason: 'user asks to explain previous question' },
            usage: {},
        });

        const result = await detectSemanticUserTurnSignal({
            userMessage: 'Can you explain what you mean?',
            apiKey: 'test',
            language: 'en',
            phase: 'EXPLORE',
            currentTopicLabel: 'Adoption',
            targetTopicLabel: 'Adoption',
            interviewObjective: 'Understand barriers',
        });

        expect(result).toBe('clarification');
        expect(generateObjectMock).toHaveBeenCalledTimes(1);
    });

    it('classifies consent intent without lexical fast-paths', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: { intent: 'ACCEPT', reason: 'user agrees to share contact details' },
            usage: {},
        });

        const result = await checkUserIntent('sure, that works', 'test', 'en', 'consent');

        expect(result).toBe('ACCEPT');
    });

    it('recognizes when the assistant is asking for a specific field', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: { targetsField: true, reason: 'assistant is asking for location only' },
            usage: {},
        });

        const result = await isAssistantRequestingField({
            assistantMessage: 'Could you tell me which city you are based in?',
            fieldName: 'location',
            apiKey: 'test',
            language: 'en',
        });

        expect(result).toBe(true);
    });

    it('recognizes extension offers semantically', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: { matches: true, reason: 'assistant offers to continue for a few more minutes' },
            usage: {},
        });

        const result = await isAssistantExtensionOffer({
            assistantMessage: 'If you want, we can continue for a few more minutes. Would that be okay?',
            apiKey: 'test',
            language: 'en',
        });

        expect(result).toBe(true);
    });

    it('recognizes clarification handling semantically', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: { matches: true, reason: 'assistant clarifies first, then continues' },
            usage: {},
        });

        const result = await isAssistantClarificationResponse({
            assistantMessage: 'I meant the last experience you had with the product. With that in mind, what happened?',
            userMessage: 'What do you mean exactly?',
            apiKey: 'test',
            language: 'en',
        });

        expect(result).toBe(true);
    });

    it('recognizes scope boundaries semantically', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: { matches: true, reason: 'assistant politely declines off-topic question and redirects' },
            usage: {},
        });

        const result = await isAssistantScopeBoundaryResponse({
            assistantMessage: 'That is outside the scope of this interview, so let me stay on the product experience. What was the hardest part?',
            userMessage: 'What model are you using?',
            apiKey: 'test',
            language: 'en',
        });

        expect(result).toBe(true);
    });

    it('evaluates multiple assistant guard conditions in a single call', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: {
                isExtensionOffer: false,
                isClarificationResponse: true,
                isScopeBoundaryResponse: false,
                isConsentRequest: false,
                targetsExpectedField: true,
                isClosureResponse: false,
                isVagueDataCollectionRequest: false,
                isContactRequest: false,
                isPromotionalContent: false,
                reason: 'assistant clarifies and asks the expected field'
            },
            usage: {},
        });

        const result = await evaluateAssistantTurn({
            assistantMessage: 'By location I mean the city you are based in. Which city is that?',
            userMessage: 'What do you mean by location?',
            expectedFieldName: 'location',
            apiKey: 'test',
            language: 'en',
        });

        expect(result).toEqual({
            isExtensionOffer: false,
            isClarificationResponse: true,
            isScopeBoundaryResponse: false,
            isConsentRequest: false,
            targetsExpectedField: true,
            isClosureResponse: false,
            isVagueDataCollectionRequest: false,
            isContactRequest: false,
            isPromotionalContent: false,
        });
        expect(generateObjectMock).toHaveBeenCalledTimes(1);
    });

    it('interprets a data-collection user turn in one semantic pass', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: {
                consentIntent: 'NEUTRAL',
                wantsToConclude: false,
                closureConfidence: 'low',
                isFrustrated: false,
                wantsToSkipField: false,
                extractedExpectedFieldValue: 'Milan',
                extractedExpectedFieldConfidence: 'high',
                reason: 'user provided the expected location field'
            },
            usage: {},
        });

        const result = await evaluateDataCollectionUserTurn({
            userMessage: 'I am based in Milan.',
            expectedFieldName: 'location',
            consentRequested: false,
            apiKey: 'test',
            language: 'en',
        });

        expect(result).toEqual({
            consentIntent: 'NEUTRAL',
            wantsToConclude: false,
            closureConfidence: 'low',
            isFrustrated: false,
            wantsToSkipField: false,
            extractedExpectedFieldValue: 'Milan',
            extractedExpectedFieldConfidence: 'high',
        });
        expect(generateObjectMock).toHaveBeenCalledTimes(1);
    });

    it('interprets closure and clarification in one topical user-turn pass', async () => {
        generateObjectMock.mockResolvedValueOnce({
            object: {
                wantsToConclude: false,
                closureConfidence: 'low',
                closureReason: 'user is not stopping',
                signal: 'clarification',
                responseValue: 'medium',
                deltaType: 'refinement',
                narrativeState: 'open_thread',
                reason: 'user asks to clarify the previous question'
            },
            usage: {},
        });

        const result = await evaluateTopicalUserTurn({
            userMessage: 'What do you mean exactly by activation?',
            apiKey: 'test',
            language: 'en',
            phase: 'EXPLORE',
            currentTopicLabel: 'Activation',
            targetTopicLabel: 'Activation',
            interviewObjective: 'Understand onboarding friction',
        });

        expect(result).toEqual({
            wantsToConclude: false,
            closureConfidence: 'low',
            closureReason: 'user is not stopping',
            signal: 'clarification',
            responseValue: 'medium',
            deltaType: 'refinement',
            narrativeState: 'open_thread',
        });
        expect(generateObjectMock).toHaveBeenCalledTimes(1);
    });
});
