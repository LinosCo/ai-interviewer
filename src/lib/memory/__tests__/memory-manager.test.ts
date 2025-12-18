import { describe, it, expect } from 'vitest';
import { MemoryManager } from '../memory-manager';
import { ConversationMemoryData, CollectedFact } from '@/types/memory';

describe('MemoryManager', () => {

    describe('formatForPrompt', () => {
        it('should format facts correctly', () => {
            const memory: ConversationMemoryData = {
                factsCollected: [
                    {
                        id: '1',
                        content: 'L\'utente è a Verona per vacanza',
                        topic: 'motivazioni',
                        extractedAt: new Date().toISOString(),
                        confidence: 0.9,
                        keywords: ['Verona', 'vacanza']
                    }
                ],
                topicsExplored: [],
                unansweredAreas: [],
                userFatigueScore: 0.2,
                detectedTone: 'casual' as const,
                avgResponseLength: 50,
                usesEmoji: false
            };

            const result = MemoryManager.formatForPrompt(memory);

            expect(result).toContain('INFORMAZIONI GIÀ RACCOLTE');
            expect(result).toContain('L\'utente è a Verona per vacanza');
            expect(result).toContain('NON chiedere nuovamente');
        });

        it('should warn about user fatigue', () => {
            const memory: ConversationMemoryData = {
                factsCollected: [],
                topicsExplored: [],
                unansweredAreas: [],
                userFatigueScore: 0.7,
                detectedTone: null,
                avgResponseLength: 15,
                usesEmoji: false
            };

            const result = MemoryManager.formatForPrompt(memory);

            expect(result).toContain('SEGNALI DI FATICA');
            expect(result).toContain('domande più brevi');
        });

        it('should include tone instructions', () => {
            const memory: ConversationMemoryData = {
                factsCollected: [],
                topicsExplored: [],
                unansweredAreas: [],
                userFatigueScore: 0.1,
                detectedTone: 'formal',
                avgResponseLength: 15,
                usesEmoji: false
            };

            const result = MemoryManager.formatForPrompt(memory);
            expect(result).toContain('STILE COMUNICATIVO RILEVATO');
            expect(result).toContain('Mantieni un registro formale');
        });
    });
});
