import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { googleAnalyticsService } from '@/lib/cms/google-analytics.service';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/cms/google/callback
 * OAuth callback handler for Google authorization.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return redirect('/login?error=unauthorized');
        }

        // Check admin role
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (user?.role !== 'ADMIN') {
            return redirect('/dashboard?error=forbidden');
        }

        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state'); // This is the connectionId
        const error = url.searchParams.get('error');

        if (error) {
            console.error('Google OAuth error:', error);
            return redirect(`/dashboard/admin/cms?error=google_oauth_failed&message=${encodeURIComponent(error)}`);
        }

        if (!code || !state) {
            return redirect('/dashboard/admin/cms?error=missing_code_or_state');
        }

        // Verify connection exists
        const connection = await prisma.cMSConnection.findUnique({
            where: { id: state },
            include: { project: true }
        });

        if (!connection) {
            return redirect('/dashboard/admin/cms?error=connection_not_found');
        }

        // Handle OAuth callback
        await googleAnalyticsService.handleOAuthCallback(code, state);

        // Redirect to property selection page
        return redirect(`/dashboard/admin/cms/${connection.id}/google-setup?step=select-properties`);

    } catch (error: any) {
        console.error('Error handling Google OAuth callback:', error);
        return redirect(`/dashboard/admin/cms?error=oauth_callback_failed&message=${encodeURIComponent(error.message)}`);
    }
}
