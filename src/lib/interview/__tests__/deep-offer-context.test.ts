import { describe, expect, it } from 'vitest';
import { buildContextualDeepOfferInsight } from '@/lib/interview/deep-offer-context';
import type { ValidationResponse } from '@/lib/interview/validation-response';

describe('buildContextualDeepOfferInsight', () => {
    it('enriches deep-offer context with high-strength CIL threads', () => {
        const insight = buildContextualDeepOfferInsight({
            state: {
                topicIndex: 1,
                deepTopicOrder: ['topic-1', 'topic-2'],
                topicSubGoalHistory: {
                    'topic-1': ['adozione'],
                },
                interestingTopics: [
                    {
                        topicId: 'topic-1',
                        topicLabel: 'Percezione AI',
                        engagementScore: 0.7,
                        bestSnippet: 'L AI viene percepita come troppo astratta.',
                    },
                ],
                topicKeyInsights: {
                    'topic-1': 'Serve un linguaggio piu concreto verso i manager.',
                },
            },
            botTopics: [
                { id: 'topic-1', label: 'Percezione AI', subGoals: ['adozione'] },
                { id: 'topic-2', label: 'Aspettative TEDx', subGoals: ['esempi concreti per il palco'] },
            ],
            interviewObjective: 'Capire aspettative e adozione dell AI nelle imprese',
            language: 'it',
            includeCilThreads: true,
            cilAnalysis: {
                openThreads: [
                    {
                        sourceTopicId: 'topic-2',
                        strength: 'high',
                        description: 'L utente vuole esempi pratici da portare al TEDx.',
                        anchoredHypothesis: 'Vuole esempi pratici da portare al TEDx.',
                        turnIndex: 12,
                    },
                ],
                emergingThemes: [],
                lastResponseAnalysis: {
                    keySignals: [],
                    emotionalCues: [],
                    interruptedThoughts: [],
                    activeHypotheses: [],
                    contradictionFlags: [],
                },
                suggestedMove: 'follow_thread',
                budgetSignal: null,
            },
        });

        expect(insight.status).toBe('DEEP_OFFER_ASK');
        expect(insight.extensionPreview).toContain('esempi concreti per il palco');
        expect(insight.extensionUserSnippets?.[0]).toContain('Vuole esempi pratici da portare al TEDx');
    });

    it('preserves validation feedback for a rephrased extension offer', () => {
        const validationFeedback: ValidationResponse = {
            isValid: false,
            reason: 'intent_unclear',
            confidence: 'low',
            attemptCount: 1,
            maxAttempts: 2,
            strategy: 'ask_differently',
            feedback: 'Non ho capito se vuoi continuare per qualche minuto.',
        };

        const insight = buildContextualDeepOfferInsight({
            state: {
                topicIndex: 0,
                interestingTopics: [],
            },
            botTopics: [
                { id: 'topic-1', label: 'Uso dell AI', subGoals: ['priorita operative'] },
            ],
            interviewObjective: 'Capire priorita e ostacoli',
            language: 'it',
            validationFeedback,
        });

        expect(insight.validationFeedback?.strategy).toBe('ask_differently');
        expect(insight.feedbackMessage).toContain('Non ho capito');
    });
});
