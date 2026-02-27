import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { sanitize } from '@/lib/llm/prompt-sanitizer';

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

    async analyzeTone(
        recentMessages: { role: string, content: string }[],
        language: string = 'it'
    ): Promise<ToneProfile> {
        // Filter only user messages, take last 5 — sanitize before prompt interpolation
        const userMessages = recentMessages
            .filter(m => m.role === 'user')
            .slice(-5)
            .map(m => sanitize(m.content, 1000))
            .join('\n\n');

        if (!userMessages) {
            return this.getDefaultProfile();
        }

        const isItalian = language.toLowerCase().startsWith('it');

        const prompt = isItalian
            ? `
                Analizza lo stile comunicativo dell'utente basandoti su questi messaggi recenti:

                "${userMessages}"

                Identifica i tratti stilistici per adattare la risposta dell'AI.
                Valuta: registro (formale/neutro/colloquiale), verbosità, emotività, uso emoji, complessità linguistica.
            `
            : `
                Analyze the user's communication style based on these recent messages:

                "${userMessages}"

                Identify stylistic traits to adapt the AI's response accordingly.
                Evaluate: register (formal/neutral/casual), verbosity, emotionality, emoji usage, linguistic complexity.
            `;

        try {
            const result = await generateObject({
                model: this.openai('gpt-4o-mini'),
                schema: toneSchema,
                temperature: 0.1,
                prompt
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
