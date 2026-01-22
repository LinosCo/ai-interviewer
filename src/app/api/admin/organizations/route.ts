import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { PLANS, subscriptionTierToPlanType, isUnlimited } from '@/config/plans';

/**
 * GET /api/admin/organizations
 * List all organizations with usage details for admin
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (user?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Parse query params
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const search = searchParams.get('search') || '';
        const tier = searchParams.get('tier');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        // Build where clause
        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (tier) {
            where.subscription = { tier };
        }

        // Get total count
        const total = await prisma.organization.count({ where });

        // Build orderBy
        let orderBy: any = { createdAt: 'desc' };
        if (sortBy === 'name') {
            orderBy = { name: sortOrder };
        } else if (sortBy === 'tokensUsed') {
            orderBy = { subscription: { tokensUsedThisMonth: sortOrder } };
        }

        // Get organizations
        const organizations = await prisma.organization.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy,
            include: {
                subscription: true,
                tokenUsage: true,
                _count: {
                    select: {
                        members: true,
                        projects: true
                    }
                },
                members: {
                    take: 1,
                    where: { role: 'OWNER' },
                    include: {
                        user: {
                            select: { email: true, name: true }
                        }
                    }
                }
            }
        });

        // Enrich with plan details
        const enrichedOrgs = organizations.map(org => {
            const tier = org.subscription?.tier || 'FREE';
            const planType = subscriptionTierToPlanType(tier);
            const plan = PLANS[planType];

            const tokensLimit = plan?.limits.monthlyTokenBudget || 0;
            const tokensUsed = org.subscription?.tokensUsedThisMonth || 0;
            const tokensPercentage = isUnlimited(tokensLimit) ? 0 : Math.min(100, (tokensUsed / tokensLimit) * 100);

            const interviewsLimit = plan?.limits.maxInterviewsPerMonth || 0;
            const interviewsUsed = org.subscription?.interviewsUsedThisMonth || 0;
            const interviewsPercentage = isUnlimited(interviewsLimit) ? 0 : Math.min(100, (interviewsUsed / interviewsLimit) * 100);

            const owner = org.members[0]?.user;

            return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                createdAt: org.createdAt,
                plan: org.plan,
                tier,
                status: org.subscription?.status || 'ACTIVE',
                isPartner: org.subscription?.isPartner || false,
                owner: owner ? { email: owner.email, name: owner.name } : null,
                members: org._count.members,
                projects: org._count.projects,
                usage: {
                    tokens: {
                        used: tokensUsed,
                        limit: tokensLimit,
                        percentage: tokensPercentage
                    },
                    interviews: {
                        used: interviewsUsed,
                        limit: interviewsLimit,
                        percentage: interviewsPercentage
                    },
                    chatbotSessions: {
                        used: org.subscription?.chatbotSessionsUsedThisMonth || 0,
                        limit: plan?.limits.maxChatbotSessionsPerMonth || 0
                    },
                    visibilityQueries: {
                        used: org.subscription?.visibilityQueriesUsedThisMonth || 0,
                        limit: plan?.limits.maxVisibilityQueriesPerMonth || 0
                    }
                },
                customLimits: org.subscription?.customLimits || null,
                billing: {
                    stripeCustomerId: org.subscription?.stripeCustomerId,
                    stripeSubscriptionId: org.subscription?.stripeSubscriptionId,
                    currentPeriodEnd: org.subscription?.currentPeriodEnd
                }
            };
        });

        return NextResponse.json({
            organizations: enrichedOrgs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching organizations:', error);
        return NextResponse.json(
            { error: 'Failed to fetch organizations' },
            { status: 500 }
        );
    }
}
