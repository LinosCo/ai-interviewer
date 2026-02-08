import { describe, expect, it } from 'vitest';
import { evaluateTranscriptSemanticFlow } from '@/lib/interview/transcript-semantic-evaluator';

describe('transcript-semantic-evaluator', () => {
    it('fails when transition echoes unrelated user content into next topic', () => {
        const result = evaluateTranscriptSemanticFlow({
            language: 'it',
            turns: [
                { role: 'user', content: 'gli agenti funzionano come un cda interno' },
                {
                    role: 'assistant',
                    phase: 'SCAN',
                    topicLabel: "Iniziative Aziendali sull'AI",
                    content: 'Interessante sul tema iniziative aziendali AI: quali sfide avete trovato?'
                },
                { role: 'user', content: 'ognuno propone una soluzione e poi il presidente decide' },
                {
                    role: 'assistant',
                    phase: 'SCAN',
                    topicLabel: 'Aspettative per il TEDx',
                    content: 'Hai detto "ognuno propone una soluzione e poi il presidente decide": qual e l impatto su Aspettative per il TEDx?'
                }
            ]
        });

        expect(result.passed).toBe(false);
        expect(result.transitionFailures).toBeGreaterThan(0);
        expect(result.issues.some(i => i.includes('Transizione topic non coerente semanticamente'))).toBe(true);
    });

    it('passes when transition uses a natural pivot without forced echo', () => {
        const result = evaluateTranscriptSemanticFlow({
            language: 'it',
            turns: [
                { role: 'user', content: 'gli agenti funzionano come un cda interno' },
                {
                    role: 'assistant',
                    phase: 'SCAN',
                    topicLabel: "Iniziative Aziendali sull'AI",
                    content: 'Hai menzionato un modello a cda interno: puoi spiegarmi quali benefici porta nelle iniziative AI?'
                },
                { role: 'user', content: 'coordinano decisioni complesse tra più team' },
                {
                    role: 'assistant',
                    phase: 'SCAN',
                    topicLabel: 'Aspettative per il TEDx',
                    content: 'Interessante il tuo punto. Riguardo alle aspettative per il TEDx, quali temi ritieni più utili?'
                }
            ]
        });

        expect(result.passed).toBe(true);
        expect(result.transitionFailures).toBe(0);
    });

    it('fails when clarification is handled with literal echo', () => {
        const result = evaluateTranscriptSemanticFlow({
            language: 'it',
            turns: [
                { role: 'user', content: 'non capisco la domanda' },
                {
                    role: 'assistant',
                    phase: 'SCAN',
                    topicLabel: 'Aspettative per il TEDx',
                    content: 'Hai detto "non capisco la domanda": puoi farmi un esempio concreto su Aspettative per il TEDx?'
                }
            ]
        });

        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('Gestione chiarimento non naturale'))).toBe(true);
    });

    it('fails when consent is accepted but bot does not move to a concrete field', () => {
        const result = evaluateTranscriptSemanticFlow({
            language: 'it',
            turns: [
                {
                    role: 'assistant',
                    phase: 'DATA_COLLECTION',
                    topicLabel: 'Contatti',
                    content: 'Posso raccogliere i tuoi contatti per restare in contatto?'
                },
                { role: 'user', content: 'si va bene' },
                {
                    role: 'assistant',
                    phase: 'DATA_COLLECTION',
                    topicLabel: 'Contatti',
                    content: 'Perfetto, che tipo di informazioni vuoi condividere?'
                }
            ]
        });

        expect(result.passed).toBe(false);
        expect(result.consentFailures).toBeGreaterThan(0);
        expect(result.issues.some(i => i.includes('Interpretazione consenso/non consenso'))).toBe(true);
    });

    it('passes when consent is accepted and bot asks a concrete contact field', () => {
        const result = evaluateTranscriptSemanticFlow({
            language: 'it',
            turns: [
                {
                    role: 'assistant',
                    phase: 'DATA_COLLECTION',
                    topicLabel: 'Contatti',
                    content: 'Posso raccogliere i tuoi contatti per restare in contatto?'
                },
                { role: 'user', content: 'si va bene' },
                {
                    role: 'assistant',
                    phase: 'DATA_COLLECTION',
                    topicLabel: 'Contatti',
                    content: 'Perfetto, come ti chiami?'
                }
            ]
        });

        expect(result.passed).toBe(true);
        expect(result.consentFailures).toBe(0);
    });

    it('fails when bot ignores rich user signal and asks a generic follow-up', () => {
        const result = evaluateTranscriptSemanticFlow({
            language: 'it',
            turns: [
                {
                    role: 'user',
                    content: 'Nel progetto AI abbiamo ridotto del 30% i tempi operativi ma il team sales ha segnalato errori in fase di handoff cliente.'
                },
                {
                    role: 'assistant',
                    phase: 'DEEP',
                    topicLabel: "Iniziative Aziendali sull'AI",
                    content: 'Capisco. Cosa ne pensi?'
                }
            ]
        });

        expect(result.passed).toBe(false);
        expect(result.issues.some(i => i.includes('Non valorizza i segnali interessanti'))).toBe(true);
    });
});
