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
            select: {
                id: true,
                name: true,
                slug: true,
                createdAt: true,
                plan: true,
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
                },
                projects: {
                    select: {
                        id: true,
                        name: true,
                        owner: {
                            select: { id: true, name: true, email: true }
                        },
                        cmsConnection: {
                            select: { id: true, status: true }
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

            const creditsLimit = plan?.monthlyCredits || 0;
            const creditsUsed = org.subscription?.tokensUsedThisMonth || 0;
            const creditsPercentage = isUnlimited(creditsLimit) ? 0 : Math.min(100, (creditsUsed / creditsLimit) * 100);

            const owner = org.members[0]?.user;

            // Check if any project has CMS integration
            const hasCMS = org.projects?.some((p: any) => p.cmsConnection?.status === 'ACTIVE') || false;

            return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                createdAt: org.createdAt,
                plan: org.plan,
                tier,
                hasCMSIntegration: hasCMS,
                status: org.subscription?.status || 'ACTIVE',
                isPartner: org.subscription?.isPartner || false,
                owner: owner ? { email: owner.email, name: owner.name } : null,
                members: org._count.members,
                projects: org.projects,
                usage: {
                    credits: {
                        used: creditsUsed,
                        limit: creditsLimit,
                        percentage: creditsPercentage
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
/**
 * POST /api/admin/organizations
 * Create a new organization (Admin only)
 */
export async function POST(request: Request) {
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

        const body = await request.json();
        const { name, slug, ownerEmail } = body;

        if (!name || !slug || !ownerEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if owner exists
        const owner = await prisma.user.findUnique({
            where: { email: ownerEmail }
        });

        if (!owner) {
            return NextResponse.json({ error: 'Owner user not found' }, { status: 404 });
        }

        // Check if slug is unique
        const existingOrg = await prisma.organization.findUnique({
            where: { slug }
        });

        if (existingOrg) {
            return NextResponse.json({ error: 'Slug already in use' }, { status: 409 });
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create Organization
            const org = await tx.organization.create({
                data: {
                    name,
                    slug,
                    plan: 'FREE',
                }
            });

            // Create Ownership Membership
            await tx.membership.create({
                data: {
                    userId: owner.id,
                    organizationId: org.id,
                    role: 'OWNER',
                    status: 'ACTIVE',
                    joinedAt: new Date(),
                }
            });

            return org;
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error creating organization:', error);
        return NextResponse.json(
            { error: 'Failed to create organization' },
            { status: 500 }
        );
    }
}
