import { describe, expect, it } from 'vitest';
import { handleDeepenPhase, handleExplorePhase } from '@/lib/interview/explore-deepen-machine';
import type { InterviewPlan } from '@/lib/interview/plan-types';

const PLAN: InterviewPlan = {
    version: 1,
    meta: {
        generatedAt: '2026-03-12T00:00:00.000Z',
        planLogicVersion: '2.0',
        budgetSignature: '45:2:2:2:2',
        objectiveSignature: '',
        maxDurationMins: 10,
        totalTimeSec: 600,
        perTopicTimeSec: 300,
        secondsPerTurn: 45,
        topicsSignature: 'topic-1',
        interviewerQuality: 'standard',
        gradingSource: 'deterministic'
    },
    coverage: {
        targetDurationSec: 600,
        stretchDurationSec: 720,
        fullCoverageDurationSec: 900,
        target: { coveredTopics: 1, coveredSubGoals: 1, totalTopics: 1, totalSubGoals: 1, coverageRate: 1 },
        stretch: { coveredTopics: 1, coveredSubGoals: 1, totalTopics: 1, totalSubGoals: 1, coverageRate: 1 },
        full: { coveredTopics: 1, coveredSubGoals: 1, totalTopics: 1, totalSubGoals: 1, coverageRate: 1 },
        likelyExcludedWithoutDeepOffer: []
    },
    explore: {
        topics: [
            {
                topicId: 'topic-1',
                label: 'Contesto',
                orderIndex: 0,
                editorialOrderIndex: 0,
                subGoals: ['Settore'],
                subGoalPlans: [
                    {
                        id: 'sg-1',
                        label: 'Settore',
                        editorialOrderIndex: 0,
                        importanceScore: 0.8,
                        importanceBand: 'high',
                        coverageTier: 'target',
                        rationale: '',
                        enabled: true
                    }
                ],
                baseTurns: 2,
                minTurns: 1,
                maxTurns: 4,
                importanceScore: 0.8,
                importanceBand: 'high',
                rationale: '',
                enabled: true,
                targetTurns: 2,
                stretchTurns: 3,
                fullCoverageTurns: 4,
                targetSubGoalCount: 1,
                stretchSubGoalCount: 1,
                fullCoverageSubGoalCount: 1,
                interpretationCues: [],
                significanceSignals: [],
                probeAngles: []
            }
        ]
    },
    deepen: {
        maxTurnsPerTopic: 2,
        fallbackTurns: 2
    }
};

describe('explore-deepen-machine', () => {
    it('increments turnInTopic when EXPLORE continues on the same topic', () => {
        const result = handleExplorePhase({
            state: {
                phase: 'EXPLORE',
                topicIndex: 0,
                turnInTopic: 0,
                topicBudgets: {
                    'topic-1': {
                        baseTurns: 2,
                        minTurns: 1,
                        maxTurns: 4,
                        turnsUsed: 0,
                        bonusTurnsGranted: 0
                    }
                },
                turnsUsedTotal: 0,
                topicEngagementScores: {},
                topicKeyInsights: {},
                uncoveredTopics: [],
            } as any,
            currentTopic: {
                id: 'topic-1',
                label: 'Contesto',
                orderIndex: 0,
                subGoals: ['Settore']
            } as any,
            botTopics: [{
                id: 'topic-1',
                label: 'Contesto',
                orderIndex: 0,
                subGoals: ['Settore']
            }] as any,
            lastUserMessage: 'Siamo una piccola azienda familiare.',
            language: 'it',
            interviewPlan: PLAN,
            maxDurationMins: 10,
            effectiveSec: 30,
            bonusTurnCap: 2
        });

        expect(result.nextState.turnInTopic).toBe(1);
        expect(result.nextState.turnsUsedTotal).toBe(1);
    });

    it('uses turnDecision to advance DEEPEN when the thread is exhausted', () => {
        const result = handleDeepenPhase({
            state: {
                phase: 'DEEPEN',
                topicIndex: 0,
                turnInTopic: 0,
                deepAccepted: false,
                topicBudgets: {
                    'topic-1': {
                        baseTurns: 2,
                        minTurns: 1,
                        maxTurns: 3,
                        turnsUsed: 2,
                        bonusTurnsGranted: 0,
                    }
                },
                uncoveredTopics: ['topic-1'],
                topicKeyInsights: {},
                topicSubGoalHistory: { 'topic-1': ['Settore'] },
            } as any,
            currentTopic: {
                id: 'topic-1',
                label: 'Contesto',
                orderIndex: 0,
                subGoals: ['Settore']
            } as any,
            botTopics: [{
                id: 'topic-1',
                label: 'Contesto',
                orderIndex: 0,
                subGoals: ['Settore']
            }] as any,
            language: 'it',
            maxDurationMins: 10,
            effectiveSec: 120,
            deepenMaxTurnsPerTopic: 2,
            deepExtraTurnCap: 2,
            interviewPlan: PLAN,
            topicSubGoalHistory: { 'topic-1': ['Settore'] },
            interviewerQuality: 'standard',
            turnDecision: {
                responseValue: 'low',
                deltaType: 'none',
                narrativeState: 'transition_ready',
                nextAction: 'transition',
                highValue: false,
                rationale: 'deepen_transition_ready'
            }
        });

        expect(result.nextState.phase).toBe('DATA_COLLECTION');
        expect(result.supervisorInsight.status).toBe('DATA_COLLECTION');
    });
});
