import { prisma } from "@/lib/prisma";
import { CrossChannelSync } from "@/lib/cross-channel/sync-engine";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Auth: Bearer token obbligatorio per cron job
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const orgs = await prisma.organization.findMany();
        const syncer = new CrossChannelSync();

        console.log(`[Cron] Starting Cross-Channel Sync for ${orgs.length} orgs`);

        for (const org of orgs) {
            await syncer.runSync(org.id);
        }

        return NextResponse.json({ success: true, orgsProcessed: orgs.length });
    } catch (error) {
        console.error("Cron failed", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
