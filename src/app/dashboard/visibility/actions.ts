'use server'

import { auth } from "@/auth";
import { VisibilityEngine } from "@/lib/visibility/visibility-engine";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function runVisibilityScan(category: string, brandName: string) {
    const session = await auth();
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { memberships: { take: 1, include: { organization: true } } }
    });

    const orgId = user?.memberships[0]?.organizationId;

    if (!orgId) {
        throw new Error("No organization found");
    }


    const engine = new VisibilityEngine();

    // In a real app, this should likely be a background job (Queue) because it takes time.
    // For MVP, we run it and await (might timeout Vercel functions > 10s).
    // Better: Start it, return "Started", and let client poll.
    // For this demo: await (assuming few prompts).

    await engine.runAnalysis(orgId, brandName, category);

    revalidatePath("/dashboard/visibility");
}
