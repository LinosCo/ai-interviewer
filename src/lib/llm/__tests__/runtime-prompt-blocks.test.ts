import { describe, expect, it } from 'vitest';
import { buildTurnGuidanceBlock, buildGuardsBlock } from '@/lib/llm/runtime-prompt-blocks';
import { buildRuntimeSemanticContextPrompt } from '@/lib/chat/response-builder';

describe('runtime prompt blocks', () => {
    it('tells the model to follow relevant new directions and otherwise advance', () => {
        const block = buildTurnGuidanceBlock({
            language: 'en',
            phase: 'EXPLORE',
            signalResult: {
                band: 'MEDIUM',
                score: 0.48,
                snippet: 'team lead is overloaded'
            },
            lastUserMessage: 'The real issue is team lead time, not the software itself.',
            recentBridgeStems: ['i see'],
            interviewerQuality: 'avanzato',
            currentTopicLabel: 'Adoption blockers',
            targetTopicLabel: 'Adoption blockers',
            turnDecision: {
                responseValue: 'high',
                deltaType: 'new_direction',
                narrativeState: 'open_thread',
                nextAction: 'follow_up',
                highValue: true,
                rationale: 'advanced_high_value_delta',
            },
            remainingTargetSubGoals: 1,
            remainingStretchSubGoals: 2,
        });

        expect(block).toContain('If the latest message opens a new direction');
        expect(block).toContain('If it does not open a genuinely relevant new direction');
        expect(block).toContain('Chosen action: follow-up');
        expect(block).toContain('essential sub-goals');
    });

    it('keeps clarification guard sensitive to relevant new details', () => {
        const block = buildGuardsBlock({
            userTurnSignal: 'clarification',
            language: 'en'
        });

        expect(block).toContain('new detail that matters for the topic');
    });

    it('tells runtime semantic context not to force follow-ups when no relevant delta exists', () => {
        const block = buildRuntimeSemanticContextPrompt({
            language: 'en',
            phase: 'EXPLORE',
            targetTopicLabel: 'Adoption blockers',
            lastUserMessage: 'At this point it is mostly a resourcing issue.',
            previousAssistantMessage: 'What is currently slowing adoption the most?'
        });

        expect(block).toContain('If the latest answer does NOT open a genuinely relevant new angle');
        expect(block).toContain('use historical context only to sharpen the question');
    });
});
