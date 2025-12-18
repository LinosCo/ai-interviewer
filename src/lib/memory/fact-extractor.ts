import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { CollectedFact } from '@/types/memory';

const factSchema = z.object({
    facts: z.array(z.object({
        content: z.string().describe('Fatto estratto in forma assertiva'),
        confidence: z.number().min(0).max(1).describe('Confidenza estrazione'),
        keywords: z.array(z.string()).describe('Parole chiave')
    })),
    detectedTone: z.enum(['formal', 'casual', 'brief', 'verbose']).nullable(),
    fatigueSignals: z.number().min(0).max(1).describe('0 = engaged, 1 = fatigued')
});

export async function extractFactsFromResponse(
    userMessage: string,
    currentTopicLabel: string,
    existingFacts: CollectedFact[],
    apiKey: string
): Promise<{
    newFacts: Omit<CollectedFact, 'id' | 'extractedAt'>[];
    detectedTone: string | null;
    fatigueScore: number;
}> {

    const openai = createOpenAI({ apiKey });

    const existingFactsSummary = existingFacts
        .map(f => `- ${f.content}`)
        .join('\n');

    const prompt = `
Analizza questa risposta dell'utente in un'intervista.

RISPOSTA UTENTE:
"${userMessage}"

TOPIC CORRENTE: ${currentTopicLabel}

FATTI GIÀ NOTI:
${existingFactsSummary || '(nessuno)'}

COMPITI:
1. Estrai NUOVI fatti concreti dalla risposta (non ripetere quelli già noti)
2. Rileva il tono comunicativo (formale/casual/breve/verboso)
3. Valuta segnali di fatica (risposte telegrafiche, "non so", evasioni)

REGOLE ESTRAZIONE FATTI:
- Solo informazioni concrete e verificabili
- Forma assertiva: "L'utente [fatto]"
- NO interpretazioni o inferenze
- NO fatti già presenti nella lista
- Se la risposta è vaga, restituisci array vuoto
`.trim();

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'), // Modello economico per questa operazione
            schema: factSchema,
            prompt
        });

        return {
            newFacts: result.object.facts.map(f => ({
                content: f.content,
                topic: currentTopicLabel,
                confidence: f.confidence,
                keywords: f.keywords
            })),
            detectedTone: result.object.detectedTone,
            fatigueScore: result.object.fatigueSignals
        };
    } catch (error) {
        console.error('Fact extraction failed:', error);
        return {
            newFacts: [],
            detectedTone: null,
            fatigueScore: 0
        };
    }
}
