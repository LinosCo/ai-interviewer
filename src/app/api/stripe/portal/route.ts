import { auth } from '@/auth';
import { getStripeClient } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organizationId');

        if (!organizationId) {
            return new NextResponse('Organization ID required', { status: 400 });
        }

        // Verify membership
        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId
                }
            },
            include: {
                organization: {
                    include: {
                        subscription: true
                    }
                }
            }
        });

        if (!membership) {
            return new NextResponse('Access Denied', { status: 403 });
        }

        const organization = membership.organization;
        let stripe;
        try {
            stripe = await getStripeClient();
        } catch (stripeErr) {
            // Stripe not configured - return friendly error
            console.error('Stripe not configured:', stripeErr);
            return NextResponse.json({
                error: 'STRIPE_NOT_CONFIGURED',
                message: 'Stripe non è ancora configurato. Contatta l\'amministratore.',
                redirect: '/dashboard/billing'
            }, { status: 503 });
        }

        const resolveCustomerId = async (): Promise<string> => {
            let customerId = organization.subscription?.stripeCustomerId || null;

            if (customerId) {
                try {
                    await stripe.customers.retrieve(customerId);
                    return customerId;
                } catch (error) {
                    const stripeErr = error as Stripe.StripeRawError & { code?: string; statusCode?: number };
                    const missingCustomer = stripeErr?.code === 'resource_missing' || stripeErr?.statusCode === 404;
                    if (!missingCustomer) throw error;
                    customerId = null;
                }
            }

            const customers = await stripe.customers.list({
                email: session.user.email!,
                limit: 1
            });

            if (customers.data.length > 0) {
                return customers.data[0].id;
            }

            const customer = await stripe.customers.create({
                email: session.user.email!,
                name: organization.name,
                metadata: {
                    organizationId: organization.id
                }
            });
            return customer.id;
        };

        const customerId = await resolveCustomerId();

        if (organization.subscription?.id && organization.subscription.stripeCustomerId !== customerId) {
            await prisma.subscription.update({
                where: { id: organization.subscription.id },
                data: { stripeCustomerId: customerId }
            });
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing`,
        });

        return NextResponse.json({ url: portalSession.url });

    } catch (error) {
        console.error('Stripe portal error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
