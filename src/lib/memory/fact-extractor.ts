import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { sanitize } from '@/lib/llm/prompt-sanitizer';

/**
 * Fact Extractor Service
 * Extracts structured facts from user messages to build conversation memory
 */

// Schema for extracted facts
const factExtractionSchema = z.object({
    facts: z.array(z.object({
        content: z.string().describe('The fact content (e.g., "Works as a Product Manager")'),
        topic: z.string().describe('Related topic category (e.g., "occupation", "preferences", "pain_points")'),
        confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
        keywords: z.array(z.string()).describe('Key terms for matching')
    })),
    tone: z.enum(['formal', 'casual', 'brief', 'verbose']).describe('Detected communication style'),
    fatigueIndicators: z.object({
        hasShortResponses: z.boolean(),
        hasRepetition: z.boolean(),
        hasDisengagement: z.boolean(),
        score: z.number().min(0).max(1).describe('Fatigue score 0-1')
    })
});

export type ExtractedFact = {
    id: string;
    content: string;
    topic: string;
    extractedAt: string;
    confidence: number;
    keywords: string[];
};

export type ToneDetection = 'formal' | 'casual' | 'brief' | 'verbose';

export type FatigueAnalysis = {
    hasShortResponses: boolean;
    hasRepetition: boolean;
    hasDisengagement: boolean;
    score: number;
};

export type FactExtractionResult = {
    facts: ExtractedFact[];
    tone: ToneDetection;
    fatigue: FatigueAnalysis;
    avgResponseLength: number;
    usesEmoji: boolean;
};

/**
 * Extract facts from a user message
 */
export async function extractFactsFromMessage(
    userMessage: string,
    conversationContext: string[],
    existingFacts: ExtractedFact[],
    apiKey: string
): Promise<FactExtractionResult> {

    const openai = createOpenAI({ apiKey });

    // Sanitize all end-user content before prompt interpolation
    const safeMessage = sanitize(userMessage, 2000);
    const recentContext = conversationContext
        .slice(-5)
        .map(msg => sanitize(msg, 1000))
        .join('\n');

    // Existing facts are LLM-extracted — sanitize as user data
    const existingFactsSummary = existingFacts.length > 0
        ? existingFacts.map(f => `- ${sanitize(f.content, 300)} (${sanitize(f.topic, 50)})`).join('\n')
        : 'None yet';

    const prompt = `
Analizza questo messaggio dell'utente ed estrai NUOVI fatti rilevanti.

MESSAGGIO UTENTE:
"${safeMessage}"

CONTESTO CONVERSAZIONE RECENTE:
${recentContext}

FATTI GIÀ RACCOLTI:
${existingFactsSummary}

ISTRUZIONI:
1. Estrai SOLO nuovi fatti non già presenti nei fatti esistenti
2. Un fatto è un'informazione concreta su: preferenze, esperienze, ruolo, problemi, obiettivi, contesto
3. Ignora opinioni generiche o risposte vaghe
4. Assegna confidence alta (>0.7) solo a fatti espliciti
5. Rileva il tono di comunicazione (formal/casual/brief/verbose)
6. Identifica segnali di fatica:
   - Risposte molto brevi (< 10 parole)
   - Ripetizioni di concetti già detti
   - Segnali di disimpegno ("ok", "va bene", "non so")

CATEGORIE TOPIC:
- occupation (lavoro, ruolo, settore)
- preferences (gusti, scelte, priorità)
- pain_points (problemi, frustrazioni)
- goals (obiettivi, aspirazioni)
- experience (esperienze passate)
- context (situazione attuale, vincoli)
- demographics (età, location, background)
`.trim();

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: factExtractionSchema,
            prompt,
            temperature: 0.3 // Low temperature for consistent extraction
        });

        // Calculate additional metrics
        const avgResponseLength = userMessage.split(' ').length;
        const usesEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(userMessage);

        // Convert to our format with IDs and timestamps
        const facts: ExtractedFact[] = result.object.facts.map(f => ({
            id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: f.content,
            topic: f.topic,
            extractedAt: new Date().toISOString(),
            confidence: f.confidence,
            keywords: f.keywords
        }));

        return {
            facts,
            tone: result.object.tone,
            fatigue: result.object.fatigueIndicators,
            avgResponseLength,
            usesEmoji
        };

    } catch (error) {
        console.error('Fact extraction error:', error);

        // Fallback: return empty result
        return {
            facts: [],
            tone: 'casual',
            fatigue: {
                hasShortResponses: userMessage.split(' ').length < 10,
                hasRepetition: false,
                hasDisengagement: false,
                score: 0
            },
            avgResponseLength: userMessage.split(' ').length,
            usesEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(userMessage)
        };
    }
}

/**
 * Filter out duplicate facts based on semantic similarity
 */
export function deduplicateFacts(
    newFacts: ExtractedFact[],
    existingFacts: ExtractedFact[]
): ExtractedFact[] {

    return newFacts.filter(newFact => {
        // Check if this fact is semantically similar to any existing fact
        const isDuplicate = existingFacts.some(existingFact => {
            // Same topic is a prerequisite
            if (newFact.topic !== existingFact.topic) return false;

            // Check keyword overlap
            const newKeywords = new Set(newFact.keywords.map(k => k.toLowerCase()));
            const existingKeywords = new Set(existingFact.keywords.map(k => k.toLowerCase()));

            const intersection = new Set(
                [...newKeywords].filter(k => existingKeywords.has(k))
            );

            const overlapRatio = intersection.size / Math.min(newKeywords.size, existingKeywords.size);

            // If >50% keyword overlap, consider it duplicate
            return overlapRatio > 0.5;
        });

        return !isDuplicate;
    });
}
