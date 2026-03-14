import { describe, expect, it } from 'vitest';
import { buildTopicTurnDecision } from '@/lib/interview/turn-decision';

describe('turn-decision', () => {
    it('keeps standard interviews on-topic while target coverage is still pending', () => {
        const decision = buildTopicTurnDecision({
            phase: 'EXPLORE',
            interviewerQuality: 'standard',
            interpretation: {
                wantsToConclude: false,
                closureConfidence: 'low',
                closureReason: 'continue',
                signal: 'none',
                responseValue: 'medium',
                deltaType: 'refinement',
                narrativeState: 'answered_thread',
            },
            signalScore: 0.32,
            remainingTargetSubGoals: 2,
            remainingStretchSubGoals: 3,
            turnInTopic: 0,
            maxTurnsInTopic: 2,
        });

        expect(decision.nextAction).toBe('continue');
        expect(decision.rationale).toBe('target_coverage_pending');
    });

    it('lets standard interviews transition once target coverage is complete and value is low', () => {
        const decision = buildTopicTurnDecision({
            phase: 'EXPLORE',
            interviewerQuality: 'standard',
            interpretation: {
                wantsToConclude: false,
                closureConfidence: 'low',
                closureReason: 'continue',
                signal: 'none',
                responseValue: 'low',
                deltaType: 'none',
                narrativeState: 'transition_ready',
            },
            signalScore: 0.1,
            remainingTargetSubGoals: 0,
            remainingStretchSubGoals: 0,
            turnInTopic: 1,
            maxTurnsInTopic: 2,
        });

        expect(decision.nextAction).toBe('transition');
        expect(decision.highValue).toBe(false);
    });

    it('lets advanced interviews follow up on a high-value new direction', () => {
        const decision = buildTopicTurnDecision({
            phase: 'EXPLORE',
            interviewerQuality: 'avanzato',
            interpretation: {
                wantsToConclude: false,
                closureConfidence: 'low',
                closureReason: 'continue',
                signal: 'none',
                responseValue: 'high',
                deltaType: 'new_direction',
                narrativeState: 'open_thread',
            },
            signalScore: 0.68,
            remainingTargetSubGoals: 0,
            remainingStretchSubGoals: 2,
            turnInTopic: 1,
            maxTurnsInTopic: 3,
        });

        expect(decision.nextAction).toBe('follow_up');
        expect(decision.rationale).toBe('advanced_high_value_delta');
    });

    it('moves DEEPEN forward when the thread is weak and transition-ready', () => {
        const decision = buildTopicTurnDecision({
            phase: 'DEEPEN',
            interviewerQuality: 'avanzato',
            interpretation: {
                wantsToConclude: false,
                closureConfidence: 'low',
                closureReason: 'continue',
                signal: 'none',
                responseValue: 'low',
                deltaType: 'none',
                narrativeState: 'transition_ready',
            },
            signalScore: 0.08,
            remainingTargetSubGoals: 0,
            remainingStretchSubGoals: 1,
            turnInTopic: 1,
            maxTurnsInTopic: 2,
        });

        expect(decision.nextAction).toBe('transition');
        expect(decision.rationale).toBe('deepen_transition_ready');
    });
});
