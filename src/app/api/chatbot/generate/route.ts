import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const generateSchema = z.object({
    goal: z.string().min(5),
});

const configSchema = z.object({
    name: z.string().describe('A professional and friendly name for the chatbot'),
    description: z.string().describe('Short description of what the bot does'),
    systemPrompt: z.string().describe('The system instructions for the AI behavior'),
    welcomeMessage: z.string().describe('Engaging first message to start the conversation'),
    leadCaptureStrategy: z.enum(['immediate', 'after_3_msgs', 'smart', 'on_exit']).describe('When to ask for lead details'),
    candidateDataFields: z.array(z.object({
        field: z.string(),
        question: z.string(),
        required: z.boolean()
    })).describe('List of data fields to collect from the user'),
    suggestedKnowledge: z.array(z.string()).describe('List of suggested topics or URLs to add to KB'),
    tone: z.string().describe('The tone of voice (friendly, formal, empathetic)')
});

export async function POST(req: Request) {
    try {
        const session = await auth();
        // Allow even without session for testing? No, require auth for dashboard features.
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const validation = generateSchema.safeParse(body);

        if (!validation.success) {
            return new Response('Invalid request', { status: 400 });
        }

        const { goal } = validation.data;

        // Get API key
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' }
        });
        const apiKey = globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return Response.json({ error: 'API_KEY_MISSING', message: 'Chiave API OpenAI mancante.' }, { status: 401 });
        }

        const openai = createOpenAI({ apiKey });

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
            5. **Tone**: Adatta il tono all'industria (es. Medicale -> Empatico, Tech -> Dinamico).`,
            prompt: `Obiettivo del Chatbot: "${goal}"\n\nGenera la configurazione completa. Rispondi in Italiano.`
        });

        return Response.json(result.object);

    } catch (error: any) {
        console.error('Bot Generation Error:', error);
        return new Response(error.message || 'Generation failed', { status: 500 });
    }
}
