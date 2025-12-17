import { prisma } from '@/lib/prisma';
import { getStripe, PRICING_PLANS, PlanKey } from '@/lib/stripe';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { headers } from 'next/headers';
import type Stripe from 'stripe';

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
        return new Response('Missing signature', { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = getStripe().webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log('Stripe webhook received:', event.type);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutCompleted(session);
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object;
                await handleInvoicePaid(invoice);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                await handlePaymentFailed(invoice);
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

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return new Response('OK', { status: 200 });

    } catch (error: any) {
        console.error('Webhook handler error:', error);
        return new Response(`Webhook Error: ${error.message}`, { status: 500 });
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const organizationId = session.metadata?.organizationId;
    const tier = session.metadata?.tier as PlanKey;

    if (!organizationId || !tier) {
        console.error('Missing metadata in checkout session');
        return;
    }

    const limits = PRICING_PLANS[tier].features;

    await prisma.subscription.update({
        where: { organizationId },
        data: {
            tier: tier as SubscriptionTier,
            status: 'ACTIVE',
            stripeSubscriptionId: session.subscription as string,
            stripePriceId: PRICING_PLANS[tier].priceId || undefined,
            maxActiveBots: limits.maxActiveBots,
            maxInterviewsPerMonth: limits.maxInterviewsPerMonth,
            maxUsers: limits.maxUsers
        }
    });

    console.log(`Subscription activated for org ${organizationId}: ${tier}`);
}

async function handleInvoicePaid(invoice: any) {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    // Find subscription by Stripe ID
    const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId }
    });

    if (!subscription) {
        console.error('Subscription not found for invoice:', invoice.id);
        return;
    }

    // Save invoice record
    await prisma.invoice.upsert({
        where: { stripeInvoiceId: invoice.id },
        update: {
            status: invoice.status || 'paid',
            amountPaid: invoice.amount_paid,
            pdfUrl: invoice.invoice_pdf
        },
        create: {
            subscriptionId: subscription.id,
            stripeInvoiceId: invoice.id,
            amountPaid: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status || 'paid',
            pdfUrl: invoice.invoice_pdf
        }
    });

    // Reset monthly usage on new billing period
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
            status: 'ACTIVE',
            interviewsUsedThisMonth: 0,
            currentPeriodStart: now,
            currentPeriodEnd: endOfMonth
        }
    });

    console.log(`Invoice paid and usage reset for subscription ${subscription.id}`);
}

async function handlePaymentFailed(invoice: any) {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'PAST_DUE' }
    });

    console.log(`Payment failed for subscription ${subscriptionId}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id }
    });

    if (!dbSubscription) return;

    let status: SubscriptionStatus = 'ACTIVE';
    if (subscription.status === 'past_due') status = 'PAST_DUE';
    if (subscription.status === 'canceled') status = 'CANCELED';
    if (subscription.status === 'trialing') status = 'TRIALING';

    await prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: { status }
    });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const limits = PRICING_PLANS.FREE.features;

    await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
            tier: 'FREE',
            status: 'CANCELED',
            canceledAt: new Date(),
            stripeSubscriptionId: null,
            stripePriceId: null,
            maxActiveBots: limits.maxActiveBots,
            maxInterviewsPerMonth: limits.maxInterviewsPerMonth,
            maxUsers: limits.maxUsers
        }
    });

    console.log(`Subscription ${subscription.id} canceled, reverted to FREE`);
}
