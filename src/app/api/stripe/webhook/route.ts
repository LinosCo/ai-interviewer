import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { BillingCycle, PlanType, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';
import { CreditService } from '@/services/creditService';
import { PLANS } from '@/config/plans';

async function resolveStripeWebhookSecret(): Promise<string | null> {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
        return process.env.STRIPE_WEBHOOK_SECRET;
    }

    try {
        const globalConfig = await prisma.globalConfig.findUnique({
            where: { id: 'default' },
            select: { stripeWebhookSecret: true }
        });
        return globalConfig?.stripeWebhookSecret || null;
    } catch (error) {
        console.warn('[stripe/webhook] Failed to load webhook secret from GlobalConfig:', error);
        return null;
    }
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = (await headers()).get('stripe-signature');
    const webhookSecret = await resolveStripeWebhookSecret();

    if (!signature || !webhookSecret) {
        return NextResponse.json({ error: 'Missing Stripe webhook configuration' }, { status: 400 });
    }

    let stripe;
    try {
        stripe = await getStripeClient();
    } catch {
        console.error('Stripe not configured for webhook processing');
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    try {
        const eventPayload = JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;
        await prisma.stripeWebhookEvent.create({
            data: {
                eventId: event.id,
                eventType: event.type,
                payload: eventPayload
            }
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ received: true, duplicate: true });
        }
        console.error('Failed to persist webhook event:', error);
        return NextResponse.json({ error: 'Webhook persistence failed' }, { status: 500 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                if (session.metadata?.type === 'credit_pack') {
                    await handleCreditPackCheckout(session, stripe);
                } else if (session.mode === 'subscription') {
                    await handleSubscriptionCreated(session, stripe);
                }
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionCanceled(subscription);
                break;
            }
            case 'invoice.paid':
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaid(invoice);
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentFailed(invoice);
                break;
            }
            default:
                break;
        }

        await prisma.stripeWebhookEvent.update({
            where: { eventId: event.id },
            data: {
                processedAt: new Date(),
                processingError: null
            }
        });

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error('Webhook handler error:', error);

        await prisma.stripeWebhookEvent.update({
            where: { eventId: event.id },
            data: {
                processingError: error?.message || 'Unknown webhook error'
            }
        }).catch(() => null);

        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 500 }
        );
    }
}

async function handleCreditPackCheckout(session: Stripe.Checkout.Session, stripe: Stripe) {
    const { organizationId, packType, credits, userId } = session.metadata || {};

    if (!organizationId || !packType || !credits) {
        console.warn('[Stripe webhook] Missing credit pack metadata on session', session.id);
        return;
    }

    const creditsAmount = Number.parseInt(credits, 10);
    if (!Number.isFinite(creditsAmount) || creditsAmount <= 0) {
        console.warn('[Stripe webhook] Invalid credit pack amount on session', session.id);
        return;
    }

    const stripePaymentRef = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.id;

    const submittedSdiPec = getSubmittedSdiPec(session);
    if (submittedSdiPec && typeof session.customer === 'string') {
        await stripe.customers.update(session.customer, {
            metadata: {
                billing_sdi_pec: submittedSdiPec
            }
        }).catch(() => null);
    }

    await CreditService.addPackCredits(
        organizationId,
        creditsAmount,
        packType,
        userId,
        stripePaymentRef
    );
}

