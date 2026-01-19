import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const RefinePromptSchema = z.object({
    refinedPrompt: z.string().describe("The improved version of the original prompt"),
    improvements: z.array(z.string()).describe("List of specific improvements made")
});

const LANGUAGE_NAMES = {
    it: 'Italian',
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German'
} as const;

const TERRITORY_CONTEXTS = {
    IT: 'Italy / Italian market',
    US: 'United States / US market',
    UK: 'United Kingdom / UK market',
    ES: 'Spain / Spanish market',
    FR: 'France / French market',
    DE: 'Germany / German market'
} as const;

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { promptText, brandName, language = 'it', territory = 'IT' } = body;

        if (!promptText || !brandName) {
            return NextResponse.json(
                { error: 'promptText and brandName are required' },
                { status: 400 }
            );
        }

        const languageName = LANGUAGE_NAMES[language as keyof typeof LANGUAGE_NAMES] || 'English';
        const territoryContext = TERRITORY_CONTEXTS[territory as keyof typeof TERRITORY_CONTEXTS] || 'Global market';

        const systemPrompt = `You are an expert in SEO and AI search optimization.
Your task is to refine search prompts to make them more effective for monitoring brand visibility in AI assistants.

When refining a prompt, you should:
1. Keep the core intent and meaning
2. Make it sound more natural and conversational
3. Ensure it's likely to trigger relevant results from AI assistants
4. Keep it in ${languageName}
5. Optimize for ${territoryContext}
6. Make it specific enough to get quality results
7. Avoid being overly promotional or biased

Provide both the refined prompt and a brief list of what you improved.`;

        const userPrompt = `Original prompt: "${promptText}"
Brand context: "${brandName}"
Target language: ${languageName}
Target market: ${territoryContext}

Refine this prompt to make it more effective for monitoring how AI assistants talk about brands in this category.
Keep the same intent but improve clarity, naturalness, and effectiveness.`;

        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            system: systemPrompt,
            prompt: userPrompt,
            schema: RefinePromptSchema,
            temperature: 0.5 // Balanced between creativity and consistency
        });

        return NextResponse.json({
            refinedPrompt: object.refinedPrompt,
            improvements: object.improvements,
            original: promptText
        });

    } catch (error) {
        console.error('Error refining prompt:', error);
        return NextResponse.json(
            { error: 'Failed to refine prompt' },
            { status: 500 }
        );
    }
}
