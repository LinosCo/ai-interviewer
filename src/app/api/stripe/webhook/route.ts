import { prisma } from '@/lib/prisma';
import { getStripeClient, getPricingPlans, PlanKey } from '@/lib/stripe';
import { upgradeSubscription } from '@/lib/usage';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sendSystemNotification } from '@/lib/email';

export async function POST(req: Request) {
    const body = await req.text();
    const signature = (await headers()).get('Stripe-Signature');

    if (!signature) {
        return new NextResponse('Missing signature', { status: 400 });
    }

    const stripe = await getStripeClient();
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
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

    const plans = await getPricingPlans();
    const limits = plans[tier].features;

    // Extract custom fields
    const sdiCode = session.custom_fields?.find(f => f.key === 'sdi_code')?.text?.value;
    const pecEmail = session.custom_fields?.find(f => f.key === 'pec_email')?.text?.value;

    // Extract Tax ID (VAT / Codice Fiscale)
    const taxIds = session.customer_details?.tax_ids || [];
    const vatId = taxIds.find(t => (t.type as string) === 'it_vat')?.value;
    const fiscalCode = taxIds.find(t => (t.type as string) === 'it_fiscal_code')?.value;

    await prisma.subscription.update({
        where: { organizationId },
        data: {
            tier: tier,
            status: 'ACTIVE',
            stripeSubscriptionId: session.subscription as string,
            stripePriceId: plans[tier].priceId || undefined,
            maxActiveBots: limits.maxActiveBots,
            maxInterviewsPerMonth: limits.maxInterviewsPerMonth,
            maxUsers: limits.maxUsers,
            sdiCode: sdiCode || undefined,
            pecEmail: pecEmail || undefined,
            vatNumber: vatId || undefined,
            codiceFiscale: fiscalCode || undefined
        } as any
    });


    await sendSystemNotification(
        'Nuovo Abbonamento Attivato',
        `<p>L'organizzazione <b>${organizationId}</b> ha attivato il piano <b>${tier}</b>.</p>
         <p>Stripe Subscription ID: ${session.subscription}</p>`
    );

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
    const plans = await getPricingPlans();

    // We need to find which org this subscription belonged to
    const dbSubscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscription.id }
    });

    if (dbSubscription) {
        const limits = plans.FREE.features;

        await prisma.subscription.update({
            where: { id: dbSubscription.id },
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
    } else {
        console.log(`Subscription ${subscription.id} deleted but not found in DB`);
    }
}
