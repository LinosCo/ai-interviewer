import { describe, expect, it } from 'vitest';
import { evaluateInterviewQuestionQuality } from '@/lib/interview/qualitative-evaluator';

describe('qualitative-evaluator', () => {
    it('passes a good deep probing question grounded in user response', () => {
        const result = evaluateInterviewQuestionQuality({
            phase: 'DEEP',
            topicLabel: 'Comunicazione interna',
            userResponse: 'Abbiamo avuto problemi di comunicazione tra team e nuovi assunti nelle prime settimane.',
            assistantResponse: 'Hai menzionato difficoltà di comunicazione nelle prime settimane: puoi raccontarmi un episodio concreto?',
            previousAssistantResponse: 'Qual è stata la sfida principale in onboarding?',
            language: 'it'
        });

        expect(result.passed).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('fails when it closes early during a topic phase', () => {
        const result = evaluateInterviewQuestionQuality({
            phase: 'SCAN',
            topicLabel: 'Esperienza evento',
            userResponse: 'In generale positiva.',
            assistantResponse: 'Grazie mille per il tuo tempo, è stato un piacere. Arrivederci!',
            language: 'it'
        });

        expect(result.checks.avoidsClosure).toBe(false);
        expect(result.passed).toBe(false);
    });

    it('fails when asking contact details outside data collection', () => {
        const result = evaluateInterviewQuestionQuality({
            phase: 'DEEP',
            topicLabel: 'Customer support',
            userResponse: 'Supporto lento nei weekend.',
            assistantResponse: 'Capisco, qual è la tua email così approfondiamo meglio?',
            language: 'it'
        });

        expect(result.checks.avoidsPrematureContact).toBe(false);
        expect(result.passed).toBe(false);
    });

    it('fails deep-offer quality when not asking to continue', () => {
        const result = evaluateInterviewQuestionQuality({
            phase: 'DEEP_OFFER',
            topicLabel: 'Pricing',
            userResponse: 'ok',
            assistantResponse: 'Qual è stata la principale difficoltà con i prezzi?',
            language: 'it'
        });

        expect(result.checks.deepOfferIntent).toBe(false);
        expect(result.passed).toBe(false);
    });

    it('passes a valid deep-offer question even with a short user reply', () => {
        const result = evaluateInterviewQuestionQuality({
            phase: 'DEEP_OFFER',
            topicLabel: 'Pricing',
            userResponse: 'ok',
            assistantResponse: 'Hai ancora un paio di minuti per continuare con alcune domande piu approfondite?',
            language: 'it'
        });

        expect(result.checks.deepOfferIntent).toBe(true);
        expect(result.checks.probingWhenUserIsBrief).toBe(true);
        expect(result.checks.referencesUserContext).toBe(true);
        expect(result.passed).toBe(true);
    });

    it('fails when repeating previous question too closely', () => {
        const result = evaluateInterviewQuestionQuality({
            phase: 'DEEP',
            topicLabel: 'Onboarding',
            userResponse: 'Il training era poco chiaro.',
            assistantResponse: 'Qual è stata la sfida principale nell’onboarding?',
            previousAssistantResponse: 'Qual è stata la sfida principale nell’onboarding?',
            language: 'it'
        });

        expect(result.checks.nonRepetitive).toBe(false);
        expect(result.passed).toBe(false);
    });

    it('requires stronger probing when user answer is very short', () => {
        const bad = evaluateInterviewQuestionQuality({
            phase: 'DEEP',
            topicLabel: 'Esperienza',
            userResponse: 'Bene.',
            assistantResponse: 'Com’è andata in generale?',
            language: 'it'
        });
        expect(bad.checks.probingWhenUserIsBrief).toBe(false);

        const good = evaluateInterviewQuestionQuality({
            phase: 'DEEP',
            topicLabel: 'Esperienza',
            userResponse: 'Bene.',
            assistantResponse: 'Puoi raccontarmi in che modo è andata bene, con un esempio concreto?',
            language: 'it'
        });
        expect(good.checks.probingWhenUserIsBrief).toBe(true);
    });

    it('does not require probing/context bridge in data collection phase', () => {
        const result = evaluateInterviewQuestionQuality({
            phase: 'DATA_COLLECTION',
            topicLabel: 'Contatti',
            userResponse: 'Tommaso',
            assistantResponse: 'Grazie, Tommaso. Qual e il tuo indirizzo email?',
            language: 'it'
        });

        expect(result.checks.probingWhenUserIsBrief).toBe(true);
        expect(result.checks.referencesUserContext).toBe(true);
        expect(result.checks.avoidsPrematureContact).toBe(true);
        expect(result.passed).toBe(true);
    });
});
