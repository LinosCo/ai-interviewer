import { describe, expect, it } from 'vitest';
import { findDuplicateQuestionMatch } from '@/lib/interview/question-dedup';

describe('question-dedup', () => {
    it('detects exact duplicate questions from earlier turns', () => {
        const result = findDuplicateQuestionMatch({
            language: 'it',
            candidateResponse: 'Grazie per il contesto. Cosa ti ha spinto a valutare Business Tuner nella tua realtà aziendale?',
            historyAssistantMessages: [
                'Grazie per dedicare del tempo a questa intervista. Cosa ti ha spinto a valutare Business Tuner nella tua realtà aziendale?',
                'Quale settore specifico rappresenta la tua azienda?'
            ]
        });

        expect(result.isDuplicate).toBe(true);
        expect(result.reason).toBe('exact');
        expect(result.similarity).toBe(1);
    });

    it('detects near-duplicate phrasings with high semantic overlap', () => {
        const result = findDuplicateQuestionMatch({
            language: 'it',
            candidateResponse: 'Quale bisogno concreto vorresti risolvere per primo con Business Tuner?',
            historyAssistantMessages: [
                'Quale bisogno concreto vorresti risolvere per primo con Business Tuner per la tua azienda?',
                'Come descriveresti oggi il tuo processo commerciale?'
            ]
        });

        expect(result.isDuplicate).toBe(true);
        expect(result.reason === 'high_similarity' || result.reason === 'same_prefix').toBe(true);
        expect(result.similarity).toBeGreaterThan(0.7);
    });

    it('does not flag genuinely different questions', () => {
        const result = findDuplicateQuestionMatch({
            language: 'it',
            candidateResponse: 'Quali segnali di mercato monitorate già oggi in modo sistematico?',
            historyAssistantMessages: [
                'Quale settore specifico rappresenta la tua azienda e quali dinamiche sono più rilevanti?',
                'Quante persone lavorano oggi nella vostra organizzazione?'
            ]
        });

        expect(result.isDuplicate).toBe(false);
        expect(result.reason).toBe('none');
    });

    it('flags theme fixation when the assistant drags the same motif after the user opens a new angle', () => {
        const result = findDuplicateQuestionMatch({
            language: 'it',
            candidateResponse: 'Quale altro dettaglio sull ordine visivo ti aspetteresti di approfondire ancora?',
            historyAssistantMessages: [
                'Hai detto che l ordine visivo è uno degli aspetti più forti del prodotto. In che modo questo ordine visivo ha influenzato la tua percezione complessiva?',
                'Hai preferito esplorare liberamente o seguire un percorso guidato per approfondire ancora l ordine visivo?'
            ],
            lastUserMessage: 'Mi sarebbe piaciuto parlare con qualcuno del team per capire le scelte fatte.'
        });

        expect(result.isDuplicate).toBe(true);
        expect(result.reason).toBe('theme_fixation');
    });
});
