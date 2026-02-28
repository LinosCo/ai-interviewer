import { describe, expect, it } from 'vitest';
import {
    buildMicroPlannerDecision,
    buildMicroPlannerPromptBlock
} from '@/lib/interview/micro-planner';

describe('micro-planner', () => {
    it('prioritizes sub-goal coverage when scan turns are tight', () => {
        const decision = buildMicroPlannerDecision({
            language: 'it',
            phase: 'EXPLORE',
            topicId: 'topic-1',
            topicLabel: 'Contesto aziendale',
            topicSubGoals: ['Settore', 'Mercato', 'Dimensioni'],
            usedSubGoals: ['Settore', 'Mercato'],
            turnInTopic: 2,
            maxTurnsInTopic: 2,
            userMessage: 'siamo una piccola azienda della provincia',
            userTurnSignal: 'none',
            manualGuide: null,
            runtimeKnowledge: null
        });

        expect(decision.mode).toBe('cover_subgoal');
        expect(decision.topicCoverage.prioritizeCoverage).toBe(true);
        expect(decision.focusSubGoal).toBe('Dimensioni');
    });

    it('uses manual knowledge cues when available', () => {
        const manualGuide = `
# Interview Knowledge
## Topic 1 - Contesto aziendale
Cosa capire:
- Come viene gestito oggi il monitoraggio del mercato.
Segnali da approfondire:
- Riferimenti a tempi di risposta e opportunita perse.
Follow-up suggeriti:
- "Puoi raccontarmi un caso recente?"
## Topic 2 - Utilizzo AI
...`;

        const decision = buildMicroPlannerDecision({
            language: 'it',
            phase: 'DEEPEN',
            topicId: 'topic-1',
            topicLabel: 'Contesto aziendale',
            topicSubGoals: ['Mercato'],
            usedSubGoals: [],
            turnInTopic: 1,
            maxTurnsInTopic: 2,
            userMessage: 'abbiamo perso alcuni clienti per tempi di risposta troppo lenti',
            userTurnSignal: 'none',
            manualGuide,
            runtimeKnowledge: null
        });

        expect(decision.knowledgeSource).toBe('manual');
        expect(decision.followupHint.length).toBeGreaterThan(10);
    });

    it('builds a compact planner prompt block for topic phases', () => {
        const decision = buildMicroPlannerDecision({
            language: 'en',
            phase: 'EXPLORE',
            topicId: 'topic-2',
            topicLabel: 'AI usage',
            topicSubGoals: ['Expectations'],
            usedSubGoals: [],
            turnInTopic: 0,
            maxTurnsInTopic: 2,
            userMessage: 'We need faster and more targeted responses to clients.',
            userTurnSignal: 'none',
            manualGuide: null,
            runtimeKnowledge: null
        });

        const block = buildMicroPlannerPromptBlock({
            language: 'en',
            phase: 'EXPLORE',
            topicLabel: 'AI usage',
            decision
        });

        expect(block).toContain('MICRO-PLANNER PRE-TURN');
        expect(block).toContain('Active topic: "AI usage"');
        expect(block).toContain('Question strategy');
    });
});
