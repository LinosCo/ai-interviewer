import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ScanForm } from "./ScanForm";
import { ScanResults } from "@/components/visibility/ScanResults";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Settings } from "lucide-react";

export default async function VisibilityPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { memberships: { take: 1, include: { organization: true } } }
    });

    const orgId = user?.memberships[0]?.organizationId;
    if (!orgId) redirect("/login");

    // 1. Check if config exists
    const config = await prisma.visibilityConfig.findUnique({
        where: { organizationId: orgId },
        include: { prompts: true }
    });

    if (!config) {
        redirect("/dashboard/visibility/create");
    }

    // 2. Fetch latest completed scan
    const latestScan = await prisma.visibilityScan.findFirst({
        where: {
            configId: config.id,
            status: 'completed'
        },
        orderBy: { completedAt: 'desc' },
        include: {
            responses: {
                include: { prompt: true }
            }
        }
    });

    const totalScans = await prisma.visibilityScan.count({
        where: { configId: config.id, status: 'completed' }
    });

    // 3. Aggregate Data for Visualization
    let scanData = null;

    if (latestScan) {
        // Calculate platform scores
        const platforms = Array.from(new Set(latestScan.responses.map(r => r.platform)));

        const platformScores = platforms.map(platform => {
            const p = platform as string;
            const platformResponses = latestScan.responses.filter(r => r.platform === p);
            const total = platformResponses.length;
            const mentions = platformResponses.filter(r => r.brandMentioned).length;
            const score = total > 0 ? Math.round((mentions / total) * 100) : 0;
            return { platform: p, score, total, mentions };
        });

        // Determine partial status (heuristic: if less than expected responses)
        // Expected ~ prompts * 3 providers (openai, anthropic, gemini)
        // But gemini might be disabled. Let's just rely on what we have.
        // We set partial = false for stored scans to avoid confusing warnings on old data.
        const partial = false;

        scanData = {
            id: latestScan.id,
            completedAt: latestScan.completedAt || new Date(),
            score: latestScan.score,
            platformScores,
            responses: latestScan.responses.map(r => ({
                id: r.id,
                platform: r.platform,
                promptText: r.prompt.text,
                brandMentioned: r.brandMentioned,
                brandPosition: r.brandPosition,
                sentiment: r.sentiment
            })),
            partial
        };
    }

    return (
        <div className="space-y-8 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Visibility Tracker</h2>
                    <p className="text-muted-foreground">Monitora la presenza del tuo brand nelle risposte AI.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/visibility/create">
                        <Button variant="outline" size="sm" title="Settings" className="px-3">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </Link>
                    <ScanForm />
                </div>
            </div>

            <ScanResults scan={scanData} totalScans={totalScans} />
        </div>
    );
}
