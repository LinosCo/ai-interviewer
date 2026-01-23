import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { ADD_ONS, getAddOnsForTier, getAddOnById } from '@/config/addons';
import { subscriptionTierToPlanType, PLANS } from '@/config/plans';

/**
 * GET /api/addons
 * Ottiene gli add-on disponibili per l'organizzazione corrente
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's organization
        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id },
            include: {
                organization: {
                    include: { subscription: true }
                }
            }
        });

        if (!membership?.organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const org = membership.organization;
        const tier = org.subscription?.tier || 'FREE';

        // Get available add-ons for this tier
        const availableAddOns = getAddOnsForTier(tier);

        // Get purchased add-ons (via subscription)
        const purchasedAddOns = org.subscription
            ? await prisma.purchasedAddOn.findMany({
                where: {
                    subscriptionId: org.subscription.id,
                    remaining: { gt: 0 },
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } }
                    ]
                },
                orderBy: { purchasedAt: 'desc' }
            })
            : [];

        return NextResponse.json({
            available: availableAddOns,
            purchased: purchasedAddOns,
            tier
        });

    } catch (error) {
        console.error('Error fetching add-ons:', error);
        return NextResponse.json(
            { error: 'Failed to fetch add-ons' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/addons
 * Acquista un add-on (crea Stripe checkout session)
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { addOnId, quantity = 1 } = body;

        if (!addOnId) {
            return NextResponse.json(
                { error: 'addOnId is required' },
                { status: 400 }
            );
        }

        // Get add-on package
        const addOnPackage = getAddOnById(addOnId);
        if (!addOnPackage) {
            return NextResponse.json(
                { error: 'Add-on not found' },
                { status: 404 }
            );
        }

        // Get user's organization
        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id },
            include: {
                organization: {
                    include: { subscription: true }
                }
            }
        });

        if (!membership?.organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const org = membership.organization;
        const tier = org.subscription?.tier || 'FREE';

        // Check if add-on is available for this tier
        if (!addOnPackage.availableForTiers.includes(tier)) {
            return NextResponse.json(
                { error: 'Add-on not available for your subscription tier' },
                { status: 403 }
            );
        }

        // Check for Stripe price ID
        if (!addOnPackage.stripePriceId) {
            return NextResponse.json(
                { error: 'Add-on not configured for purchase' },
                { status: 400 }
            );
        }

        // Create Stripe checkout session
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        const checkoutSession = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: addOnPackage.stripePriceId,
                    quantity: quantity
                }
            ],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?addon_success=true&addon=${addOnId}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?addon_canceled=true`,
            customer_email: session.user.email || undefined,
            metadata: {
                organizationId: org.id,
                addOnId: addOnPackage.id,
                addOnType: addOnPackage.type,
                quantity: (addOnPackage.quantity * quantity).toString(),
                userId: session.user.id
            }
        });

        return NextResponse.json({
            checkoutUrl: checkoutSession.url,
            sessionId: checkoutSession.id
        });

    } catch (error) {
        console.error('Error creating add-on checkout:', error);
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
