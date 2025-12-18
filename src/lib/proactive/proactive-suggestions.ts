import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export interface ProactiveSuggestion {
    reason: string;
    suggestions: string[];
}

const suggestionSchema = z.object({
    isVague: z.boolean().describe('True se la risposta è troppo breve o vaga'),
    reason: z.string().describe('Perché è considerata vaga?'),
    suggestions: z.array(z.string()).max(3).describe('Suggerimenti di risposta specifici per aiutare l\'utente')
});

export async function analyzeForProactiveSuggestions(
    userMessage: string,
    currentTopicLabel: string,
    knowledgeBase: string | null,
    apiKey: string
): Promise<ProactiveSuggestion | null> {

    // Quick heuristic: If message is long enough, skip LLM call to save tokens
    if (userMessage.length > 50) return null;

    const openai = createOpenAI({ apiKey });

    try {
        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: suggestionSchema,
            prompt: `
                Analizza questa risposta breve dell'utente in un'intervista sul tema "${currentTopicLabel}".
                
                Risposta Utente: "${userMessage}"
                
                Contesto aggiuntivo (se presente): ${knowledgeBase || 'Nessuno'}
                
                Se la risposta è troppo vaga (es. "Sì", "Non so", "Forse"), genera 3 suggerimenti che l'utente potrebbe cliccare per rispondere in modo più completo.
                Se la risposta è adeguata, setta isVague=false.
            `
        });

        if (result.object.isVague) {
            return {
                reason: result.object.reason,
                suggestions: result.object.suggestions
            };
        }

        return null;

    } catch (error) {
        console.error("Proactive suggestion failed", error);
        return null;
    }
}
