import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
    try {

        // Allow public generation for onboarding flow
        // const session = await auth(); 

        const { goal } = await req.json();
        if (!goal || typeof goal !== 'string') {
            return new Response('Invalid goal', { status: 400 });
        }

        // Get API key from default config or env
        // Note: For unauthenticated users, we must rely on env var or a default system config
        // accessible without user context.
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' }
        });
        const apiKey = globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            console.error('GENERATE API ERROR: API key not configured');
            return new Response('API key not configured', { status: 500 });
        }

        const openai = createOpenAI({ apiKey });

        // Schema for generated interview config
        const configSchema = z.object({
            name: z.string().describe('Nome breve e accattivante per l\'intervista (max 50 caratteri)'),
            researchGoal: z.string().describe('Obiettivo della ricerca riformulato in modo ultra-professionale e strategico'),
            targetAudience: z.string().describe('Identikit preciso del target audience'),
            tone: z.string().describe('Tono suggerito (es: Curioso e Professionale, Empatico e Aperto)'),
            maxDurationMins: z.number().describe('Durata ottimale (max 15 min per non stancare)'),
            introMessage: z.string().describe('Hook iniziale che motivi l\'utente a partecipare'),
            topics: z.array(z.object({
                label: z.string().describe('Titolo del macro-tema'),
                description: z.string().describe('Perché è importante esplorare questo tema'),
                subGoals: z.array(z.string()).describe('3-4 punti chiave specifici da scoprire (non domande, ma obiettivi informativi)'),
                maxTurns: z.number().describe('Budget di scambi (3-5)')
            })).describe('3-5 topic strategici ordinati per flusso logico')
        });

        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: configSchema,
            prompt: `Sei "Business Tuner AI", un esperto stratega di ricerca qualitativa. 
L'utente vuole lanciare un'indagine con questo obiettivo grezzo:

"${goal}"

Il tuo compito è strutturare un'intervista professionale che trasformi questo obiettivo in insight di valore.
NON generare domande generiche. Genera OBIETTIVI DI RICERCA che l'AI userà per formulare domande dinamiche.

Linee guida strategiche:
1. **Focus sul "Perché"**: Cerca le motivazioni profonde, non solo i fatti.
2. **Flusso a Imbuto**: Parti dal generale e scendi nello specifico.
3. **Rispetto del tempo**: Massimizza il valore in pochi scambi.
4. **Tono**: Professionale ma conversazionale, mai robotico.

Output richiesto:
- Riformula l'obiettivo per renderlo chiaro e strategico.
- Definisci topic che coprano sia gli aspetti funzionali che emotivi.
- Crea un messaggio di benvenuto che "venda" l'importanza della partecipazione.

Rispondi in italiano.`
        });

        return Response.json({
            ...result.object,
            language: 'it'
        });

    } catch (error: any) {
        console.error('Generate Error:', error);
        return new Response(error.message || 'Generation failed', { status: 500 });
    }
}
