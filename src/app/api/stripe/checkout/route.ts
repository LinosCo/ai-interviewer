import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getStripeClient, getStripePriceIdForPlan } from '@/lib/stripe';
import { PLANS, PlanType, PURCHASABLE_PLANS } from '@/config/plans';
import { BillingCycle, SubscriptionStatus, SubscriptionTier } from '@prisma/client';

const PURCHASABLE_CHECKOUT_PLANS = new Set<PlanType>(PURCHASABLE_PLANS);
const SUPPORTED_BILLING_PERIODS = new Set(['monthly', 'yearly']);

function normalizeBillingPeriod(input?: string | null): 'monthly' | 'yearly' {
    const value = (input || 'monthly').toLowerCase();
    return SUPPORTED_BILLING_PERIODS.has(value) ? value as 'monthly' | 'yearly' : 'monthly';
}

function planTierToSubscriptionTier(plan: PlanType): SubscriptionTier {
    if (plan === PlanType.STARTER) return SubscriptionTier.STARTER;
    if (plan === PlanType.PRO) return SubscriptionTier.PRO;
    if (plan === PlanType.BUSINESS) return SubscriptionTier.BUSINESS;
    if (plan === PlanType.PARTNER) return SubscriptionTier.PARTNER;
    if (plan === PlanType.ENTERPRISE) return SubscriptionTier.ENTERPRISE;
    return SubscriptionTier.FREE;
}

function getPlanComparablePrice(plan: PlanType, billingPeriod: 'monthly' | 'yearly'): number {
    const config = PLANS[plan];
    return billingPeriod === 'yearly' ? config.yearlyMonthlyEquivalent : config.monthlyPrice;
}

