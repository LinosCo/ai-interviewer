'use server'

import { auth } from "@/auth";
import { VisibilityEngine } from "@/lib/visibility/visibility-engine";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function runVisibilityScan() {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
        throw new Error("Unauthorized");
    }
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { memberships: { take: 1, include: { organization: true } } }
    });

    const orgId = user?.memberships[0]?.organizationId;

    if (!orgId) {
        throw new Error("No organization found");
    }

    // Find the visibility config for this organization
    const config = await prisma.visibilityConfig.findUnique({
        where: { organizationId: orgId }
    });

    if (!config) {
        throw new Error("No visibility configuration found. Please set up your visibility tracking first.");
    }

    // In a real app, this should likely be a background job (Queue) because it takes time.
    // For MVP, we run it and await (might timeout Vercel functions > 10s).
    // Better: Start it, return "Started", and let client poll.
    // For this demo: await (assuming few prompts).

    await VisibilityEngine.runScan(config.id);

    revalidatePath("/dashboard/visibility");
}
