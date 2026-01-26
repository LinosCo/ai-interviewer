/**
 * API Route: /api/credits/purchase
 *
 * POST: Avvia acquisto pack crediti (redirect a Stripe Checkout)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCreditPack, CREDIT_PACKS } from '@/config/creditPacks';
import { getStripeClient } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const body = await request.json();
        const { packType } = body;

        if (!packType) {
            return NextResponse.json(
                { error: 'packType richiesto' },
                { status: 400 }
            );
        }

        const pack = getCreditPack(packType);
        if (!pack) {
            return NextResponse.json(
                { error: 'Pack non trovato', availablePacks: CREDIT_PACKS.map(p => p.id) },
                { status: 400 }
            );
        }

        // Check for Stripe price ID
        if (!pack.stripePriceId) {
            return NextResponse.json(
                { error: 'Prezzo Stripe non configurato per questo pack' },
                { status: 503 }
            );
        }

        // Get Stripe client (will throw if not configured)
        let stripe;
        try {
            stripe = await getStripeClient();
        } catch {
            return NextResponse.json(
                { error: 'STRIPE_NOT_CONFIGURED', message: 'Stripe non configurato' },
                { status: 503 }
            );
        }

        // Get user's organization and subscription
        const membership = await prisma.organizationMember.findFirst({
            where: { userId: session.user.id },
            include: {
                organization: {
                    include: { subscription: true }
                }
            }
        });

        if (!membership?.organization) {
            return NextResponse.json(
                { error: 'Organizzazione non trovata' },
                { status: 404 }
            );
        }

        const org = membership.organization;
        let customerId = org.subscription?.stripeCustomerId;

        // Create Stripe customer if needed
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: session.user.email,
                name: org.name,
                metadata: {
                    organizationId: org.id,
                    userId: session.user.id
                }
            });
            customerId = customer.id;

            // Update or create subscription with customer ID
            if (org.subscription) {
                await prisma.subscription.update({
                    where: { id: org.subscription.id },
                    data: { stripeCustomerId: customerId }
                });
            } else {
                await prisma.subscription.create({
                    data: {
                        organizationId: org.id,
                        stripeCustomerId: customerId
                    }
                });
            }
        }

        // Create Stripe Checkout session
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: pack.stripePriceId,
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${baseUrl}/dashboard/billing?pack_success=true&pack=${packType}`,
            cancel_url: `${baseUrl}/dashboard/billing?pack_cancelled=true`,
            metadata: {
                userId: session.user.id,
                packType,
                credits: pack.credits.toString(),
                type: 'credit_pack'
            }
        });

        return NextResponse.json({
            success: true,
            checkoutUrl: checkoutSession.url
        });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json(
            { error: 'Errore nella creazione della sessione di pagamento' },
            { status: 500 }
        );
    }
}

/**
 * GET: Restituisce lista pack disponibili
 */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        return NextResponse.json({
            packs: CREDIT_PACKS.map(pack => ({
                id: pack.id,
                name: pack.name,
                credits: pack.credits,
                creditsFormatted: `${(pack.credits / 1_000_000).toFixed(0)}M`,
                price: pack.price,
                priceFormatted: `€${pack.price}`,
                pricePerMillion: pack.pricePerMillion,
                pricePerMillionFormatted: `€${pack.pricePerMillion.toFixed(2)}`
            }))
        });
    } catch (error) {
        console.error('Error fetching credit packs:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dei pack' },
            { status: 500 }
        );
    }
}
