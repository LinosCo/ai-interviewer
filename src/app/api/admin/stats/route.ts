export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { TokenTrackingService } from '@/services/tokenTrackingService';

/**
 * GET /api/admin/stats
 * Get global platform statistics for admin dashboard
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

        // Get global stats from token tracking service
        const globalStats = await TokenTrackingService.getGlobalStats();

        // Get additional detailed statistics
        const [
            totalUsers,
            totalProjects,
            totalBots,
            totalConversations,
            organizationsByPlan,
            revenueStats,
            recentOrganizations,
            topOrganizations
        ] = await Promise.all([
            // Total users
            prisma.user.count(),

            // Total projects
            prisma.project.count(),

            // Total bots
            prisma.bot.count(),

            // Total conversations
            prisma.conversation.count(),

            // Organizations by plan
            prisma.organization.groupBy({
                by: ['plan'],
                _count: { id: true }
            }),

            // Revenue stats (from invoices)
            prisma.invoice.aggregate({
                where: { status: 'paid' },
                _sum: { amountPaid: true },
                _count: { id: true }
            }),

            // Recent organizations
            prisma.organization.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    subscription: {
                        select: {
                            tier: true,
                            status: true,
                            tokensUsedThisMonth: true,
                            interviewsUsedThisMonth: true
                        }
                    },
                    _count: {
                        select: {
                            members: true,
                            projects: true
                        }
                    }
                }
            }),

            // Top organizations by usage
            prisma.subscription.findMany({
                take: 10,
                orderBy: { tokensUsedThisMonth: 'desc' },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            plan: true
                        }
                    }
                }
            })
        ]);

        // Calculate MRR (Monthly Recurring Revenue)
        const subscriptions = await prisma.subscription.findMany({
            where: {
                status: 'ACTIVE',
                tier: { notIn: ['FREE', 'TRIAL'] }
            },
            select: { tier: true }
        });

        const tierPrices: Record<string, number> = {
            STARTER: 69,
            PRO: 199,
            BUSINESS: 399,
            ENTERPRISE: 999 // Average estimate
        };

        const mrr = subscriptions.reduce((sum, sub) => {
            return sum + (tierPrices[sub.tier] || 0);
        }, 0);

        // Format organizations by plan
        const byPlan: Record<string, number> = {};
        for (const stat of organizationsByPlan) {
            byPlan[stat.plan] = stat._count.id;
        }

        return NextResponse.json({
            overview: {
                totalOrganizations: globalStats.totalOrganizations,
                totalUsers,
                totalProjects,
                totalBots,
                totalConversations,
                mrr,
                totalRevenue: (revenueStats._sum.amountPaid || 0) / 100, // Convert cents to EUR
                totalInvoices: revenueStats._count.id
            },
            usage: {
                totalCreditsUsed: globalStats.totalCreditsUsed,
                totalUsers: globalStats.totalUsers,
                totalOrganizations: globalStats.totalOrganizations,
                byPlan: globalStats.byPlan
            },
            distribution: {
                byPlan
            },
            recentOrganizations: recentOrganizations.map(org => ({
                id: org.id,
                name: org.name,
                plan: org.plan,
                tier: org.subscription?.tier || 'FREE',
                status: org.subscription?.status || 'ACTIVE',
                tokensUsed: org.subscription?.tokensUsedThisMonth || 0,
                interviewsUsed: org.subscription?.interviewsUsedThisMonth || 0,
                members: org._count.members,
                projects: org._count.projects,
                createdAt: org.createdAt
            })),
            topOrganizations: topOrganizations
                .filter(sub => sub.organization)
                .map(sub => ({
                    id: sub.organization!.id,
                    name: sub.organization!.name,
                    plan: sub.organization!.plan,
                    tier: sub.tier,
                    tokensUsed: sub.tokensUsedThisMonth,
                    interviewsUsed: sub.interviewsUsedThisMonth
                })),
            recentTransactions: globalStats.recentTransactions.slice(0, 20)
        });

    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
