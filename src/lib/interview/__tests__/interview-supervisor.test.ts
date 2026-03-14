import { describe, expect, it } from 'vitest';
import {
    runDeepOfferPhase,
    type DeepOfferPhaseDeps,
    type InterviewStateLike,
} from '@/lib/interview/interview-supervisor';

function makeState(overrides: Partial<InterviewStateLike> = {}): InterviewStateLike {
    return {
        phase: 'DEEP_OFFER',
        topicIndex: 0,
        turnInTopic: 0,
        deepAccepted: false,
        consentGiven: null,
        dataCollectionAttempts: 0,
        extensionReturnPhase: 'DEEPEN',
        extensionReturnTopicIndex: 1,
        extensionReturnTurnInTopic: 2,
        extensionOfferAttempts: 0,
        deepTopicOrder: ['topic-1', 'topic-2'],
        deepTurnsByTopic: { 'topic-1': 1, 'topic-2': 2 },
        uncoveredTopics: ['topic-1', 'topic-2'],
        topicSubGoalHistory: {},
        interestingTopics: [
            {
                topicId: 'topic-2',
                bestSnippet: 'Ha bisogno di esempi molto concreti.',
            },
        ],
        forceConsentQuestion: false,
        ...overrides,
    };
}

function makeDeps(intent: 'ACCEPT' | 'REFUSE' | 'NEUTRAL'): DeepOfferPhaseDeps {
    return {
        checkUserIntent: async () => intent,
        isExtensionOfferQuestion: async (message: string) => /continuare|continue|few more minutes/i.test(message),
        buildDeepOfferInsight: () => ({ status: 'DEEP_OFFER_ASK', extensionPreview: ['use case concreti'] }),
        buildDeepPlan: () => ({
            deepTopicOrder: ['topic-1', 'topic-2'],
            deepTurnsByTopic: { 'topic-1': 1, 'topic-2': 2 },
        }),
        getDeepTopics: (deepOrder?: string[]) =>
            (deepOrder || []).map((id) => ({
                id,
                label: id === 'topic-2' ? 'Aspettative TEDx' : 'Percezione AI',
                subGoals: id === 'topic-2' ? ['casi d uso reali'] : ['adozione'],
            })),
        getRemainingSubGoals: (topic: { subGoals?: string[] }) => topic.subGoals || [],
        selectDeepFocusPoint: ({ availableSubGoals }) => availableSubGoals[0] || 'follow-up',
    };
}

const canonicalMessages = [
    { role: 'assistant', content: 'Ti va di continuare ancora per qualche minuto?' },
];

describe('runDeepOfferPhase', () => {
    it('resumes DEEPEN from the saved return position when the user accepts', async () => {
        const state = makeState();
        const nextState = { ...state };

        const result = await runDeepOfferPhase({
            state,
            nextState,
            botTopics: [
                { id: 'topic-1', label: 'Percezione AI', subGoals: ['adozione'] },
                { id: 'topic-2', label: 'Aspettative TEDx', subGoals: ['casi d uso reali'] },
            ],
            canonicalMessages,
            lastUserMessage: 'sì, possiamo continuare',
            shouldCollectData: true,
            maxDurationMins: 3,
            effectiveSec: 190,
            deepExtraTurnCap: 2,
            deps: makeDeps('ACCEPT'),
        });

        expect(result.nextState.phase).toBe('DEEPEN');
        expect(result.nextState.topicIndex).toBe(1);
        expect(result.nextState.turnInTopic).toBe(2);
        expect(result.nextState.deepAccepted).toBe(true);
        expect(result.nextState.extensionOfferAttempts).toBe(0);
        expect(result.supervisorInsight.status).toBe('DEEPENING');
        expect(result.nextTopicId).toBe('topic-2');
    });

    it('maps legacy SCAN return phase back to EXPLORE when the user accepts', async () => {
        const state = makeState({
            extensionReturnPhase: 'SCAN',
            extensionReturnTopicIndex: 0,
            extensionReturnTurnInTopic: 1,
        });
        const nextState = { ...state };

        const result = await runDeepOfferPhase({
            state,
            nextState,
            botTopics: [
                { id: 'topic-1', label: 'Percezione AI', subGoals: ['adozione'] },
                { id: 'topic-2', label: 'Aspettative TEDx', subGoals: ['casi d uso reali'] },
            ],
            canonicalMessages,
            lastUserMessage: 'sì, andiamo avanti',
            shouldCollectData: true,
            maxDurationMins: 3,
            effectiveSec: 185,
            deepExtraTurnCap: 2,
            deps: makeDeps('ACCEPT'),
        });

        expect(result.nextState.phase).toBe('EXPLORE');
        expect(result.nextState.topicIndex).toBe(0);
        expect(result.nextState.turnInTopic).toBe(1);
        expect(result.supervisorInsight.status).toBe('EXPLORING');
        expect(result.nextTopicId).toBe('topic-1');
    });

    it('moves to data consent when the user refuses the extension', async () => {
        const state = makeState();
        const nextState = { ...state };

        const result = await runDeepOfferPhase({
            state,
            nextState,
            botTopics: [
                { id: 'topic-1', label: 'Percezione AI', subGoals: ['adozione'] },
            ],
            canonicalMessages,
            lastUserMessage: 'no, meglio chiudere',
            shouldCollectData: true,
            maxDurationMins: 3,
            effectiveSec: 195,
            deepExtraTurnCap: 2,
            deps: makeDeps('REFUSE'),
        });

        expect(result.nextState.phase).toBe('DATA_COLLECTION');
        expect(result.nextState.consentGiven).toBe(false);
        expect(result.nextState.forceConsentQuestion).toBe(true);
        expect(result.supervisorInsight.status).toBe('DATA_COLLECTION_CONSENT');
    });

    it('moves on after repeated neutral answers to the extension offer', async () => {
        const state = makeState({ extensionOfferAttempts: 2 });
        const nextState = { ...state };

        const result = await runDeepOfferPhase({
            state,
            nextState,
            botTopics: [
                { id: 'topic-1', label: 'Percezione AI', subGoals: ['adozione'] },
            ],
            canonicalMessages,
            lastUserMessage: 'non saprei',
            shouldCollectData: false,
            maxDurationMins: 3,
            effectiveSec: 200,
            deepExtraTurnCap: 2,
            deps: makeDeps('NEUTRAL'),
        });

        expect(result.nextState.phase).toBe('DATA_COLLECTION');
        expect(result.supervisorInsight.status).toBe('COMPLETE_WITHOUT_DATA');
    });

    it('re-asks the offer if the previous assistant turn drifted away from a real extension prompt', async () => {
        const state = makeState({ extensionOfferAttempts: 0 });
        const nextState = { ...state };

        const result = await runDeepOfferPhase({
            state,
            nextState,
            botTopics: [
                { id: 'topic-1', label: 'Percezione AI', subGoals: ['adozione'] },
            ],
            canonicalMessages: [
                { role: 'assistant', content: 'Puoi raccontarmi un esempio concreto?' },
            ],
            lastUserMessage: 'sì',
            shouldCollectData: true,
            maxDurationMins: 3,
            effectiveSec: 205,
            deepExtraTurnCap: 2,
            deps: makeDeps('ACCEPT'),
        });

        expect(result.nextState.phase).toBe('DEEP_OFFER');
        expect(result.nextState.deepAccepted).toBe(false);
        expect(result.nextState.extensionOfferAttempts).toBe(1);
        expect(result.supervisorInsight.status).toBe('DEEP_OFFER_ASK');
    });
});
