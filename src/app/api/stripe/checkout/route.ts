import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripe, PRICING_PLANS, PlanKey } from '@/lib/stripe';
import { getOrCreateSubscription } from '@/lib/usage';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { tier, successUrl, cancelUrl } = await req.json();

        // Validate tier
        if (!tier || !['STARTER', 'PRO', 'BUSINESS'].includes(tier)) {
            return new Response('Invalid tier', { status: 400 });
        }

        const plan = PRICING_PLANS[tier as PlanKey];
        if (!plan.priceId) {
            return new Response('Price not configured', { status: 500 });
        }

        // Get user and organization
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                memberships: {
                    include: { organization: true },
                    take: 1
                }
            }
        });

        if (!user) {
            return new Response('User not found', { status: 404 });
        }

        // Get or create organization
        let organization = user.memberships[0]?.organization;
        if (!organization) {
            // Create personal organization for the user
            organization = await prisma.organization.create({
                data: {
                    name: `${user.name || user.email}'s Workspace`,
                    slug: `org-${user.id.slice(0, 8)}`,
                    members: {
                        create: {
                            userId: user.id,
                            role: 'OWNER'
                        }
                    }
                }
            });
        }

        // Get or create subscription
        const subscription = await getOrCreateSubscription(organization.id);

        // Create or get Stripe customer
        let customerId = subscription.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name || undefined,
                metadata: {
                    organizationId: organization.id,
                    userId: user.id
                }
            });
            customerId = customer.id;

            // Save customer ID
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { stripeCustomerId: customerId }
            });
        }

        // Create checkout session
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: plan.priceId,
                    quantity: 1
                }
            ],
            success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success`,
            cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?upgrade=canceled`,
            metadata: {
                organizationId: organization.id,
                tier
            },
            subscription_data: {
                metadata: {
                    organizationId: organization.id,
                    tier
                }
            },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            tax_id_collection: { enabled: true }
        });

        return Response.json({ url: checkoutSession.url });

    } catch (error: any) {
        console.error('Checkout Error:', error);
        return new Response(error.message || 'Checkout failed', { status: 500 });
    }
}
