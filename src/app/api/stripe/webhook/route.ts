import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16'
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = (await headers()).get('stripe-signature')!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    try {
        switch (event.type) {
            // ═══════════════════════════════════════════════════════
            // SUBSCRIPTION EVENTS
            // ═══════════════════════════════════════════════════════

            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                // Add-on purchase
                if (session.metadata?.addOnId) {
                    await handleAddOnPurchase(session);
                }
                // Subscription purchase
                else if (session.mode === 'subscription') {
                    await handleSubscriptionCreated(session);
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

            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaid(invoice);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentFailed(invoice);
                break;
            }
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Webhook handler error:', error);
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════
// HANDLER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function handleSubscriptionCreated(session: Stripe.Checkout.Session) {
    const { organizationId, tier } = session.metadata || {};

    if (!organizationId || !tier) return;

    const stripeSubscription = await stripe.subscriptions.retrieve(
        session.subscription as string
    );

    await prisma.subscription.update({
        where: { organizationId },
        data: {
            tier: tier as any,
            status: 'ACTIVE',
            stripeSubscriptionId: stripeSubscription.id,
            stripePriceId: stripeSubscription.items.data[0]?.price.id,
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            trialEndsAt: stripeSubscription.trial_end
                ? new Date(stripeSubscription.trial_end * 1000)
                : null,
            // Reset contatori al cambio piano
            tokensUsedThisMonth: 0,
            interviewsUsedThisMonth: 0,
            chatbotSessionsUsedThisMonth: 0,
            visibilityQueriesUsedThisMonth: 0,
            aiSuggestionsUsedThisMonth: 0
        }
    });
}

async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
    const subscription = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: stripeSubscription.id }
    });

    if (!subscription) return;

    const statusMap: Record<string, any> = {
        active: 'ACTIVE',
        trialing: 'TRIALING',
        past_due: 'PAST_DUE',
        canceled: 'CANCELED',
        incomplete: 'INCOMPLETE',
        paused: 'PAUSED'
    };

    await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
            status: statusMap[stripeSubscription.status] || 'ACTIVE',
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            canceledAt: stripeSubscription.canceled_at
                ? new Date(stripeSubscription.canceled_at * 1000)
                : null
        }
    });
}

async function handleSubscriptionCanceled(stripeSubscription: Stripe.Subscription) {
    await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: stripeSubscription.id },
        data: {
            status: 'CANCELED',
            canceledAt: new Date()
        }
    });
}

async function handleAddOnPurchase(session: Stripe.Checkout.Session) {
    const { subscriptionId, addOnId, addOnType, quantity } = session.metadata || {};

    if (!subscriptionId || !addOnType || !quantity) return;

    const quantityNum = parseInt(quantity);

    // Crea record add-on
    await prisma.purchasedAddOn.create({
        data: {
            subscriptionId,
            type: addOnType as any,
            stripePaymentIntentId: session.payment_intent as string,
            quantity: quantityNum,
            remaining: quantityNum,
            amountPaid: session.amount_total || 0,
            currency: session.currency || 'eur',
            // Add-on non scadono (o scadono a fine mese per alcuni)
            expiresAt: null
        }
    });

    // Aggiorna contatori extra nella subscription
    const fieldMap: Record<string, string> = {
        TOKENS: 'extraTokens',
        INTERVIEWS: 'extraInterviews',
        CHATBOT_SESSIONS: 'extraChatbotSessions',
        VISIBILITY_QUERIES: 'extraVisibilityQueries',
        AI_SUGGESTIONS: 'extraAiSuggestions',
        EXTRA_USERS: 'extraUsers'
    };

    const field = fieldMap[addOnType];
    if (field) {
        await prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                [field]: { increment: quantityNum }
            }
        });
    }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
    // Reset contatori mensili quando la fattura viene pagata
    if (invoice.subscription) {
        const subscription = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: invoice.subscription as string }
        });

        if (subscription) {
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
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
    }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    if (invoice.subscription) {
        await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription as string },
            data: { status: 'PAST_DUE' }
        });
    }
}
