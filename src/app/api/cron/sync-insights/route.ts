import { prisma } from "@/lib/prisma";
import { CrossChannelSyncEngine } from "@/lib/insights/sync-engine";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Auth: Bearer token obbligatorio per cron job
    const authHeader = req.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const orgs = await prisma.organization.findMany({ select: { id: true } });

        console.log(`[Cron] Starting Cross-Channel Sync for ${orgs.length} orgs`);

        const results = await Promise.allSettled(
            orgs.map((org) => CrossChannelSyncEngine.sync(org.id))
        );

        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;

        if (failed > 0) {
            const errors = results
                .map((r, i) => r.status === 'rejected' ? { orgId: orgs[i].id, error: String(r.reason) } : null)
                .filter(Boolean);
            console.error('[Cron] Some orgs failed sync:', errors);
        }

        return NextResponse.json({ success: true, orgsProcessed: orgs.length, succeeded, failed });
    } catch (error) {
        console.error("Cron failed", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
