import { describe, expect, it } from 'vitest';
import { shouldUseCriticalModelForTopicTurn } from '@/lib/chat/context-helpers';

describe('shouldUseCriticalModelForTopicTurn', () => {
    it('keeps focused advanced turns on primary model for normal explore turns', () => {
        expect(shouldUseCriticalModelForTopicTurn({
            phase: 'EXPLORE',
            supervisorStatus: 'TRANSITION',
            userTurnSignal: 'none',
            userMessage: 'Dobbiamo comunicare meglio il valore del progetto.',
            language: 'it',
            criticalEscalation: 'focused'
        })).toEqual({
            useCritical: false,
            reason: 'focused_primary_turn'
        });
    });

    it('still escalates clarification turns in focused mode', () => {
        expect(shouldUseCriticalModelForTopicTurn({
            phase: 'EXPLORE',
            supervisorStatus: 'EXPLORING',
            userTurnSignal: 'clarification',
            userMessage: 'Intendi il progetto o il consorzio in generale?',
            language: 'it',
            criticalEscalation: 'focused'
        })).toEqual({
            useCritical: true,
            reason: 'clarification_turn'
        });
    });

    it('uses critical only for genuinely high-signal deepening turns in focused mode', () => {
        expect(shouldUseCriticalModelForTopicTurn({
            phase: 'DEEPEN',
            supervisorStatus: 'DEEPENING',
            userTurnSignal: 'none',
            userMessage: 'Abbiamo osservato che i soci più attivi sono quelli coinvolti in iniziative molto concrete, con obiettivi chiari, metriche condivise, responsabilità definite, una narrazione coerente tra eventi, territorio, contenuti digitali e relazioni commerciali. Per esempio, negli ultimi 12 mesi gli incontri più efficaci sono stati quelli con materiali comuni, kit per i produttori, testimonianze sul biologico, momenti in cantina e un calendario condiviso; in quei casi abbiamo visto più partecipazione, più richieste commerciali e un percepito nettamente più forte della denominazione.',
            language: 'it',
            criticalEscalation: 'focused'
        })).toEqual({
            useCritical: true,
            reason: 'focused_high_signal_deepening'
        });
    });
});
