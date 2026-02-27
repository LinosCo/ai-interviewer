import { prisma } from '@/lib/prisma';
import { googleAnalyticsService } from '@/lib/cms/google-analytics.service';
import { searchConsoleService } from '@/lib/cms/search-console.service';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/cms-sync-analytics
 * Daily cron job to fetch analytics from Google Analytics and Search Console.
 * Run at 03:00 AM daily.
 */
export async function GET(req: Request) {
    try {
        // Auth: Bearer token obbligatorio per cron job
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Get all active CMS connections with Google connected
        const connections = await prisma.cMSConnection.findMany({
            where: {
                status: { in: ['ACTIVE', 'PARTIAL', 'GOOGLE_ONLY'] },
                OR: [
                    { googleAnalyticsConnected: true },
                    { searchConsoleConnected: true }
                ]
            }
        });

        console.log(`[CMS Analytics Sync] Starting sync for ${connections.length} connections`);

        const results: { connectionId: string; success: boolean; error?: string }[] = [];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        for (const conn of connections) {
            try {
                let gaData: any = null;
                let scData: any = null;

                // Fetch Google Analytics data
                if (conn.googleAnalyticsConnected && conn.googleAnalyticsPropertyId) {
                    try {
                        gaData = await googleAnalyticsService.fetchDailyMetrics(conn.id, yesterday);
                    } catch (gaError: any) {
                        console.error(`[CMS Analytics] GA error for ${conn.id}:`, gaError.message);
                    }
                }

                // Fetch Search Console data
                if (conn.searchConsoleConnected && conn.searchConsoleSiteUrl) {
                    try {
                        scData = await searchConsoleService.fetchDailyMetrics(conn.id, yesterday);
                    } catch (scError: any) {
                        console.error(`[CMS Analytics] SC error for ${conn.id}:`, scError.message);
                    }
                }

                // Save analytics record
                if (gaData || scData) {
                    await prisma.websiteAnalytics.upsert({
                        where: {
                            connectionId_date: {
                                connectionId: conn.id,
                                date: yesterday
                            }
                        },
                        update: {
                            // Google Analytics
                            pageviews: gaData?.pageviews || 0,
                            uniqueVisitors: gaData?.uniqueVisitors || 0,
                            avgSessionDuration: gaData?.avgSessionDuration || 0,
                            bounceRate: gaData?.bounceRate || 0,
                            topPages: gaData?.topPages || [],
                            trafficSources: gaData?.trafficSources || null,
                            // Search Console
                            searchImpressions: scData?.impressions || null,
                            searchClicks: scData?.clicks || null,
                            searchCtr: scData?.ctr || null,
                            avgSearchPosition: scData?.avgPosition || null,
                            topSearchQueries: scData?.topQueries || null,
                            topSearchPages: scData?.topPages || null
                        },
                        create: {
                            connectionId: conn.id,
                            date: yesterday,
                            // Google Analytics
                            pageviews: gaData?.pageviews || 0,
                            uniqueVisitors: gaData?.uniqueVisitors || 0,
                            avgSessionDuration: gaData?.avgSessionDuration || 0,
                            bounceRate: gaData?.bounceRate || 0,
                            topPages: gaData?.topPages || [],
                            trafficSources: gaData?.trafficSources || null,
                            // Search Console
                            searchImpressions: scData?.impressions || null,
                            searchClicks: scData?.clicks || null,
                            searchCtr: scData?.ctr || null,
                            avgSearchPosition: scData?.avgPosition || null,
                            topSearchQueries: scData?.topQueries || null,
                            topSearchPages: scData?.topPages || null
                        }
                    });

                    // Update connection sync timestamp
                    await prisma.cMSConnection.update({
                        where: { id: conn.id },
                        data: {
                            lastSyncAt: new Date(),
                            lastSyncError: null
                        }
                    });

                    results.push({ connectionId: conn.id, success: true });
                } else {
                    results.push({ connectionId: conn.id, success: false, error: 'No data available' });
                }

            } catch (error: any) {
                console.error(`[CMS Analytics] Error for connection ${conn.id}:`, error);

                // Update connection with error
                await prisma.cMSConnection.update({
                    where: { id: conn.id },
                    data: {
                        lastSyncError: error.message
                    }
                });

                results.push({ connectionId: conn.id, success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`[CMS Analytics Sync] Completed: ${successCount}/${connections.length} successful`);

        return NextResponse.json({
            success: true,
            processed: connections.length,
            successful: successCount,
            results
        });

    } catch (error: any) {
        console.error('[CMS Analytics Sync] Cron failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
