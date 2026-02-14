import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/memory/memory-manager', () => ({
    MemoryManager: {
        get: vi.fn(async () => null),
        formatForPrompt: vi.fn(() => '')
    }
}));

let PromptBuilder: typeof import('@/lib/llm/prompt-builder').PromptBuilder;

function buildBot(language: string) {
    return {
        id: 'bot-1',
        name: 'Test Bot',
        researchGoal: 'Test goal',
        targetAudience: 'Test audience',
        tone: 'Friendly',
        language,
        maxDurationMins: 10,
        collectCandidateData: false,
        topics: [
            {
                id: 't1',
                botId: 'bot-1',
                orderIndex: 0,
                label: 'Contesto',
                description: 'Descrizione topic',
                subGoals: ['Subgoal A', 'Subgoal B'],
                maxTurns: 2,
                keywords: null
            }
        ],
        knowledgeSources: []
    } as any;
}

const baseConversation = {
    id: 'c1',
    currentTopicId: 't1'
} as any;

describe('prompt-builder language handling', () => {
    beforeAll(async () => {
        ({ PromptBuilder } = await import('@/lib/llm/prompt-builder'));
    });

    it('uses italian methodology only for it', () => {
        const itPrompt = PromptBuilder.buildMethodologyPrompt('metodologia', 'it');
        expect(itPrompt).toContain('FLUSSO (COMPATTO)');
        expect(itPrompt).toContain('PRINCIPI OPERATIVI');

        for (const lang of ['en', 'de', 'fr', 'es']) {
            const prompt = PromptBuilder.buildMethodologyPrompt('methodology', lang);
            expect(prompt).toContain('FLOW (COMPACT)');
            expect(prompt).toContain('OPERATING PRINCIPLES');
            expect(prompt).not.toContain('FLUSSO (COMPATTO)');
        }
    });

    it('keeps context and topic prompts language-consistent for selectable languages', () => {
        const topic = buildBot('it').topics[0];

        const itContext = PromptBuilder.buildContextPrompt(baseConversation, buildBot('it'), 120);
        expect(itContext).toContain('CONTESTO TEMPO');

        const itTopic = PromptBuilder.buildTopicPrompt(
            topic,
            [topic],
            { status: 'SCANNING', nextSubGoal: 'Subgoal A' } as any,
            buildBot('it')
        );
        expect(itTopic).toContain('REGOLE BASE');

        for (const lang of ['en', 'de', 'fr', 'es']) {
            const context = PromptBuilder.buildContextPrompt(baseConversation, buildBot(lang), 120);
            expect(context).toContain('TIMING CONTEXT');
            expect(context).not.toContain('CONTESTO TEMPO');

            const topicPrompt = PromptBuilder.buildTopicPrompt(
                topic,
                [topic],
                { status: 'SCANNING', nextSubGoal: 'Subgoal A' } as any,
                buildBot(lang)
            );
            expect(topicPrompt).toContain('BASE RULES');
            expect(topicPrompt).not.toContain('REGOLE BASE');
        }
    });
});
