
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
        const { searchParams } = new URL(req.url);
        const botIdsParam = searchParams.get('botIds');
        const botIds = botIdsParam ? botIdsParam.split(',') : undefined;

        console.log("Generating insights for project:", projectId, "Bots filter:", botIds);

        const data = await AnalyticsEngine.generateProjectInsights(projectId, botIds);

        return NextResponse.json({
            insights: data.insights,
            stats: data.stats
        });

    } catch (error) {
        console.error('[ANALYTICS_GET]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
