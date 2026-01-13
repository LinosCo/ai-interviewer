import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const generateSchema = z.object({
    goal: z.string().min(5).optional(),
    userPrompt: z.string().min(5).optional(),
    businessContext: z.string().optional(),
    currentConfig: z.any().optional(),
    refinementPrompt: z.string().optional(),
});

const configSchema = z.object({
    name: z.string().describe('A professional and friendly name for the chatbot'),
    description: z.string().describe('Short description of what the bot does'),
    systemPrompt: z.string().optional().describe('The system instructions for the AI behavior'),
    tone: z.string().describe('The tone of voice (friendly, formal, empathetic, professional)'),
    welcomeMessage: z.string().describe('Engaging first message to start the conversation'),
    fallbackMessage: z.string().optional().describe('Message when bot doesn\'t know the answer'),
    leadCaptureStrategy: z.enum(['immediate', 'after_3_msgs', 'smart', 'on_exit']).describe('When to ask for lead details'),
    candidateDataFields: z.array(z.object({
        field: z.string(),
        question: z.string(),
        required: z.boolean().optional().default(false)
    })).optional().describe('List of data fields to collect from the user'),
    topics: z.array(z.string()).optional().describe('Main topics the chatbot handles'),
    knowledgeAreas: z.array(z.string()).optional().describe('Knowledge domains needed'),
    boundaries: z.array(z.string()).optional().describe('What the bot can and cannot do'),
    primaryColor: z.string().optional().describe('Hex color for branding'),
    suggestedKnowledge: z.array(z.string()).optional().describe('List of suggested topics or URLs to add to KB'),
});

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const validation = generateSchema.safeParse(body);

        if (!validation.success) {
            return new Response('Invalid request', { status: 400 });
        }

        const { goal, userPrompt, businessContext, currentConfig, refinementPrompt } = validation.data;

        // Get API key
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' }
        });
        const apiKey = globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return Response.json({ error: 'API_KEY_MISSING', message: 'Chiave API OpenAI mancante.' }, { status: 401 });
        }

        const openai = createOpenAI({ apiKey });
        const prompt = userPrompt || goal || '';

        if (!prompt && !refinementPrompt) {
            return new Response('userPrompt, goal, or refinementPrompt is required', { status: 400 });
        }

        // Refinement mode
        if (currentConfig && refinementPrompt) {
            const result = await generateObject({
                model: openai('gpt-4o'),
                schema: configSchema,
                system: `Sei un esperto di Customer Support e Lead Generation Automation. 
                Il tuo compito è raffinare una configurazione esistente di un Chatbot AI in base al feedback dell'utente.`,
                prompt: `Configurazione Attuale:\n${JSON.stringify(currentConfig, null, 2)}\n\nRichiesta di Modifica: "${refinementPrompt}"\n\nGenera la configurazione aggiornata. Rispondi in Italiano.`
            });
            return Response.json(result.object);
        }

        // Initial generation mode
        const result = await generateObject({
            model: openai('gpt-4o'),
            schema: configSchema,
            system: `Sei un esperto di Customer Support e Lead Generation Automation. 
            Il tuo compito è configurare un Chatbot AI ottimizzato per l'obiettivo dell'utente.
            
            Linee guida:
            1. **Nome**: Professionale ma accattivante.
            2. **System Prompt**: Deve istruire il bot a essere utile, conciso e orientato alla conversione/risoluzione.
            3. **Lead Gen**: Scegli i campi strettamente necessari in base all'obiettivo (es. B2B -> Azienda, Email). Non chiedere troppi dati.
            4. **Welcome Message**: Deve essere caldo e invitare all'azione specifica.
            5. **Tone**: Adatta il tono all'industria (es. Medicale -> Empatico, Tech -> Dinamico).
            6. **Topics**: Identifica 3-5 argomenti principali che il bot deve gestire.
            7. **Boundaries**: Definisci chiaramente cosa il bot può e non può fare.`,
            prompt: `Obiettivo del Chatbot: "${prompt}"${businessContext ? `\n\nContesto Business: ${businessContext}` : ''}\n\nGenera la configurazione completa. Rispondi in Italiano.`
        });

        return Response.json(result.object);

    } catch (error: any) {
        console.error('Bot Generation Error:', error);
        return new Response(error.message || 'Generation failed', { status: 500 });
    }
}
