import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getAddOnById } from '@/config/addons';
import { AddOnType } from '@prisma/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover'
});

const webhookSecret = process.env.STRIPE_ADDON_WEBHOOK_SECRET!;

/**
 * POST /api/addons/webhook
 * Handle Stripe webhook for add-on purchases
 */
export async function POST(request: Request) {
    try {
        const body = await request.text();
        const signature = request.headers.get('stripe-signature');

        if (!signature) {
            return NextResponse.json(
                { error: 'Missing stripe-signature header' },
                { status: 400 }
            );
        }

        let event: Stripe.Event;

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
            const session = event.data.object as Stripe.Checkout.Session;
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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

    const quantityNum = parseInt(quantity || '0', 10);

    // Calculate expiration (end of current month or null for non-expiring)
    const expiresAt = ['TOKENS', 'USERS'].includes(addOnType)
        ? null // Tokens and Users don't expire
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    // Create purchased add-on record
    await prisma.purchasedAddOn.create({
        data: {
            organizationId,
            addOnId,
            type: addOnType as AddOnType,
            quantity: quantityNum,
            remaining: quantityNum,
            price: addOnPackage.price,
            stripePaymentId: session.payment_intent as string,
            expiresAt
        }
    });

    // If it's a USERS add-on, update subscription extra users
    if (addOnType === 'USERS') {
        await prisma.subscription.updateMany({
            where: { organizationId },
            data: {
                extraUsers: { increment: quantityNum }
            }
        });
    }

    // If it's TOKENS, also update purchased tokens in subscription
    if (addOnType === 'TOKENS') {
        await prisma.subscription.updateMany({
            where: { organizationId },
            data: {
                purchasedTokens: { increment: quantityNum }
            }
        });
    }

    console.log(`Add-on purchased: ${addOnId} (${quantityNum}) for org ${organizationId}`);
}
