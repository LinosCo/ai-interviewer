import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';
import { PlanType, SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
    let event: Stripe.Event;

    try {
        const body = await req.text();
        const headerList = await headers();
        const signature = headerList.get('Stripe-Signature');

        if (!signature) {
            return new NextResponse('Missing Stripe signature', { status: 400 });
        }

        const stripe = await getStripeClient();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('Missing STRIPE_WEBHOOK_SECRET');
            return new NextResponse('Server configuration error', { status: 500 });
        }

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err: any) {
            console.error(`Webhook signature verification failed.`, err.message);
            return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutSessionCompleted(session, stripe);
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionDeleted(subscription);
                break;
            }
            case 'invoice.payment_succeeded': {
                // Could be used to extend subscription validity
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaymentSucceeded(invoice);
                break;
            }
            default:
            // console.log(`Unhandled event type ${event.type}`);
        }

        return new NextResponse(null, { status: 200 });

    } catch (error: any) {
        console.error('Webhook handler failed:', error);
        return new NextResponse(`Webhook handler failed: ${error.message}`, { status: 500 });
    }
}

// --- Handlers ---

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, stripe: Stripe) {
    if (!session.metadata?.organizationId || !session.metadata?.tier) {
        console.warn('Checkout session missing metadata', session.id);
        return;
    }

    const { organizationId, tier } = session.metadata;
    const subscriptionId = session.subscription as string;

    if (!subscriptionId) {
        console.warn('Checkout session missing subscription ID');
        return;
    }

    // Map Tier string to Enums
    const planType = mapTierToPlanType(tier);
    const subTier = mapTierToSubscriptionTier(tier);

    // Fetch subscription details to get period end
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

    // Update DB
    await prisma.$transaction([
        prisma.subscription.update({
            where: { organizationId },
            data: {
                stripeSubscriptionId: subscriptionId,
                stripeCustomerId: session.customer as string,
                status: SubscriptionStatus.ACTIVE,
                tier: subTier,
                currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            }
        }),
        prisma.organization.update({
            where: { id: organizationId },
            data: {
                plan: planType
            }
        })
    ]);

    console.log(`[Stripe] Activated subscription for Org ${organizationId} to ${tier}`);
}

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    // Find our subscription by stripe ID
    const dbSub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id }
    });

    if (!dbSub) return;

    // Map status
    const status = mapStripeStatusToEnum(stripeSub.status);

    await prisma.subscription.update({
        where: { id: dbSub.id },
        data: {
            status: status,
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000)
        }
    });

    // If past_due or canceled, logic to downgrade is in handleSubscriptionDeleted or separate job
    // But for immediate consistency:
    if (status === SubscriptionStatus.CANCELED || status === SubscriptionStatus.PAST_DUE) {
        // Optionally downgrade here or waiting for `deleted` event
        // `deleted` event is definitive for cancellation. `updated` to canceled is also valid.
    }
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const dbSub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id }
    });

    if (!dbSub) return;

    await prisma.$transaction([
        prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
                status: SubscriptionStatus.CANCELED,
                tier: SubscriptionTier.FREE
            }
        }),
        prisma.organization.update({
            where: { id: dbSub.organizationId },
            data: {
                plan: PlanType.TRIAL
            }
        })
    ]);

    console.log(`[Stripe] Subscription canceled/deleted for Org ${dbSub.organizationId}`);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    if (!invoice.subscription) return;

    // Just ensure dates are synced
    const dbSub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: invoice.subscription as string }
    });

    if (dbSub) {
        await prisma.subscription.update({
            where: { id: dbSub.id },
            data: {
                status: SubscriptionStatus.ACTIVE,
                // Period end is better taken from subscription object, but invoice has period_end too
            }
        });
    }
}

// --- Helpers ---

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

function mapStripeStatusToEnum(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
        case 'active': return SubscriptionStatus.ACTIVE;
        case 'trialing': return SubscriptionStatus.TRIALING;
        case 'past_due':
        case 'unpaid':
            return SubscriptionStatus.PAST_DUE;
        case 'canceled': return SubscriptionStatus.CANCELED;
        default: return SubscriptionStatus.ACTIVE; // Default safe fall back or handle incomplete
    }
}
