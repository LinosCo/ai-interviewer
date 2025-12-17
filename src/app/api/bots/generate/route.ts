import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { goal } = await req.json();
        if (!goal || typeof goal !== 'string') {
            return new Response('Invalid goal', { status: 400 });
        }

        // Get API key
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' }
        });
        const apiKey = globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return new Response('API key not configured', { status: 500 });
        }

        const openai = createOpenAI({ apiKey });

        // Schema for generated interview config
        const configSchema = z.object({
            name: z.string().describe('Nome breve e descrittivo per l\'intervista (max 50 caratteri)'),
            researchGoal: z.string().describe('Obiettivo della ricerca riformulato in modo professionale'),
            targetAudience: z.string().describe('Descrizione del target audience ideale'),
            tone: z.string().describe('Tono suggerito (es: amichevole, professionale, empatico)'),
            maxDurationMins: z.number().describe('Durata suggerita in minuti (5-20)'),
            introMessage: z.string().describe('Messaggio di benvenuto personalizzato'),
            topics: z.array(z.object({
                label: z.string().describe('Nome del topic'),
                description: z.string().describe('Descrizione di cosa esplorare'),
                subGoals: z.array(z.string()).describe('3-5 sotto-obiettivi specifici'),
                maxTurns: z.number().describe('Numero massimo di scambi per questo topic (3-6)')
            })).describe('3-5 topic principali da coprire nell\'intervista')
        });

        const result = await generateObject({
            model: openai('gpt-4o'),
            schema: configSchema,
            prompt: `Sei un esperto di ricerca qualitativa. L'utente vuole creare un'intervista con questo obiettivo:

"${goal}"

Genera una configurazione completa per un'intervista conversazionale AI che:
1. Riformuli l'obiettivo in modo professionale
2. Definisca 3-5 topic con sotto-obiettivi specifici  
3. Crei un messaggio di benvenuto accogliente e professionale
4. Suggerisca il tono giusto per il contesto
5. Stimi una durata appropriata

L'intervista deve essere:
- Naturale e conversazionale
- Focalizzata su insight actionable
- Rispettosa del tempo del partecipante
- Strutturata ma flessibile

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
