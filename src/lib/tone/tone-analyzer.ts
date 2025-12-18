import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export interface ToneProfile {
    register: 'formal' | 'neutral' | 'casual';
    verbosity: 'brief' | 'moderate' | 'verbose';
    emotionality: 'reserved' | 'balanced' | 'expressive';
    usesEmoji: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
}

const toneSchema = z.object({
    register: z.enum(['formal', 'neutral', 'casual']).describe('Livello di formalità'),
    verbosity: z.enum(['brief', 'moderate', 'verbose']).describe('Lunghezza media delle risposte'),
    emotionality: z.enum(['reserved', 'balanced', 'expressive']).describe('Livello di emotività espressa'),
    usesEmoji: z.boolean().describe('Usa emoji frequentemente?'),
    complexity: z.enum(['simple', 'moderate', 'complex']).describe('Complessità linguistica e strutturale')
});

export class ToneAnalyzer {
    private openai;

    constructor(apiKey: string) {
        this.openai = createOpenAI({ apiKey });
    }

    async analyzeTone(recentMessages: { role: string, content: string }[]): Promise<ToneProfile> {
        // Filter only user messages, take last 5
        const userMessages = recentMessages
            .filter(m => m.role === 'user')
            .slice(-5)
            .map(m => m.content)
            .join('\n\n');

        if (!userMessages) {
            return this.getDefaultProfile();
        }

        try {
            const result = await generateObject({
                model: this.openai('gpt-4o-mini'),
                schema: toneSchema,
                prompt: `
                    Analizza lo stile comunicativo dell'utente basandoti su questi messaggi recenti:
                    
                    "${userMessages}"
                    
                    Identifica i tratti stilistici per adattare la risposta dell'AI.
                `
            });

            return result.object;
        } catch (error) {
            console.error("Tone analysis failed", error);
            return this.getDefaultProfile();
        }
    }

    getDefaultProfile(): ToneProfile {
        return {
            register: 'neutral',
            verbosity: 'moderate',
            emotionality: 'balanced',
            usesEmoji: false,
            complexity: 'moderate'
        };
    }
}
