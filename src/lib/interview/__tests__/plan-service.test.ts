import { describe, expect, it } from 'vitest';
import { buildBaseInterviewPlan } from '@/lib/interview/plan-service';

describe('plan-service', () => {
    it('embeds a budget signature that changes when tier budgets change', () => {
        const bot = { maxDurationMins: 3 } as any;
        const topics = [{ id: 't1', orderIndex: 0, label: 'Topic', maxTurns: null, subGoals: [] }] as any;

        const standardPlan = buildBaseInterviewPlan(bot, topics, {
            planBaseTurnsDivisor: 45,
            planBaseTurnsMin: 2,
            planMaxTurnsBonus: 2,
            deepenFallbackTurns: 2,
            deepenMaxTurnsPerTopic: 2,
        });
        const advancedPlan = buildBaseInterviewPlan(bot, topics, {
            planBaseTurnsDivisor: 35,
            planBaseTurnsMin: 3,
            planMaxTurnsBonus: 3,
            deepenFallbackTurns: 3,
            deepenMaxTurnsPerTopic: 3,
        });

        expect(standardPlan.meta.budgetSignature).not.toBe(advancedPlan.meta.budgetSignature);
    });

    it('shrinks per-topic max turns for very short interviews with many topics', () => {
        const bot = { maxDurationMins: 3 } as any;
        const topics = Array.from({ length: 5 }, (_, idx) => ({
            id: `t${idx + 1}`,
            orderIndex: idx,
            label: `Topic ${idx + 1}`,
            maxTurns: 4,
            subGoals: []
        })) as any;

        const plan = buildBaseInterviewPlan(bot, topics, {
            planBaseTurnsDivisor: 45,
            planBaseTurnsMin: 2,
            planMaxTurnsBonus: 2,
            deepenFallbackTurns: 2,
            deepenMaxTurnsPerTopic: 2,
        });

        expect(plan.explore.topics.every((topic) => topic.maxTurns === 1)).toBe(true);
    });

    it('keeps editorial topic order even when grading changes importance', () => {
        const bot = {
            maxDurationMins: 8,
            researchGoal: 'Understand AI adoption blockers and operational constraints',
            targetAudience: 'SMB owners',
            introMessage: 'Welcome',
            interviewerQuality: 'avanzato'
        } as any;
        const topics = [
            {
                id: 't1',
                orderIndex: 0,
                label: 'Introduzione',
                description: 'Background',
                maxTurns: 2,
                subGoals: ['Role', 'Company size']
            },
            {
                id: 't2',
                orderIndex: 1,
                label: 'Blocchi adozione AI',
                description: 'Main research focus',
                maxTurns: 4,
                subGoals: ['Operational blockers', 'Decision process', 'Budget constraints']
            },
        ] as any;

        const plan = buildBaseInterviewPlan(bot, topics, {
            planBaseTurnsDivisor: 45,
            planBaseTurnsMin: 2,
            planMaxTurnsBonus: 2,
            deepenFallbackTurns: 2,
            deepenMaxTurnsPerTopic: 2,
        });

        expect(plan.explore.topics.map((topic) => topic.topicId)).toEqual(['t1', 't2']);
        expect(plan.explore.topics.map((topic) => topic.editorialOrderIndex)).toEqual([0, 1]);
    });

    it('computes coverage tiers and likely exclusions for constrained durations', () => {
        const bot = {
            maxDurationMins: 3,
            researchGoal: 'Understand adoption blockers and implementation priorities',
            targetAudience: 'Operations managers',
            introMessage: 'Hello'
        } as any;
        const topics = [
            {
                id: 't1',
                orderIndex: 0,
                label: 'Current process',
                description: 'How the process works today',
                maxTurns: 4,
                subGoals: ['Tools used', 'Manual steps', 'Pain points']
            },
            {
                id: 't2',
                orderIndex: 1,
                label: 'AI priorities',
                description: 'Where AI could help most',
                maxTurns: 4,
                subGoals: ['Top use case', 'Expected impact', 'Main risks']
            },
        ] as any;

        const plan = buildBaseInterviewPlan(bot, topics, {
            planBaseTurnsDivisor: 45,
            planBaseTurnsMin: 2,
            planMaxTurnsBonus: 2,
            deepenFallbackTurns: 2,
            deepenMaxTurnsPerTopic: 2,
        });

        expect(plan.coverage.targetDurationSec).toBe(180);
        expect(plan.coverage.fullCoverageDurationSec).toBeGreaterThan(plan.coverage.targetDurationSec);
        expect(plan.coverage.likelyExcludedWithoutDeepOffer.length).toBeGreaterThan(0);
        expect(
            plan.explore.topics.some((topic) =>
                topic.subGoalPlans.some((subGoal) => subGoal.coverageTier === 'overflow')
            )
        ).toBe(true);
    });
});
