import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';
import { PLANS, PlanType } from '@/config/plans';
import { redirect } from 'next/navigation';

// Helper function to create checkout session
async function createCheckoutSession(tier: string, billingPeriod: string = 'monthly') {
    const session = await auth();
    if (!session?.user?.email) {
        return { error: 'Non autorizzato', status: 401 };
    }

    const plan = PLANS[tier as PlanType];
    if (!plan || plan.monthlyPrice === 0) {
        return { error: 'Piano non valido', status: 400 };
    }

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
        return { error: 'Organizzazione non trovata', status: 404 };
    }

    const priceId = billingPeriod === 'yearly'
        ? plan.stripePriceIdYearly
        : plan.stripePriceIdMonthly;

    if (!priceId) {
        return { error: 'Prezzo non configurato', status: 500 };
    }

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

        if (subscription) {
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { stripeCustomerId: customerId }
            });
        }
    }

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

    return { url: checkoutSession.url };
}

// GET handler - redirect directly to Stripe checkout
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tier = searchParams.get('tier');
        const billingPeriod = searchParams.get('billing') || 'monthly';

        if (!tier) {
            return NextResponse.redirect(new URL('/dashboard/billing/plans', req.url));
        }

        const result = await createCheckoutSession(tier, billingPeriod);

        if ('error' in result) {
            // Redirect to billing page with error
            const errorUrl = new URL('/dashboard/billing', req.url);
            errorUrl.searchParams.set('error', result.error || 'checkout_failed');
            return NextResponse.redirect(errorUrl);
        }

        if (result.url) {
            return NextResponse.redirect(result.url);
        }

        return NextResponse.redirect(new URL('/dashboard/billing?error=checkout_failed', req.url));

    } catch (error) {
        console.error('Checkout GET error:', error);
        return NextResponse.redirect(new URL('/dashboard/billing?error=checkout_failed', req.url));
    }
}

// POST handler - return JSON with checkout URL
export async function POST(req: NextRequest) {
    try {
        const { tier, billingPeriod = 'monthly' } = await req.json();

        const result = await createCheckoutSession(tier, billingPeriod);

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({ url: result.url });

    } catch (error) {
        console.error('Checkout POST error:', error);
        return NextResponse.json(
            { error: 'Errore durante il checkout' },
            { status: 500 }
        );
    }
}
