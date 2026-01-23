import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';
import { PLANS, PlanType } from '@/config/plans';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const { tier, billingPeriod = 'monthly' } = await req.json();

        // Valida tier
        const plan = PLANS[tier as PlanType];
        if (!plan || plan.monthlyPrice === 0) {
            return NextResponse.json({ error: 'Piano non valido' }, { status: 400 });
        }

        // Ottieni subscription esistente
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                subscription: {
                                    select: {
                                        id: true,
                                        status: true,
                                        stripeCustomerId: true
                                    }
                                }
                            }
                        }
                    },
                    take: 1
                }
            }
        });

        const subscription = user?.memberships[0]?.organization?.subscription;
        const organizationId = user?.memberships[0]?.organizationId;

        if (!organizationId) {
            return NextResponse.json({ error: 'Organizzazione non trovata' }, { status: 404 });
        }

        // Determina price ID
        const priceId = billingPeriod === 'yearly'
            ? plan.stripePriceIdYearly
            : plan.stripePriceIdMonthly;

        if (!priceId) {
            return NextResponse.json({ error: 'Prezzo non configurato' }, { status: 500 });
        }

        // Crea o recupera Stripe customer
        const stripe = await getStripeClient();
        let customerId = subscription?.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: session.user.email,
                name: user?.name || undefined,
                metadata: {
                    organizationId,
                    userId: user?.id || ''
                }
            });
            customerId = customer.id;

            // Salva customer ID
            if (subscription) {
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { stripeCustomerId: customerId }
                });
            }
        }

        // Crea checkout session
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1
            }],
            subscription_data: {
                trial_period_days: subscription?.status === 'TRIALING' ? undefined : 14,
                metadata: {
                    organizationId,
                    tier
                }
            },
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            customer_update: {
                address: 'auto',
                name: 'auto'
            },
            tax_id_collection: {
                enabled: true
            },
            metadata: {
                organizationId,
                tier,
                billingPeriod
            }
        });

        return NextResponse.json({ url: checkoutSession.url });

    } catch (error) {
        console.error('Checkout error:', error);
        return NextResponse.json(
            { error: 'Errore durante il checkout' },
            { status: 500 }
        );
    }
}
