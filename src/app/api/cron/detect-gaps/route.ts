import { prisma } from "@/lib/prisma";
import { detectKnowledgeGaps } from "@/lib/chatbot/knowledge-gap-detector";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // static by default, must be dynamic for cron?

export async function GET(req: Request) {
    // Auth: Bearer token obbligatorio per cron job
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const bots = await prisma.bot.findMany({
            where: { status: 'PUBLISHED' }
        });

        console.log(`[Cron] Starting Gap Detection for ${bots.length} bots`);

        for (const bot of bots) {
            await detectKnowledgeGaps(bot.id);
        }

        return NextResponse.json({ success: true, botsProcessed: bots.length });
    } catch (error) {
        console.error("Cron failed", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
