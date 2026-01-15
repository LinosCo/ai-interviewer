'use server'

import { auth } from "@/auth";
import { VisibilityEngine } from "@/lib/visibility/visibility-engine";
import { revalidatePath } from "next/cache";

export async function runVisibilityScan(category: string, brandName: string) {
    const session = await auth();
    if (!session?.user?.id || !session.user.organizationId) {
        throw new Error("Unauthorized");
    }

    const engine = new VisibilityEngine();

    // In a real app, this should likely be a background job (Queue) because it takes time.
    // For MVP, we run it and await (might timeout Vercel functions > 10s).
    // Better: Start it, return "Started", and let client poll.
    // For this demo: await (assuming few prompts).

    await engine.runAnalysis(session.user.organizationId, brandName, category);

    revalidatePath("/dashboard/visibility");
}
