import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PLANS, PlanType } from '@/config/plans';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getLLMProvider, getSystemLLM } from '@/lib/visibility/llm-providers';
import { TokenTrackingService } from '@/services/tokenTrackingService';
import { checkCreditsForAction } from '@/lib/guards/resourceGuard';

const CompetitorSuggestionSchema = z.object({
    suggestions: z.array(z.string()).describe("List of competitor names")
});

// Create competitor
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
                    take: 1,
                    select: { organizationId: true }
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const organizationId = user.memberships[0]?.organizationId;

        // Use user's plan (admin has unlimited access)
        const isAdmin = user.role === 'ADMIN' || user.plan === 'ADMIN';
        const plan = PLANS[user.plan as PlanType] || PLANS[PlanType.FREE];

        const body = await request.json();
        const { action, name, website, enabled = true, category, brandName } = body;

        // Handle AI suggestion (Stateless, no config needed)
        if (action === 'suggest' && category && brandName) {
            try {
                const creditsCheck = await checkCreditsForAction('visibility_query');
                if (!creditsCheck.allowed) {
                    return NextResponse.json({
                        code: (creditsCheck as any).code || 'ACCESS_DENIED',
                        error: creditsCheck.error,
                        creditsNeeded: creditsCheck.creditsNeeded,
                        creditsAvailable: creditsCheck.creditsAvailable
                    }, { status: creditsCheck.status || 403 });
                }

                // Default limit for suggestions if config not present
                const suggestionLimit = 5;

                const { model } = await getSystemLLM();
                const result = await generateObject({
                    model,
                    schema: CompetitorSuggestionSchema,
                    prompt: `Generate a list of ${suggestionLimit} main competitors for "${brandName}" in the "${category}" category.

Only include well-known, legitimate competitors that users might compare against.
Return only the company/product names, without descriptions.`,
                    temperature: 0.3
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
                            operation: 'visibility-suggest-competitors',
                            resourceType: 'visibility'
                        });
                    } catch (err) {
                        console.error('[Visibility] Credit tracking failed:', err);
                    }
                }

                return NextResponse.json({
                    suggestions: result.object.suggestions.slice(0, suggestionLimit)
                });
            } catch (error) {
                console.error('Error suggesting competitors:', error);
                return NextResponse.json(
                    { error: 'Failed to generate suggestions' },
                    { status: 500 }
                );
            }
        }

        const config = await prisma.visibilityConfig.findFirst({
            where: { organizationId },
            include: {
                competitors: {
                    where: { enabled: true }
                }
            }
        });

        if (!config) {
            return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
        }

        // Check if limit is reached (admin bypasses, 10 competitors if visibility enabled)
        const maxCompetitors = isAdmin ? 999 : (plan.features.visibilityTracker ? 10 : 0);
        if (!isAdmin && config.competitors.length >= maxCompetitors) {
            return NextResponse.json(
                { error: `Maximum competitors limit (${maxCompetitors}) reached for your plan` },
                { status: 400 }
            );
        }

        // Create competitor
        if (!name) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const competitor = await prisma.competitor.create({
            data: {
                configId: config.id,
                name,
                website: website || null,
                enabled
            }
        });

        return NextResponse.json({ success: true, competitor });

    } catch (error) {
        console.error('Error creating competitor:', error);
        return NextResponse.json(
            { error: 'Failed to create competitor' },
            { status: 500 }
        );
    }
}
