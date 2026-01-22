import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType, isUnlimited } from '@/config/plans';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                subscription: {
                                    include: {
                                        purchasedAddOns: {
                                            where: {
                                                isActive: true,
                                                remaining: { gt: 0 }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    take: 1
                }
            }
        });

        const subscription = user?.memberships[0]?.organization?.subscription;

        if (!subscription) {
            return NextResponse.json({ error: 'Nessun abbonamento' }, { status: 404 });
        }

        const plan = PLANS[subscription.tier as PlanType] || PLANS[PlanType.FREE];
        const limits = plan.limits;

        // Calcola totali con extra
        const calcUsage = (used: number, limit: number, extra: number) => {
            const total = isUnlimited(limit) ? -1 : limit + extra;
            const percentage = isUnlimited(limit) ? 0 : Math.min(100, Math.round((used / total) * 100));
            return { used, limit, extra, total, percentage };
        };

        const tokenTotal = isUnlimited(limits.monthlyTokenBudget)
            ? -1
            : limits.monthlyTokenBudget + subscription.extraTokens;

        return NextResponse.json({
            tier: subscription.tier,
            status: subscription.status,
            isPartner: subscription.isPartner,

            tokens: {
                used: subscription.tokensUsedThisMonth,
                limit: limits.monthlyTokenBudget,
                extra: subscription.extraTokens,
                total: tokenTotal,
                percentage: isUnlimited(tokenTotal) ? 0 : Math.min(100, Math.round((subscription.tokensUsedThisMonth / tokenTotal) * 100)),
                breakdown: {
                    interview: subscription.interviewTokensUsed,
                    chatbot: subscription.chatbotTokensUsed,
                    visibility: subscription.visibilityTokensUsed,
                    suggestion: subscription.suggestionTokensUsed,
                    system: subscription.systemTokensUsed
                }
            },

            interviews: calcUsage(
                subscription.interviewsUsedThisMonth,
                limits.maxInterviewsPerMonth,
                subscription.extraInterviews
            ),

            chatbotSessions: calcUsage(
                subscription.chatbotSessionsUsedThisMonth,
                limits.maxChatbotSessionsPerMonth,
                subscription.extraChatbotSessions
            ),

            visibilityQueries: calcUsage(
                subscription.visibilityQueriesUsedThisMonth,
                limits.maxVisibilityQueriesPerMonth,
                subscription.extraVisibilityQueries
            ),

            aiSuggestions: calcUsage(
                subscription.aiSuggestionsUsedThisMonth,
                limits.maxAiSuggestionsPerMonth,
                subscription.extraAiSuggestions
            ),

            addOns: subscription.purchasedAddOns.map(a => ({
                id: a.id,
                type: a.type,
                remaining: a.remaining,
                expiresAt: a.expiresAt
            })),

            period: {
                start: subscription.currentPeriodStart,
                end: subscription.currentPeriodEnd
            },

            trialEndsAt: subscription.trialEndsAt
        });

    } catch (error) {
        console.error('Usage API error:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dati' },
            { status: 500 }
        );
    }
}
