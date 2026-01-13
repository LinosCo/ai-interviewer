
import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsEngine } from '@/lib/analytics/AnalyticsEngine';
import { auth } from '@/auth';

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ projectId: string }> }
) {
    const params = await props.params;
    try {
        // Basic auth check
        const session = await auth();
        if (!session?.user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const projectId = params.projectId;
        if (!projectId) {
            return new NextResponse('Project ID required', { status: 400 });
        }

        // Generate insights using the engine
        const insights = await AnalyticsEngine.generateProjectInsights(projectId);

        return NextResponse.json({
            insights,
            // We can also add trend data here later by extending the engine
            trends: [
                { date: 'Lun', sentiment: 65, volume: 120 },
                { date: 'Mar', sentiment: 58, volume: 145 },
                { date: 'Mer', sentiment: 72, volume: 132 },
                { date: 'Gio', sentiment: 68, volume: 150 },
                { date: 'Ven', sentiment: 75, volume: 180 },
                { date: 'Sab', sentiment: 82, volume: 90 },
                { date: 'Dom', sentiment: 80, volume: 85 },
            ]
        });

    } catch (error) {
        console.error('[ANALYTICS_GET]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
