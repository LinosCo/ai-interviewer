import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { SerpMonitoringEngine } from '@/lib/visibility/serp-monitoring-engine';
import { resolveActiveOrganizationIdForUser } from '@/lib/active-organization';

/**
 * GET - Fetch SERP summary for cross-channel insights
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const organizationId = await resolveActiveOrganizationIdForUser(session.user.id);
        if (!organizationId) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const summary = await SerpMonitoringEngine.getSerpSummaryForInsights(organizationId);

        if (!summary) {
            return NextResponse.json({
                hasData: false,
                message: 'No SERP monitoring data available. Run a scan first.'
            });
        }

        return NextResponse.json({
            hasData: true,
            ...summary
        });

    } catch (error) {
        console.error('Error fetching SERP summary:', error);
        return NextResponse.json(
            { error: 'Failed to fetch SERP summary' },
            { status: 500 }
        );
    }
}
