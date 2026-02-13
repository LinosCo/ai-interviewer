import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { WebsiteAnalysisEngine } from '@/lib/visibility/website-analysis-engine';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { configId } = body;

        if (!configId) {
            return NextResponse.json({ error: 'configId is required' }, { status: 400 });
        }

        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            select: { id: true, websiteUrl: true, organizationId: true }
        });

        if (!config) {
            return NextResponse.json({ error: 'Config not found' }, { status: 404 });
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: config.organizationId
                }
            },
            select: { status: true }
        });
        if (membership?.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        if (!config.websiteUrl) {
            return NextResponse.json(
                { error: 'No website URL configured for this brand' },
                { status: 400 }
            );
        }

        // Check if there's already an analysis running
        const runningAnalysis = await prisma.websiteAnalysis.findFirst({
            where: { configId, status: 'running' }
        });

        if (runningAnalysis) {
            return NextResponse.json({
                success: true,
                analysisId: runningAnalysis.id,
                status: 'already_running'
            });
        }

        // Create and run new analysis
        const analysis = await WebsiteAnalysisEngine.createAndRunAnalysis(configId);

        return NextResponse.json({
            success: true,
            analysisId: analysis.id,
            status: 'started'
        });

    } catch (error: any) {
        console.error('Error starting website analysis:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to start analysis' },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const configId = searchParams.get('configId');

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!configId) {
            return NextResponse.json({ error: 'configId is required' }, { status: 400 });
        }

        const config = await prisma.visibilityConfig.findUnique({
            where: { id: configId },
            select: { id: true, organizationId: true }
        });

        if (!config) {
            return NextResponse.json({ error: 'Config not found' }, { status: 404 });
        }

        const membership = await prisma.membership.findUnique({
            where: {
                userId_organizationId: {
                    userId: session.user.id,
                    organizationId: config.organizationId
                }
            },
            select: { status: true }
        });
        if (membership?.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Get latest completed analysis
        const analysis = await WebsiteAnalysisEngine.getLatestAnalysis(configId);

        // Also check for running analysis
        const runningAnalysis = await prisma.websiteAnalysis.findFirst({
            where: { configId, status: 'running' }
        });

        return NextResponse.json({
            analysis,
            isRunning: !!runningAnalysis,
            runningAnalysisId: runningAnalysis?.id
        });

    } catch (error: any) {
        console.error('Error fetching website analysis:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch analysis' },
            { status: 500 }
        );
    }
}
