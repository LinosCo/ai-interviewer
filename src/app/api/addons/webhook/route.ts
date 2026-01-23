import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getAddOnById } from '@/config/addons';
import { AddOnType } from '@prisma/client';

/**
 * POST /api/addons/webhook
 * Handle Stripe webhook for add-on purchases
 */
export async function POST(request: Request) {
    try {
        const webhookSecret = process.env.STRIPE_ADDON_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('STRIPE_ADDON_WEBHOOK_SECRET is not configured');
            return NextResponse.json(
                { error: 'Webhook not configured' },
                { status: 500 }
            );
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            console.error('STRIPE_SECRET_KEY is not configured');
            return NextResponse.json(
                { error: 'Stripe not configured' },
                { status: 500 }
            );
        }

        const body = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature) {
            return NextResponse.json(
                { error: 'Missing stripe-signature header' },
                { status: 400 }
            );
        }

        // Dynamic import to avoid build-time initialization
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-12-15.clover'
        });

        let event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err: any) {
            console.error('Webhook signature verification failed:', err.message);
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 400 }
            );
        }

        // Handle checkout.session.completed for add-on purchases
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            await handleCheckoutCompleted(session);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook handler failed' },
            { status: 500 }
        );
    }
}

async function handleCheckoutCompleted(session: any) {
    const metadata = session.metadata;

    if (!metadata?.organizationId || !metadata?.addOnId) {
        console.log('Not an add-on purchase, skipping');
        return;
    }

    const { organizationId, addOnId, addOnType, quantity } = metadata;

    // Get add-on package details
    const addOnPackage = getAddOnById(addOnId);
    if (!addOnPackage) {
        console.error('Add-on package not found:', addOnId);
        return;
    }

    // Get the organization's subscription
    const subscription = await prisma.subscription.findUnique({
        where: { organizationId }
    });

    if (!subscription) {
        console.error('Subscription not found for organization:', organizationId);
        return;
    }

    const quantityNum = parseInt(quantity || '0', 10);

    // Calculate expiration (end of current month or null for non-expiring)
    const expiresAt = ['TOKENS', 'EXTRA_USERS'].includes(addOnType)
        ? null // Tokens and Users don't expire
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    // Create purchased add-on record
    await prisma.purchasedAddOn.create({
        data: {
            subscriptionId: subscription.id,
            type: addOnType as AddOnType,
            stripePaymentIntentId: session.payment_intent as string,
            stripePriceId: addOnPackage.stripePriceId,
            quantity: quantityNum,
            remaining: quantityNum,
            amountPaid: addOnPackage.price,
            expiresAt
        }
    });

    // If it's a EXTRA_USERS add-on, update subscription extra users
    if (addOnType === 'EXTRA_USERS') {
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                extraUsers: { increment: quantityNum }
            }
        });
    }

    // If it's TOKENS, also update extra tokens in subscription
    if (addOnType === 'TOKENS') {
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                extraTokens: { increment: quantityNum }
            }
        });
    }

    console.log(`Add-on purchased: ${addOnId} (${quantityNum}) for org ${organizationId}`);
}
