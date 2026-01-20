import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getOrCreateSubscription } from '@/lib/usage';
import { PLANS, subscriptionTierToPlanType } from '@/config/plans';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getLLMProvider, getSystemLLM } from '@/lib/visibility/llm-providers';

const CompetitorSuggestionSchema = z.object({
    suggestions: z.array(z.string()).describe("List of competitor names")
});

// Create competitor
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    take: 1,
                    include: { organization: true }
                }
            }
        });

        if (!user || !user.memberships[0]) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const organizationId = user.memberships[0].organizationId;

        // Check plan limits
        const subscription = await getOrCreateSubscription(organizationId);
        if (!subscription) {
            return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
        }
        const planType = subscriptionTierToPlanType(subscription.tier);
        const plan = PLANS[planType];

        const body = await request.json();
        const { action, name, website, enabled = true, category, brandName } = body;

        // Handle AI suggestion (Stateless, no config needed)
        if (action === 'suggest' && category && brandName) {
            try {
                // Default limit for suggestions if config not present
                const suggestionLimit = 5;

                const { model } = await getSystemLLM();
                const { object } = await generateObject({
                    model,
                    schema: CompetitorSuggestionSchema,
                    prompt: `Generate a list of ${suggestionLimit} main competitors for "${brandName}" in the "${category}" category.
                    
Only include well-known, legitimate competitors that users might compare against.
Return only the company/product names, without descriptions.`,
                    temperature: 0.3
                });

                return NextResponse.json({
                    suggestions: object.suggestions.slice(0, suggestionLimit)
                });
            } catch (error) {
                console.error('Error suggesting competitors:', error);
                return NextResponse.json(
                    { error: 'Failed to generate suggestions' },
                    { status: 500 }
                );
            }
        }

        const config = await prisma.visibilityConfig.findUnique({
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

        // Check if limit is reached
        if (config.competitors.length >= plan.limits.maxCompetitorsTracked) {
            return NextResponse.json(
                { error: `Maximum competitors limit (${plan.limits.maxCompetitorsTracked}) reached for your plan` },
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
