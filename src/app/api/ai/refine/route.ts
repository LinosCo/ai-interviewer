import { LLMService } from '@/services/llmService';

export async function POST(req: Request) {
    try {
        const session = await auth();
        // Allow public access for onboarding, but prefer auth'd user config

        const { text, fieldType, context } = await req.json();

        if (!text || !fieldType) {
            return new Response('Missing fieldType or text', { status: 400 });
        }

        // Get API key
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' }
        });
        const apiKey = globalConfig?.openaiApiKey || process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return Response.json({
                error: 'API_KEY_MISSING',
                message: 'Chiave API OpenAI mancante.'
            }, { status: 401 });
        }

        const openai = createOpenAI({ apiKey });
        const methodology = LLMService.getMethodology();

        let systemPrompt = `Sei un esperto di ricerca qualitativa e UX Research. Il tuo compito è raffinare il testo di un'intervista per renderlo più professionale, efficace e strategico.

## METODOLOGIA DI RIFERIMENTO
Segui rigorosamente questi principi guida per la formulazione delle domande e degli obiettivi:
${methodology.substring(0, 3000)}
`;

        if (fieldType === 'researchGoal') {
            systemPrompt += ` Trasforma l'obiettivo in una dichiarazione di ricerca ultra-professionale. Focus sul valore di business.`;
        } else if (fieldType === 'introMessage') {
            systemPrompt += ` Rendi il messaggio di benvenuto coinvolgente, chiaro e DEVE terminare con una domanda aperta che inviti alla conversazione (es: "Raccontami...", "Cosa ne pensi...").`;
        } else if (fieldType === 'topicLabel' || fieldType === 'topicDescription') {
            systemPrompt += ` Raffina il tema della discussione per esplorare in modo più profondo le motivazioni dell'utente.`;
        } else if (fieldType === 'subGoal') {
            systemPrompt += ` Trasforma questo punto in un obiettivo informativo specifico ed efficace. Non scrivere una domanda, ma cosa vogliamo scoprire.`;
        }

        const result = await generateText({
            model: openai('gpt-4o-mini'),
            system: systemPrompt,
            prompt: `Testo da raffinare: "${text}"\nContext aggiuntivo: ${context || 'Nessuno'}\n\nRispondi solo con il testo raffinato, senza commenti o virgolette. Rispondi in italiano.`
        });

        return Response.json({ refinedText: result.text.trim() });

    } catch (error: any) {
        console.error('Refine Error:', error);
        return new Response(error.message || 'Error refining text', { status: 500 });
    }
}
