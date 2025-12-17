import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

export async function POST() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Get user's organization subscription
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
            return new Response('No subscription found', { status: 404 });
        }

        // Create portal session
        const portalSession = await getStripe().billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`
        });

        return Response.json({ url: portalSession.url });

    } catch (error: any) {
        console.error('Portal Error:', error);
        return new Response(error.message || 'Portal access failed', { status: 500 });
    }
}