async function handleSubscriptionCreated(session: Stripe.Checkout.Session, stripe: Stripe) {
    const { organizationId, tier, billingPeriod } = session.metadata || {};
    const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

    if (!organizationId || !stripeSubscriptionId) {
        return;
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const submittedSdiPec = getSubmittedSdiPec(session);

    if (submittedSdiPec && typeof session.customer === 'string') {
        await stripe.customers.update(session.customer, {
            metadata: {
                billing_sdi_pec: submittedSdiPec
            }
        }).catch(() => null);
    }

    const priceId = stripeSubscription.items.data[0]?.price?.id || null;
    const inferredFromPrice = await resolvePlanAndCycleFromPriceId(priceId);
    const planType = tier
        ? mapTierToPlanType(tier)
        : inferredFromPrice.planType;
    const cycle = billingPeriod
        ? normalizeBillingCycle(billingPeriod)
        : inferredFromPrice.billingCycle;
    const orgUpdateData = await buildOrganizationPlanUpdate(organizationId, planType, cycle);

    await prisma.$transaction([
        prisma.subscription.upsert({
            where: { organizationId },
            update: {
                tier: mapTierToSubscriptionTier(tier),
                status: SubscriptionStatus.ACTIVE,
                stripeSubscriptionId: stripeSubscription.id,
                stripePriceId: stripeSubscription.items.data[0]?.price.id,
                stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
                currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
                currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
                trialEndsAt: (stripeSubscription as any).trial_end
                    ? new Date((stripeSubscription as any).trial_end * 1000)
                    : null,
                tokensUsedThisMonth: 0,
                interviewsUsedThisMonth: 0,
                chatbotSessionsUsedThisMonth: 0,
                visibilityQueriesUsedThisMonth: 0,
                aiSuggestionsUsedThisMonth: 0
            },
            create: {
                organizationId,
                tier: mapTierToSubscriptionTier(tier),
                status: SubscriptionStatus.ACTIVE,
                stripeSubscriptionId: stripeSubscription.id,
                stripePriceId: stripeSubscription.items.data[0]?.price.id,
                stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
                currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
                currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
                trialEndsAt: (stripeSubscription as any).trial_end
                    ? new Date((stripeSubscription as any).trial_end * 1000)
                    : null
            }
        }),
        prisma.organization.update({
            where: { id: organizationId },
            data: orgUpdateData
        })
    ]);
}

async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
    const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: stripeSubscription.id }
    });

    if (!subscription) return;

    const statusMap: Record<string, SubscriptionStatus> = {
        active: SubscriptionStatus.ACTIVE,
        trialing: SubscriptionStatus.TRIALING,
        past_due: SubscriptionStatus.PAST_DUE,
        canceled: SubscriptionStatus.CANCELED,
        incomplete: SubscriptionStatus.PAST_DUE,
        incomplete_expired: SubscriptionStatus.CANCELED,
        paused: SubscriptionStatus.PAST_DUE,
        unpaid: SubscriptionStatus.PAST_DUE
    };

    const priceId = stripeSubscription.items.data[0]?.price?.id || null;
    const { planType, billingCycle } = await resolvePlanAndCycleFromPriceId(priceId);
    const orgUpdateData = await buildOrganizationPlanUpdate(subscription.organizationId, planType, billingCycle);

    await prisma.$transaction([
        prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                tier: mapTierToSubscriptionTier(planType),
                stripePriceId: priceId,
                status: statusMap[stripeSubscription.status] || SubscriptionStatus.ACTIVE,
                currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
                currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
                canceledAt: stripeSubscription.canceled_at
                    ? new Date(stripeSubscription.canceled_at * 1000)
                    : null
            }
        }),
        prisma.organization.update({
            where: { id: subscription.organizationId },
            data: orgUpdateData
        })
    ]);
}

async function handleSubscriptionCanceled(stripeSubscription: Stripe.Subscription) {
    const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: stripeSubscription.id }
    });

    if (!subscription) return;

    const trialPlan = PLANS[PlanType.TRIAL] || PLANS[PlanType.FREE];

    await prisma.$transaction([
        prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: SubscriptionStatus.CANCELED,
                tier: SubscriptionTier.FREE,
                canceledAt: new Date()
            }
        }),
        prisma.organization.update({
            where: { id: subscription.organizationId },
            data: {
                plan: PlanType.TRIAL,
                billingCycle: BillingCycle.MONTHLY,
                monthlyCreditsLimit: BigInt(trialPlan.monthlyCredits)
            }
        })
    ]);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
    if (!stripeSubscriptionId) return;

    await prisma.subscription.updateMany({
        where: { stripeSubscriptionId },
        data: {
            status: SubscriptionStatus.ACTIVE,
            tokensUsedThisMonth: 0,
            interviewsUsedThisMonth: 0,
            chatbotSessionsUsedThisMonth: 0,
            visibilityQueriesUsedThisMonth: 0,
            aiSuggestionsUsedThisMonth: 0,
            interviewTokensUsed: 0,
            chatbotTokensUsed: 0,
            visibilityTokensUsed: 0,
            suggestionTokensUsed: 0,
            systemTokensUsed: 0
        }
    });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
    if (!stripeSubscriptionId) return;

    await prisma.subscription.updateMany({
        where: { stripeSubscriptionId },
        data: { status: SubscriptionStatus.PAST_DUE }
    });
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const rawSubscription =
        (invoice as any)?.subscription ??
        (invoice as any)?.parent?.subscription_details?.subscription ??
        null;

    if (typeof rawSubscription === 'string') return rawSubscription;
    if (rawSubscription && typeof rawSubscription.id === 'string') return rawSubscription.id;
    return null;
}

function mapTierToPlanType(tier: string): PlanType {
    const t = tier.toUpperCase();
    if (t === 'STARTER') return PlanType.STARTER;
    if (t === 'PRO') return PlanType.PRO;
    if (t === 'BUSINESS') return PlanType.BUSINESS;
    if (t === 'PARTNER') return PlanType.PARTNER;
    if (t === 'ENTERPRISE') return PlanType.ENTERPRISE;
    return PlanType.TRIAL;
}

