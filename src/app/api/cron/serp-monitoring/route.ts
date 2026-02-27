import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { SerpMonitoringEngine } from '@/lib/visibility/serp-monitoring-engine';
import { getAdminApiKey } from '@/lib/visibility/llm-providers';

/**
 * Weekly SERP Monitoring Cron Job
 *
 * This endpoint is designed to be called by a cron scheduler (e.g., Vercel Cron)
 * to automatically scan Google for brand mentions across all active organizations.
 *
 * Recommended schedule: Weekly (every Monday)
 * Vercel cron: 0 8 * * 1 (Every Monday at 8:00 AM UTC)
 */
export async function GET(request: Request) {
    try {
        // Auth: Bearer token obbligatorio per cron job
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Check if SERP API key is configured
        const serpApiKey = await getAdminApiKey('GOOGLE_SERP');
        if (!serpApiKey) {
            return NextResponse.json({
                success: false,
                message: 'Google SERP API key not configured. Skipping SERP monitoring.',
                scanned: 0
            });
        }

        // 3. Get all active visibility configs
        const configs = await prisma.visibilityConfig.findMany({
            where: { isActive: true },
            select: {
                id: true,
                brandName: true,
                organizationId: true,
                organization: {
                    select: { name: true }
                }
            }
        });

        if (configs.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No active visibility configurations found',
                scanned: 0
            });
        }

        // 4. Run scans for each config (with rate limiting)
        const results: Array<{
            configId: string;
            brandName: string;
            organization: string;
            success: boolean;
            resultsCount?: number;
            error?: string;
        }> = [];

        for (const config of configs) {
            try {
                // Add a small delay between scans to avoid rate limiting
                if (results.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                const scanResult = await SerpMonitoringEngine.runScan(config.id, 'last_week');

                results.push({
                    configId: config.id,
                    brandName: config.brandName,
                    organization: config.organization.name,
                    success: true,
                    resultsCount: scanResult.resultsCount
                });

            } catch (error) {
                console.error(`SERP scan failed for config ${config.id}:`, error);
                results.push({
                    configId: config.id,
                    brandName: config.brandName,
                    organization: config.organization.name,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // 5. Calculate summary
        const successCount = results.filter(r => r.success).length;
        const totalResults = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.resultsCount || 0), 0);

        console.log(`[SERP Cron] Completed: ${successCount}/${configs.length} configs scanned, ${totalResults} total results`);

        return NextResponse.json({
            success: true,
            message: `SERP monitoring completed for ${successCount}/${configs.length} organizations`,
            summary: {
                totalConfigs: configs.length,
                successfulScans: successCount,
                failedScans: configs.length - successCount,
                totalResultsFound: totalResults
            },
            details: results
        });

    } catch (error) {
        console.error('[SERP Cron] Fatal error:', error);
        return NextResponse.json(
            { error: 'SERP monitoring cron failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
    return GET(request);
}
