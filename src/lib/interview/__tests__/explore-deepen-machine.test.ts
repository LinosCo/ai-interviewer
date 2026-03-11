import { describe, expect, it } from 'vitest';

import { handleExplorePhase } from '@/lib/interview/explore-deepen-machine';
import type { InterviewState } from '@/app/api/chat/route';
import type { InterviewPlan } from '@/lib/interview/plan-types';

function makeState(overrides: Partial<InterviewState> = {}): InterviewState {
    return {
        phase: 'EXPLORE',
        topicIndex: 0,
        turnInTopic: 0,
        deepAccepted: null,
        consentGiven: null,
        lastAskedField: null,
        dataCollectionAttempts: 0,
        fieldAttemptCounts: {},
        closureAttempts: 0,
        interestingTopics: [],
        topicBudgets: {
            topicA: { baseTurns: 2, minTurns: 1, maxTurns: 3, turnsUsed: 0, bonusTurnsGranted: 0 },
            topicB: { baseTurns: 2, minTurns: 1, maxTurns: 3, turnsUsed: 0, bonusTurnsGranted: 0 },
        },
        turnsUsedTotal: 0,
        turnsBudgetTotal: 4,
        uncoveredTopics: [],
        topicEngagementScores: {},
        topicKeyInsights: {},
        lastSignalScore: 0,
        ...overrides,
    };
}

const botTopics = [
    { id: 'topicA', label: 'Topic A', orderIndex: 0, maxTurns: 3, subGoals: [] },
    { id: 'topicB', label: 'Topic B', orderIndex: 1, maxTurns: 3, subGoals: [] },
] as any;

const interviewPlan: InterviewPlan = {
    version: 1,
    meta: {
        generatedAt: new Date().toISOString(),
        planLogicVersion: 'test',
        maxDurationMins: 3,
        totalTimeSec: 180,
        perTopicTimeSec: 90,
        secondsPerTurn: 45,
        topicsSignature: 'test',
    },
    explore: {
        topics: [
            { topicId: 'topicA', label: 'Topic A', orderIndex: 0, subGoals: [], baseTurns: 2, minTurns: 1, maxTurns: 3, interpretationCues: [], significanceSignals: [], probeAngles: [] },
            { topicId: 'topicB', label: 'Topic B', orderIndex: 1, subGoals: [], baseTurns: 2, minTurns: 1, maxTurns: 3, interpretationCues: [], significanceSignals: [], probeAngles: [] },
        ],
    },
    deepen: {
        maxTurnsPerTopic: 1,
        fallbackTurns: 1,
    },
};

describe('handleExplorePhase standard coverage', () => {
    it('advances after the first usable answer when standard mode prefers coverage', () => {
        const state = makeState();
        const result = handleExplorePhase({
            state,
            currentTopic: botTopics[0],
            botTopics,
            lastUserMessage: 'Usiamo un foglio condiviso una volta a settimana per seguire le richieste.',
            language: 'it',
            interviewPlan,
            maxDurationMins: 3,
            effectiveSec: 60,
            bonusTurnCap: 0,
            advanceAfterUsableFirstAnswer: true,
        });

        expect(result.nextState.topicIndex).toBe(1);
        expect(result.supervisorInsight.status).toBe('TRANSITION');
        expect(result.supervisorInsight.transitionMode).toBe('bridge');
    });

    it('keeps one extra follow-up available on the first answer when the signal is high', () => {
        const state = makeState();
        const result = handleExplorePhase({
            state,
            currentTopic: botTopics[0],
            botTopics,
            lastUserMessage: 'Nel nostro caso il problema principale e davvero critico: il processo cambia per cliente, coinvolge tre reparti, rallenta i tempi di risposta, ci crea errori ogni settimana e ha gia causato due reclami importanti con costi extra.',
            language: 'it',
            interviewPlan,
            maxDurationMins: 3,
            effectiveSec: 60,
            bonusTurnCap: 0,
            advanceAfterUsableFirstAnswer: true,
        });

        expect(result.nextState.topicIndex).toBe(0);
        expect(result.supervisorInsight.status).toBe('EXPLORING');
        expect(result.nextState.topicBudgets?.topicA?.turnsUsed).toBe(1);
    });
});
