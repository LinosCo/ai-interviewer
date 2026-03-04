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

// ── Heuristic patterns ──────────────────────────────────────────────
const FORMAL_IT = /\b(cordiali saluti|distinti saluti|in merito|le comunico|spettabile|egregio|la informo|a tal proposito)\b/i;
const FORMAL_EN = /\b(dear sir|sincerely|regarding|herein|pursuant|respectfully|hereby)\b/i;
const CASUAL_IT = /\b(ciao|ehi|bella|minchia|madonna|dai|boh|vabbè|figurati|tranquillo|roba|cose)\b/i;
const CASUAL_EN = /\b(hey|hi|cool|awesome|yeah|yep|nah|gonna|wanna|lol|haha|btw|omg)\b/i;
const EMOTION_IT = /\b(adoro|odio|fantastico|terribile|incredibile|entusiasta|deluso|pazzesco|meraviglioso|schifo)\b/i;
const EMOTION_EN = /\b(love|hate|amazing|terrible|awesome|incredible|excited|disappointed|wonderful|disgusting)\b/i;
const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const COMPLEX_IT = /\b(nonostante|ciononostante|pertanto|altresì|presupposto|implicazione|paradigma|implementazione|ottimizzazione)\b/i;
const COMPLEX_EN = /\b(notwithstanding|furthermore|paradigm|implementation|optimization|consequently|leveraging|synergy)\b/i;

export class ToneAnalyzer {
    private openai;

    constructor(apiKey: string) {
        this.openai = createOpenAI({ apiKey });
    }

    /**
     * LLM-based tone analysis (~500-800ms). Used by standard tier.
     */
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
                model: this.openai('gpt-5-mini'),
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

    /**
     * Heuristic-based tone analysis (<1ms). Used by avanzato tier to save ~500ms per turn.
     * Analyzes word count, emoji usage, formality markers, and punctuation patterns.
     */
    analyzeToHeuristic(
        recentMessages: { role: string, content: string }[],
        language: string = 'it'
    ): ToneProfile {
        const userTexts = recentMessages
            .filter(m => m.role === 'user')
            .slice(-5)
            .map(m => m.content || '');

        if (userTexts.length === 0) {
            return this.getDefaultProfile();
        }

        const combined = userTexts.join(' ');
        const isItalian = language.toLowerCase().startsWith('it');

        // ── Register ──
        const formalPattern = isItalian ? FORMAL_IT : FORMAL_EN;
        const casualPattern = isItalian ? CASUAL_IT : CASUAL_EN;
        const hasFormal = formalPattern.test(combined);
        const hasCasual = casualPattern.test(combined);
        const register: ToneProfile['register'] =
            hasFormal && !hasCasual ? 'formal' :
            hasCasual && !hasFormal ? 'casual' : 'neutral';

        // ── Verbosity (avg words per message) ──
        const avgWords = userTexts.reduce((sum, t) => sum + t.split(/\s+/).filter(Boolean).length, 0) / userTexts.length;
        const verbosity: ToneProfile['verbosity'] =
            avgWords < 15 ? 'brief' :
            avgWords > 50 ? 'verbose' : 'moderate';

        // ── Emotionality ──
        const emotionPattern = isItalian ? EMOTION_IT : EMOTION_EN;
        const exclamations = (combined.match(/!/g) || []).length;
        const hasEmotion = emotionPattern.test(combined);
        const emotionality: ToneProfile['emotionality'] =
            (hasEmotion || exclamations >= 3) ? 'expressive' :
            (avgWords < 10 && !hasEmotion) ? 'reserved' : 'balanced';

        // ── Emoji ──
        const usesEmoji = EMOJI_PATTERN.test(combined);

        // ── Complexity ──
        const complexPattern = isItalian ? COMPLEX_IT : COMPLEX_EN;
        const avgWordLength = combined.split(/\s+/).filter(Boolean).reduce((sum, w) => sum + w.length, 0)
            / Math.max(1, combined.split(/\s+/).filter(Boolean).length);
        const hasComplexVocab = complexPattern.test(combined);
        const complexity: ToneProfile['complexity'] =
            (hasComplexVocab || avgWordLength > 7) ? 'complex' :
            avgWordLength < 4.5 ? 'simple' : 'moderate';

        return { register, verbosity, emotionality, usesEmoji, complexity };
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