// Helper function to create checkout session
async function createCheckoutSession(
    req: NextRequest,
    tier: string,
    billingPeriod: string = 'monthly',
    requestedOrganizationId?: string
) {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
        return { error: 'Non autorizzato', status: 401 };
    }

    const normalizedTier = tier?.toUpperCase() as PlanType;
    if (!PURCHASABLE_CHECKOUT_PLANS.has(normalizedTier)) {
        return { error: 'Piano non acquistabile', status: 400 };
    }

    const plan = PLANS[normalizedTier];
    if (!plan || plan.monthlyPrice === 0) {
        return { error: 'Piano non valido', status: 400 };
    }

    const normalizedBillingPeriod = normalizeBillingPeriod(billingPeriod);
    const priceId = await getStripePriceIdForPlan(normalizedTier, normalizedBillingPeriod);

    if (!priceId) {
        return { error: 'Prezzo non configurato', status: 500 };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            memberships: {
                select: {
                    organizationId: true,
                    organization: {
                        select: {
                            id: true,
                            plan: true,
                            billingCycle: true,
                            customLimits: true,
                            subscription: {
                                select: {
                                    id: true,
                                    status: true,
                                    stripeCustomerId: true,
                                    stripeSubscriptionId: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    const cookieOrganizationId = req.cookies.get('bt_selected_org_id')?.value;
    const effectiveOrganizationId = requestedOrganizationId || cookieOrganizationId;
    const membership = effectiveOrganizationId
        ? user?.memberships.find(m => m.organizationId === effectiveOrganizationId)
        : user?.memberships[0];

    const subscription = membership?.organization?.subscription;
    const organizationId = membership?.organizationId;
    const currentPlan = (membership?.organization?.plan as PlanType) || PlanType.FREE;

    if (!organizationId) {
        return { error: 'Organizzazione non trovata', status: 404 };
    }

    const stripe = await getStripeClient();
    let customerId = subscription?.stripeCustomerId;

    // If org already has an active Stripe subscription, perform in-place plan/cycle change
    if (subscription?.stripeSubscriptionId) {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        const currentItem = stripeSubscription.items.data[0];

        if (!currentItem) {
            return { error: 'Subscription Stripe non valida', status: 500 };
        }

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            items: [
                {
                    id: currentItem.id,
                    price: priceId
                }
            ],
            cancel_at_period_end: false,
            proration_behavior: 'create_prorations',
            metadata: {
                organizationId,
                tier: normalizedTier,
                billingPeriod: normalizedBillingPeriod,
                changeType:
                    getPlanComparablePrice(normalizedTier, normalizedBillingPeriod) >=
                        getPlanComparablePrice(currentPlan, (membership?.organization?.billingCycle || BillingCycle.MONTHLY) === BillingCycle.YEARLY ? 'yearly' : 'monthly')
                        ? 'upgrade'
                        : 'downgrade'
            }
        });

        const planConfig = PLANS[normalizedTier];
        const existingCustomLimits =
            typeof membership?.organization?.customLimits === 'object' &&
                membership.organization.customLimits !== null
                ? (membership.organization.customLimits as Record<string, unknown>)
                : {};
        const hasCustomMonthlyLimit = existingCustomLimits.monthlyCreditsLimitCustom === true;

        const orgUpdateData: Record<string, unknown> = {
            plan: normalizedTier,
            billingCycle: normalizedBillingPeriod === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY
        };
        if (!hasCustomMonthlyLimit) {
            orgUpdateData.monthlyCreditsLimit = BigInt(planConfig.monthlyCredits);
            orgUpdateData.customLimits = {
                ...existingCustomLimits,
                monthlyCreditsLimitCustom: false
            };
        }

        await prisma.$transaction([
            prisma.organization.update({
                where: { id: organizationId },
                data: orgUpdateData
            }),
            prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    tier: planTierToSubscriptionTier(normalizedTier),
                    status: SubscriptionStatus.ACTIVE,
                    stripePriceId: priceId,
                    stripeCustomerId: typeof stripeSubscription.customer === 'string'
                        ? stripeSubscription.customer
                        : subscription.stripeCustomerId || null
                }
            })
        ]);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        return {
            url: `${appUrl}/dashboard/billing?plan_change=success&tier=${normalizedTier}&billing=${normalizedBillingPeriod}`
        };
    }

    if (!customerId) {
        const customer = await stripe.customers.create({
            email: session.user.email,
            name: user?.name || undefined,
            metadata: {
                organizationId,
                userId: user?.id || ''
            }
        });
        customerId = customer.id;

        if (subscription) {
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { stripeCustomerId: customerId }
            });
        }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
            price: priceId,
            quantity: 1
        }],
        subscription_data: {
            trial_period_days: subscription?.status === 'TRIALING' ? undefined : 14,
            metadata: {
                organizationId,
                tier: normalizedTier,
                billingPeriod: normalizedBillingPeriod
            }
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
            address: 'auto',
            name: 'auto'
        },
        tax_id_collection: {
            enabled: true
        },
        metadata: {
            organizationId,
            tier: normalizedTier,
            billingPeriod: normalizedBillingPeriod
        }
    });

    return { url: checkoutSession.url };
}

// GET handler - redirect directly to Stripe checkout
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tier = searchParams.get('tier') || searchParams.get('plan');
        const billingPeriod = searchParams.get('billing') || 'monthly';
        const organizationId = searchParams.get('organizationId') || undefined;

        if (!tier) {
            return NextResponse.redirect(new URL('/dashboard/billing/plans', req.url));
        }

        const result = await createCheckoutSession(req, tier, billingPeriod, organizationId);

        if ('error' in result) {
            // Redirect to billing page with error
            const errorUrl = new URL('/dashboard/billing', req.url);
            errorUrl.searchParams.set('error', result.error || 'checkout_failed');
            return NextResponse.redirect(errorUrl);
        }

        if (result.url) {
            return NextResponse.redirect(result.url);
        }

        return NextResponse.redirect(new URL('/dashboard/billing?error=checkout_failed', req.url));

    } catch (error) {
        console.error('Checkout GET error:', error);
        return NextResponse.redirect(new URL('/dashboard/billing?error=checkout_failed', req.url));
    }
}

// POST handler - return JSON with checkout URL
export async function POST(req: NextRequest) {
    try {
        const { tier, billingPeriod = 'monthly', organizationId } = await req.json();

        const result = await createCheckoutSession(req, tier, billingPeriod, organizationId);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({ url: result.url });

    } catch (error) {
        console.error('Checkout POST error:', error);
        return NextResponse.json(
            { error: 'Errore durante il checkout' },
            { status: 500 }
        );
    }
}
