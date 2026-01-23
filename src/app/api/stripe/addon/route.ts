import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';
import { getAddOnById } from '@/config/addons';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const { addOnId } = await req.json();

        const addOn = getAddOnById(addOnId);
        if (!addOn) {
            return NextResponse.json({ error: 'Add-on non valido' }, { status: 400 });
        }

        // Ottieni subscription
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: { subscription: true }
                        }
                    },
                    take: 1
                }
            }
        });

        const subscription = user?.memberships[0]?.organization?.subscription;

        if (!subscription?.stripeCustomerId) {
            return NextResponse.json(
                { error: 'Devi prima attivare un abbonamento' },
                { status: 400 }
            );
        }

        // Verifica disponibilità per tier
        if (!addOn.availableForTiers.includes(subscription.tier)) {
            return NextResponse.json(
                { error: 'Add-on non disponibile per il tuo piano' },
                { status: 403 }
            );
        }

        // Crea checkout session per add-on
        const stripe = await getStripeClient();
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: subscription.stripeCustomerId,
            mode: addOn.recurring ? 'subscription' : 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price: addOn.stripePriceId,
                quantity: 1
            }],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?addon=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?addon=canceled`,
            metadata: {
                subscriptionId: subscription.id,
                addOnId: addOn.id,
                addOnType: addOn.type,
                quantity: addOn.quantity.toString()
            }
        });

        return NextResponse.json({ url: checkoutSession.url });

    } catch (error) {
        console.error('Add-on checkout error:', error);
        return NextResponse.json(
            { error: 'Errore durante l\'acquisto' },
            { status: 500 }
        );
    }
}
