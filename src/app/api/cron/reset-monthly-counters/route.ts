import { prisma as db } from '@/lib/prisma';
import { planService } from '@/services/planService';

/**
 * Monthly Counter Reset Job
 * 
 * This should be run as a cron job on the 1st of each month at 00:00 UTC
 * 
 * Deployment options:
 * - Vercel Cron Jobs
 * - GitHub Actions scheduled workflow
 * - External cron service (e.g., cron-job.org)
 * - Serverless function with scheduler
 */

async function resetMonthlyCounters(): Promise<void> {
    console.log('🔄 Starting monthly counter reset...');

    try {
        // Reset all organization counters
        const result = await db.organization.updateMany({
            data: {
                responsesUsedThisMonth: 0,
                monthlyResetDate: new Date()
            }
        });

        console.log(`✅ Reset counters for ${result.count} organizations`);

        // Resume any paused interviews that now have quota
        const orgs = await db.organization.findMany({
            select: { id: true }
        });

        for (const org of orgs) {
            const limitCheck = await planService.checkResponseLimit(org.id);

            if (limitCheck.allowed && limitCheck.remaining > 0) {
                const resumed = await db.bot.updateMany({
                    where: {
                        project: {
                            organizationId: org.id
                        },
                        status: 'PAUSED'
                    },
                    data: {
                        status: 'PUBLISHED'
                    }
                });

                if (resumed.count > 0) {
                    console.log(`  ▶️  Resumed ${resumed.count} interviews for org ${org.id}`);
                }
            }
        }

        console.log('✨ Monthly reset complete!');
    } catch (error) {
        console.error('❌ Monthly reset failed:', error);
        throw error;
    }
}

/**
 * API endpoint handler for manual trigger or cron
 */
export async function POST(request: Request) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        await resetMonthlyCounters();

        return new Response(
            JSON.stringify({ success: true, message: 'Monthly counters reset successfully' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: String(error) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
