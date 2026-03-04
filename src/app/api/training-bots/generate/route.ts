import { auth } from '@/auth';
import { getConfigValue } from '@/lib/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { sanitize } from '@/lib/llm/prompt-sanitizer';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { TokenCategory } from '@prisma/client';

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let prompt: string;
    try {
        const body = await req.json();
        prompt = body.prompt;
    } catch {
        return new Response('Invalid JSON body', { status: 400 });
    }

    if (!prompt || typeof prompt !== 'string') {
        return Response.json({ error: 'prompt is required' }, { status: 400 });
    }

    // Get API key from global config
    const apiKey = await getConfigValue('openaiApiKey') ?? undefined;

    if (!apiKey) {
        return Response.json(
            { error: 'API_KEY_MISSING', message: 'Chiave API OpenAI mancante. Configurala nelle impostazioni.' },
            { status: 401 }
        );
    }

    try {
        const openai = createOpenAI({ apiKey });

        const trainingSchema = z.object({
            name: z.string().describe('Nome breve e chiaro del percorso formativo (max 60 caratteri)'),
            learningGoal: z.string().describe('Obiettivo formativo principale riformulato in modo professionale e strategico'),
            targetAudience: z.string().describe('Descrizione precisa del pubblico destinatario (ruolo, livello, contesto)'),
            tone: z.string().describe('Tono suggerito per il trainer AI (es: professionale, empatico, diretto, incoraggiante)'),
            introMessage: z.string().describe('Messaggio di benvenuto che motivi il trainee. Deve presentare il percorso e terminare invitando a iniziare.'),
            maxDurationMins: z.number().min(10).max(180).describe('Durata consigliata della lezione in minuti (10-180)'),
            traineeEducationLevel: z.enum(['PRIMARY', 'SECONDARY', 'UNIVERSITY', 'PROFESSIONAL']).describe('Livello di istruzione stimato del target'),
            traineeCompetenceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).describe('Livello di competenza stimato sul tema'),
            passScoreThreshold: z.number().min(50).max(95).describe('Soglia di superamento consigliata (%)'),
            topics: z.array(z.object({
                label: z.string().describe('Titolo del modulo/argomento (conciso, max 60 caratteri)'),
                description: z.string().describe('Perché questo modulo è importante nel percorso'),
                learningObjectives: z.array(z.string()).describe('3-5 obiettivi di apprendimento specifici e misurabili (es: "Saper applicare...", "Comprendere...")'),
                minCheckingTurns: z.number().min(1).max(4).describe('Numero minimo di turni di dialogo per verificare la comprensione (1-4)'),
                maxCheckingTurns: z.number().min(3).max(10).describe('Numero massimo di turni di dialogo per questo modulo (3-10)'),
            })).describe('3-6 moduli formativi in ordine logico di apprendimento'),
        });

        const result = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: trainingSchema,
            prompt: `Sei "Business Tuner AI", un esperto progettista di percorsi formativi aziendali.
L'utente vuole creare un percorso di formazione con questo obiettivo:

"${sanitize(prompt, 1000)}"

Il tuo compito è strutturare un percorso formativo professionale, efficace e coinvolgente.

Linee guida:
1. **Obiettivi misurabili**: Ogni modulo deve avere obiettivi concreti e verificabili.
2. **Progressione logica**: I moduli devono seguire un filo logico (da basi a competenze avanzate).
3. **Engagement**: Il messaggio introduttivo deve motivare il trainee a partecipare attivamente.
4. **Adattabilità**: Stima il livello del pubblico in base al contesto descritto.
5. **Dialogo ottimale**: Calibra i turni di dialogo in base alla complessità di ogni modulo.
6. **Durata realistica**: Proponi una durata totale della lezione coerente con il numero di moduli e la profondità richiesta.

Output atteso:
- Struttura chiara e professionale
- Obiettivi di apprendimento specifici (non generici)
- Tono adatto al contesto aziendale descritto

Rispondi in italiano.`,
        });

        // Track token usage
        try {
            await TokenTrackingService.logTokenUsage({
                organizationId: '' as string,
                userId: session.user.id,
                inputTokens: result.usage?.inputTokens ?? 0,
                outputTokens: result.usage?.outputTokens ?? 0,
                category: TokenCategory.TRAINING,
                model: 'gpt-4o-mini',
                operation: 'training-generate',
                resourceType: 'training_generate',
            });
        } catch (trackingErr) {
            console.error('[TokenTracking] training-bots/generate usage log failed:', trackingErr);
        }

        return Response.json(result.object);
    } catch (error: any) {
        console.error('[training-bots/generate] Error:', error);
        return new Response(error.message || 'Generation failed', { status: 500 });
    }
}