function getSubmittedSdiPec(session: Stripe.Checkout.Session): string | null {
    const fields = (session as any)?.custom_fields;
    if (!Array.isArray(fields)) return null;
    const field = fields.find((f: any) => f?.key === 'billing_sdi_pec');
    const value = field?.text?.value;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeBillingCycle(value: string): BillingCycle {
    return value?.toLowerCase() === 'yearly' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
}

async function resolvePlanAndCycleFromPriceId(priceId?: string | null): Promise<{
    planType: PlanType;
    billingCycle: BillingCycle;
}> {
    if (!priceId) {
        return { planType: PlanType.TRIAL, billingCycle: BillingCycle.MONTHLY };
    }

    const globalConfig = await prisma.globalConfig.findUnique({
        where: { id: 'default' },
        select: {
            stripePriceStarter: true,
            stripePriceStarterYearly: true,
            stripePricePro: true,
            stripePriceProYearly: true,
            stripePriceBusiness: true,
            stripePriceBusinessYearly: true,
            stripePricePartner: true,
            stripePricePartnerYearly: true,
            stripePriceEnterprise: true,
            stripePriceEnterpriseYearly: true,
        }
    }).catch(() => null);

    const plansToCheck = [PlanType.STARTER, PlanType.PRO, PlanType.BUSINESS, PlanType.PARTNER, PlanType.ENTERPRISE];
    for (const planType of plansToCheck) {
        const plan = PLANS[planType];
        const monthlyId =
            (planType === PlanType.STARTER ? globalConfig?.stripePriceStarter : null) ||
            (planType === PlanType.PRO ? globalConfig?.stripePricePro : null) ||
            (planType === PlanType.BUSINESS ? globalConfig?.stripePriceBusiness : null) ||
            (planType === PlanType.PARTNER ? globalConfig?.stripePricePartner : null) ||
            (planType === PlanType.ENTERPRISE ? globalConfig?.stripePriceEnterprise : null) ||
            plan.stripePriceIdMonthly;

        const yearlyId =
            (planType === PlanType.STARTER ? globalConfig?.stripePriceStarterYearly : null) ||
            (planType === PlanType.PRO ? globalConfig?.stripePriceProYearly : null) ||
            (planType === PlanType.BUSINESS ? globalConfig?.stripePriceBusinessYearly : null) ||
            (planType === PlanType.PARTNER ? globalConfig?.stripePricePartnerYearly : null) ||
            (planType === PlanType.ENTERPRISE ? globalConfig?.stripePriceEnterpriseYearly : null) ||
            plan.stripePriceIdYearly;

        if (monthlyId && monthlyId === priceId) {
            return { planType, billingCycle: BillingCycle.MONTHLY };
        }
        if (yearlyId && yearlyId === priceId) {
            return { planType, billingCycle: BillingCycle.YEARLY };
        }
    }

    return { planType: PlanType.TRIAL, billingCycle: BillingCycle.MONTHLY };
}

async function buildOrganizationPlanUpdate(
    organizationId: string,
    planType: PlanType,
    billingCycle: BillingCycle
): Promise<Prisma.OrganizationUpdateInput> {
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            customLimits: true
        }
    });

    const existingCustomLimits =
        typeof organization?.customLimits === 'object' && organization.customLimits !== null
            ? (organization.customLimits as Record<string, unknown>)
            : {};
    const hasCustomMonthlyLimit = existingCustomLimits.monthlyCreditsLimitCustom === true;
    const planConfig = PLANS[planType] || PLANS[PlanType.FREE];

    const data: Prisma.OrganizationUpdateInput = {
        plan: planType,
        billingCycle
    };

    if (!hasCustomMonthlyLimit) {
        data.monthlyCreditsLimit = BigInt(planConfig.monthlyCredits);
        data.customLimits = {
            ...existingCustomLimits,
            monthlyCreditsLimitCustom: false
        };
    }
    return data;
}

function mapTierToSubscriptionTier(tier: PlanType): SubscriptionTier;
function mapTierToSubscriptionTier(tier: string): SubscriptionTier;
function mapTierToSubscriptionTier(tier: string | PlanType): SubscriptionTier {
    const t = tier.toUpperCase();
    if (t === 'STARTER') return SubscriptionTier.STARTER;
    if (t === 'PRO') return SubscriptionTier.PRO;
    if (t === 'BUSINESS') return SubscriptionTier.BUSINESS;
    if (t === 'PARTNER') return SubscriptionTier.PARTNER;
    if (t === 'ENTERPRISE') return SubscriptionTier.ENTERPRISE;
    return SubscriptionTier.FREE;
}
