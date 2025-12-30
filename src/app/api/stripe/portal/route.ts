import { auth } from '@/auth';
import { getStripeClient } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: {
                        organization: {
                            include: {
                                subscription: true
                            }
                        }
                    }
                }
            }
        });

        if (!user || user.memberships.length === 0) {
            return new NextResponse('User or Organization not found', { status: 404 });
        }

        const organization = user.memberships[0].organization;
        const stripe = await getStripeClient();

        // 1. Find or create stripe customer if missing from subscription record
        let customerId = organization.subscription?.stripeCustomerId;

        if (!customerId) {
            // Check if we have any previous subscription or customer
            // If not, we can't open portal for a user without a customer ID in Stripe
            // In a real app, we might search by email
            const customers = await stripe.customers.list({
                email: user.email,
                limit: 1
            });

            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
            } else {
                // If no customer, we create one so they can manage their future billing
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: organization.name,
                    metadata: {
                        organizationId: organization.id
                    }
                });
                customerId = customer.id;
            }
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
