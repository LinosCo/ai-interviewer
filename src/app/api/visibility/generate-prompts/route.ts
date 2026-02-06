import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getLLMProvider, getSystemLLM } from '@/lib/visibility/llm-providers';
import { PLANS, PlanType } from '@/config/plans';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { checkCreditsForAction } from '@/lib/guards/resourceGuard';
import { cookies } from 'next/headers';

const PromptGenerationSchema = z.object({
    prompts: z.array(z.string()).describe("Array of monitoring prompts in the specified language")
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
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                plan: true,
                role: true,
                memberships: {
                    select: { organizationId: true, status: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const cookieStore = await cookies();
        const selectedOrgId = cookieStore.get('bt_selected_org_id')?.value;
        const activeMembership = user.memberships.find(
            m => m.organizationId === selectedOrgId && m.status === 'ACTIVE'
        ) || user.memberships.find(m => m.status === 'ACTIVE');
        const organizationId = activeMembership?.organizationId;

        // Use user's plan (admin has unlimited access)
        const isAdmin = user.role === 'ADMIN' || user.plan === 'ADMIN';
        const plan = PLANS[user.plan as PlanType] || PLANS[PlanType.FREE];
        // Admin bypasses, 10 prompts if visibility enabled
        const maxPrompts = isAdmin ? 999 : (plan.features.visibilityTracker ? 10 : 0);

        if (!isAdmin && !plan.features.visibilityTracker) {
            return NextResponse.json(
                { error: 'Visibility tracking not available in your plan' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { brandName, category, description, language = 'it', territory = 'IT', count } = body;

        const creditsCheck = await checkCreditsForAction('visibility_query');
        if (!creditsCheck.allowed) {
            return NextResponse.json({
                code: (creditsCheck as any).code || 'ACCESS_DENIED',
                error: creditsCheck.error,
                creditsNeeded: creditsCheck.creditsNeeded,
                creditsAvailable: creditsCheck.creditsAvailable
            }, { status: creditsCheck.status || 403 });
        }

        if (!brandName || !category) {
            return NextResponse.json(
                { error: 'brandName and category are required' },
                { status: 400 }
            );
        }

        // Determine count based on plan limits
        const promptCount = Math.min(count || maxPrompts, maxPrompts);

        // Get language and territory names
        const languageName = LANGUAGE_NAMES[language as keyof typeof LANGUAGE_NAMES] || 'English';
        const territoryContext = TERRITORY_CONTEXTS[territory as keyof typeof TERRITORY_CONTEXTS] || 'Global market';

        // Generate prompts using AI
        const systemPrompt = `You are an expert in SEO and digital marketing, specialized in AI search optimization.
Generate realistic search prompts that users would ask AI assistants (ChatGPT, Claude, Gemini) when looking for products or services in a specific category.

The prompts should:
1. Be written in ${languageName}
2. Target the ${territoryContext}
3. Be diverse in intent (comparison, recommendation, alternatives, best of, how to choose, etc.)
4. Sound natural and conversational
5. Focus on the category, not the specific brand
6. Include various user personas (beginners, professionals, businesses)

Generate ${promptCount} unique prompts.`;

        const userPrompt = `Brand: "${brandName}"
Category: "${category}"
Description: "${description || 'Not provided'}"

Generate ${promptCount} diverse search prompts that someone interested in ${category} might ask an AI assistant. 
The prompts should be in ${languageName} and target users in ${territoryContext}.

Examples of good prompt types:
- "Best ${category} for [use case]"
- "How to choose ${category}"
- "Alternatives to [competitor]"
- "${category} comparison"
- "Top rated ${category} in [year]"
- "Free vs paid ${category}"
- "${category} for small business"`;

        // Generate prompts using AI
        const { model } = await getSystemLLM();
        const result = await generateObject({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            schema: PromptGenerationSchema,
            temperature: 0.8 // More creative for diverse prompts
        });

        // Track credit usage
        if (result.usage) {
            try {
                await TokenTrackingService.logTokenUsage({
                    organizationId: organizationId || 'unknown',
                    userId: user.id,
                    inputTokens: result.usage.inputTokens || 0,
                    outputTokens: result.usage.outputTokens || 0,
                    category: 'VISIBILITY',
                    model: 'gpt-4o-mini',
                    operation: 'visibility-generate-prompts',
                    resourceType: 'visibility'
                });
            } catch (err) {
                console.error('[Visibility] Credit tracking failed:', err);
            }
        }

        return NextResponse.json({
            prompts: result.object.prompts,
            count: result.object.prompts.length,
            language,
            territory
        });

    } catch (error) {
        console.error('Error generating prompts:', error);
        return NextResponse.json(
            { error: 'Failed to generate prompts' },
            { status: 500 }
        );
    }
}
