import { describe, expect, it } from 'vitest';
import {
    buildManualKnowledgePromptBlock,
    buildFallbackRuntimeInterviewKnowledge,
    buildRuntimeInterviewKnowledgeSignature,
    buildRuntimeKnowledgePromptBlock,
    extractManualInterviewGuideSource,
    isRuntimeInterviewKnowledgeValid
} from '@/lib/interview/runtime-knowledge';
import type { InterviewPlan } from '@/lib/interview/plan-types';

const BASE_PLAN: InterviewPlan = {
    version: 1,
    meta: {
        generatedAt: '2026-02-14T00:00:00.000Z',
        planLogicVersion: 'v1',
        budgetSignature: '45:2:2:2:2',
        objectiveSignature: '',
        maxDurationMins: 3,
        totalTimeSec: 180,
        perTopicTimeSec: 60,
        secondsPerTurn: 45,
        topicsSignature: 'topic-a||topic-b',
        interviewerQuality: 'standard',
        gradingSource: 'deterministic'
    },
    coverage: {
        targetDurationSec: 180,
        stretchDurationSec: 216,
        fullCoverageDurationSec: 270,
        target: { coveredTopics: 1, coveredSubGoals: 2, totalTopics: 1, totalSubGoals: 2, coverageRate: 1 },
        stretch: { coveredTopics: 1, coveredSubGoals: 2, totalTopics: 1, totalSubGoals: 2, coverageRate: 1 },
        full: { coveredTopics: 1, coveredSubGoals: 2, totalTopics: 1, totalSubGoals: 2, coverageRate: 1 },
        likelyExcludedWithoutDeepOffer: []
    },
    explore: {
        topics: [
            {
                topicId: 'topic-a',
                label: 'Contesto aziendale',
                orderIndex: 0,
                editorialOrderIndex: 0,
                subGoals: ['Settore', 'Mercato geografico'],
                subGoalPlans: [
                    { id: 'sg-1', label: 'Settore', editorialOrderIndex: 0, importanceScore: 0.8, importanceBand: 'high', coverageTier: 'target', rationale: '', enabled: true },
                    { id: 'sg-2', label: 'Mercato geografico', editorialOrderIndex: 1, importanceScore: 0.7, importanceBand: 'high', coverageTier: 'target', rationale: '', enabled: true }
                ],
                baseTurns: 2,
                minTurns: 2,
                maxTurns: 2,
                importanceScore: 0.8,
                importanceBand: 'high',
                rationale: '',
                enabled: true,
                targetTurns: 2,
                stretchTurns: 2,
                fullCoverageTurns: 2,
                targetSubGoalCount: 2,
                stretchSubGoalCount: 2,
                fullCoverageSubGoalCount: 2,
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

describe('runtime-knowledge', () => {
    it('builds a stable signature from plan and interview context', () => {
        const first = buildRuntimeInterviewKnowledgeSignature({
            language: 'it',
            researchGoal: 'Capire uso AI nel business',
            targetAudience: 'PMI',
            plan: BASE_PLAN
        });
        const second = buildRuntimeInterviewKnowledgeSignature({
            language: 'it',
            researchGoal: 'Capire uso AI nel business',
            targetAudience: 'PMI',
            plan: BASE_PLAN
        });

        expect(first).toBe(second);

        const changed = buildRuntimeInterviewKnowledgeSignature({
            language: 'it',
            researchGoal: 'Obiettivo diverso',
            targetAudience: 'PMI',
            plan: BASE_PLAN
        });
        expect(changed).not.toBe(first);
    });

    it('builds fallback knowledge and marks it as valid for the same signature', () => {
        const signature = buildRuntimeInterviewKnowledgeSignature({
            language: 'it',
            researchGoal: 'Capire uso AI nel business',
            targetAudience: 'PMI',
            plan: BASE_PLAN
        });
        const knowledge = buildFallbackRuntimeInterviewKnowledge({
            signature,
            language: 'it',
            interviewGoal: 'Capire uso AI nel business',
            topics: BASE_PLAN.explore.topics.map((topic) => ({
                topicId: topic.topicId,
                topicLabel: topic.label,
                subGoals: topic.subGoals
            }))
        });

        expect(knowledge.source).toBe('fallback');
        expect(knowledge.topics).toHaveLength(1);
        expect(knowledge.topics[0].interpretationCues.length).toBeGreaterThan(0);
        expect(isRuntimeInterviewKnowledgeValid(knowledge, signature)).toBe(true);
    });

    it('creates prompt block only in EXPLORE/DEEPEN phases', () => {
        const signature = buildRuntimeInterviewKnowledgeSignature({
            language: 'it',
            researchGoal: 'Capire uso AI nel business',
            targetAudience: 'PMI',
            plan: BASE_PLAN
        });
        const knowledge = buildFallbackRuntimeInterviewKnowledge({
            signature,
            language: 'it',
            interviewGoal: 'Capire uso AI nel business',
            topics: BASE_PLAN.explore.topics.map((topic) => ({
                topicId: topic.topicId,
                topicLabel: topic.label,
                subGoals: topic.subGoals
            }))
        });

        const deepBlock = buildRuntimeKnowledgePromptBlock({
            knowledge,
            phase: 'DEEPEN',
            targetTopicId: 'topic-a',
            language: 'it'
        });
        expect(deepBlock).toContain('RUNTIME TOPIC INTELLIGENCE');

        const dataCollectionBlock = buildRuntimeKnowledgePromptBlock({
            knowledge,
            phase: 'DATA_COLLECTION',
            targetTopicId: 'topic-a',
            language: 'it'
        });
        expect(dataCollectionBlock).toBe('');
    });

    it('prefers manual interview guide source and builds topic-focused prompt block', () => {
        const manual = extractManualInterviewGuideSource([
            {
                type: 'TEXT',
                title: 'Guida Intervista Business AI',
                content: 'Nel topic contesto aziendale esplora settore, dinamiche e vincoli operativi. Quando emergono segnali su mercato o clienti, chiedi esempi concreti legati a decisioni recenti.'
            },
            {
                type: 'TEXT',
                title: 'Note generiche',
                content: 'Questo testo non è rilevante.'
            }
        ]);

        expect(manual).toContain('contesto aziendale');

        const block = buildManualKnowledgePromptBlock({
            manualGuide: manual,
            phase: 'EXPLORE',
            language: 'it',
            topicLabel: 'Contesto aziendale',
            topicSubGoals: ['Settore', 'Mercato geografico']
        });
        expect(block).toContain('MANUALE, EDITABILE');
        expect(block).toContain('Contesto aziendale');
    });

    it('produces different signatures for different quality tiers', () => {
        const base = {
            language: 'it',
            researchGoal: 'understand decision-making',
            targetAudience: 'product managers',
            plan: {
                meta: { topicsSignature: 'abc123', maxDurationMins: 30 }
            } as any
        }
        const sigQuantitativo = buildRuntimeInterviewKnowledgeSignature({ ...base, interviewerQuality: 'quantitativo' })
        const sigAvanzato = buildRuntimeInterviewKnowledgeSignature({ ...base, interviewerQuality: 'avanzato' })
        expect(sigQuantitativo).not.toBe(sigAvanzato)
    });
});
