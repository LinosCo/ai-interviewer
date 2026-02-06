import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { PlanType, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';
import { CreditService } from '@/services/creditService';
import { PLANS } from '@/config/plans';

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = (await headers()).get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        return NextResponse.json({ error: 'Missing Stripe webhook configuration' }, { status: 400 });
    }

    const stripe = await getStripeClient();
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    try {
        await prisma.stripeWebhookEvent.create({
            data: {
                eventId: event.id,
                eventType: event.type,
                payload: event
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
                    await handleCreditPackCheckout(session);
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

async function handleCreditPackCheckout(session: Stripe.Checkout.Session) {
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

    await CreditService.addPackCredits(
        organizationId,
        creditsAmount,
        packType,
        userId,
        stripePaymentRef
    );
}

async function handleSubscriptionCreated(session: Stripe.Checkout.Session, stripe: Stripe) {
    const { organizationId, tier } = session.metadata || {};
    const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

    if (!organizationId || !tier || !stripeSubscriptionId) {
        return;
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    const planType = mapTierToPlanType(tier);
    const planConfig = PLANS[planType] || PLANS[PlanType.FREE];

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
            data: {
                plan: planType,
                monthlyCreditsLimit: BigInt(planConfig.monthlyCredits)
            }
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
        incomplete: SubscriptionStatus.INCOMPLETE,
        paused: SubscriptionStatus.PAUSED,
        unpaid: SubscriptionStatus.PAST_DUE
    };

    await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
            status: statusMap[stripeSubscription.status] || SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            canceledAt: stripeSubscription.canceled_at
                ? new Date(stripeSubscription.canceled_at * 1000)
                : null
        }
    });
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
                monthlyCreditsLimit: BigInt(trialPlan.monthlyCredits)
            }
        })
    ]);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
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
    const stripeSubscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
    if (!stripeSubscriptionId) return;

    await prisma.subscription.updateMany({
        where: { stripeSubscriptionId },
        data: { status: SubscriptionStatus.PAST_DUE }
    });
}

function mapTierToPlanType(tier: string): PlanType {
    const t = tier.toUpperCase();
    if (t === 'STARTER') return PlanType.STARTER;
    if (t === 'PRO') return PlanType.PRO;
    if (t === 'BUSINESS') return PlanType.BUSINESS;
    return PlanType.TRIAL;
}

function mapTierToSubscriptionTier(tier: string): SubscriptionTier {
    const t = tier.toUpperCase();
    if (t === 'STARTER') return SubscriptionTier.STARTER;
    if (t === 'PRO') return SubscriptionTier.PRO;
    if (t === 'BUSINESS') return SubscriptionTier.BUSINESS;
    if (t === 'ENTERPRISE') return SubscriptionTier.ENTERPRISE;
    return SubscriptionTier.FREE;
}
