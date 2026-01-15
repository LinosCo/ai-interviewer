'use server'

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateInsightStatus(insightId: string, status: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    await (prisma as any).crossChannelInsight.update({
        where: { id: insightId },
        data: {
            status,
            reviewedBy: session.user.id,
            reviewedAt: new Date()
        }
    });

    revalidatePath(`/dashboard/insights`);
}
