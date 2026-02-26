import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getStripeClient, getStripePriceIdForPlan } from '@/lib/stripe';
import { PLANS, PlanType, PURCHASABLE_PLANS, subscriptionTierToPlanType } from '@/config/plans';
import { BillingCycle, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import Stripe from 'stripe';

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

function resolveChangeType(params: {
    targetPlan: PlanType;
    targetBilling: 'monthly' | 'yearly';
    currentPlan: PlanType;
    currentBilling: 'monthly' | 'yearly';
}): 'upgrade' | 'downgrade' | 'same' {
    const targetValue = getPlanComparablePrice(params.targetPlan, params.targetBilling);
    const currentValue = getPlanComparablePrice(params.currentPlan, params.currentBilling);
    if (targetValue > currentValue) return 'upgrade';
    if (targetValue < currentValue) return 'downgrade';
    return 'same';
}

async function findPrimaryCustomerSubscription(stripe: Stripe, customerId: string, organizationId: string) {
    const list = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20
    });

    const activeLike = list.data.filter((s) =>
        ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(s.status) &&
        ((s.metadata?.organizationId && s.metadata.organizationId === organizationId) ||
            // Backward compatibility: older subscriptions might miss metadata.
            !s.metadata?.organizationId)
    );
    const sorted = [...activeLike].sort((a, b) => (b.created || 0) - (a.created || 0));
    return {
        primary: sorted[0] || null,
        extras: sorted.slice(1)
    };
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
                                    tier: true,
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
    const currentPlan = subscription?.status === SubscriptionStatus.TRIALING
        ? PlanType.TRIAL
        : (subscription?.tier
            ? subscriptionTierToPlanType(subscription.tier)
            : ((membership?.organization?.plan as PlanType) || PlanType.FREE));

    if (!organizationId) {
        return { error: 'Organizzazione non trovata', status: 404 };
    }

    const stripe = await getStripeClient();
    let customerId = subscription?.stripeCustomerId;

    const currentBillingPeriod: 'monthly' | 'yearly' =
        (membership?.organization?.billingCycle || BillingCycle.MONTHLY) === BillingCycle.YEARLY
            ? 'yearly'
            : 'monthly';

    // Prefer existing customer subscription to avoid creating duplicates.
    let existingStripeSubscriptionId = subscription?.stripeSubscriptionId || null;
    if (customerId && !existingStripeSubscriptionId) {
        const discovered = await findPrimaryCustomerSubscription(stripe, customerId, organizationId);
        if (discovered.primary) {
            existingStripeSubscriptionId = discovered.primary.id;
            if (subscription) {
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { stripeSubscriptionId: discovered.primary.id }
                });
            }
        }
    }

    // If org already has an active Stripe subscription, perform in-place plan/cycle change
    if (existingStripeSubscriptionId) {
        const stripeSubscription = await stripe.subscriptions.retrieve(existingStripeSubscriptionId);
        const currentItem = stripeSubscription.items.data[0];

        if (!currentItem) {
            return { error: 'Subscription Stripe non valida', status: 500 };
        }

        const changeType = resolveChangeType({
            targetPlan: normalizedTier,
            targetBilling: normalizedBillingPeriod,
            currentPlan,
            currentBilling: currentBillingPeriod
        });

        // Upgrade: invoice prorated difference now.
        // Downgrade: keep proration credits for upcoming invoices.
        const prorationBehavior: Stripe.SubscriptionUpdateParams.ProrationBehavior =
            changeType === 'upgrade' ? 'always_invoice' : 'create_prorations';

        await stripe.subscriptions.update(existingStripeSubscriptionId, {
            items: [
                {
                    id: currentItem.id,
                    price: priceId
                }
            ],
            cancel_at_period_end: false,
            billing_cycle_anchor: 'unchanged',
            proration_behavior: prorationBehavior,
            metadata: {
                organizationId,
                tier: normalizedTier,
                billingPeriod: normalizedBillingPeriod,
                changeType
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
            prisma.subscription.upsert({
                where: { organizationId },
                update: {
                    tier: planTierToSubscriptionTier(normalizedTier),
                    status: SubscriptionStatus.ACTIVE,
                    stripeSubscriptionId: existingStripeSubscriptionId,
                    stripePriceId: priceId,
                    stripeCustomerId: typeof stripeSubscription.customer === 'string'
                        ? stripeSubscription.customer
                        : (customerId || null)
                },
                create: {
                    organizationId,
                    tier: planTierToSubscriptionTier(normalizedTier),
                    status: SubscriptionStatus.ACTIVE,
                    stripeSubscriptionId: existingStripeSubscriptionId,
                    stripePriceId: priceId,
                    stripeCustomerId: typeof stripeSubscription.customer === 'string'
                        ? stripeSubscription.customer
                        : (customerId || null)
                }
            })
        ]);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
            console.error('[stripe/checkout] NEXT_PUBLIC_APP_URL is not set');
            return { error: 'Server misconfigured (missing app URL)', status: 500 };
        }
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
        console.error('[stripe/checkout] NEXT_PUBLIC_APP_URL is not set');
        return { error: 'Server misconfigured (missing app URL)', status: 500 };
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
        success_url: `${appUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
            address: 'auto',
            name: 'auto'
        },
        tax_id_collection: {
            enabled: true
        },
        custom_fields: [
            {
                key: 'billing_sdi_pec',
                label: {
                    type: 'custom',
                    custom: 'Codice SDI o PEC (Italia)'
                },
                type: 'text',
                optional: true
            }
        ],
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
