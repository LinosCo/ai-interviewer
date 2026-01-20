import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ScanForm } from "./ScanForm";
import { ScanResults } from "@/components/visibility/ScanResults";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Settings, History, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function VisibilityPage({
    searchParams
}: {
    searchParams: Promise<{ scanId?: string }>
}) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const params = await searchParams;
    const selectedScanId = params.scanId;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { memberships: { take: 1, include: { organization: true } } }
    });

    const orgId = user?.memberships[0]?.organizationId;
    if (!orgId) redirect("/login");

    // 1. Check if config exists
    const config = await prisma.visibilityConfig.findFirst({
        where: { organizationId: orgId },
        include: { prompts: true }
    });

    if (!config) {
        redirect("/dashboard/visibility/create");
    }

    // 2. Fetch scans for history
    const allScans = await prisma.visibilityScan.findMany({
        where: { configId: config.id, status: 'completed' },
        orderBy: { completedAt: 'desc' },
        take: 10
    });

    // 3. Fetch specific scan or latest
    const activeScan = selectedScanId
        ? await prisma.visibilityScan.findUnique({
            where: { id: selectedScanId },
            include: {
                responses: {
                    include: { prompt: true }
                }
            }
        })
        : await prisma.visibilityScan.findFirst({
            where: { configId: config.id, status: 'completed' },
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

    // 4. Aggregate Data for Visualization
    let scanData = null;

    if (activeScan) {
        const platforms = Array.from(new Set(activeScan.responses.map(r => r.platform)));

        const platformScores = platforms.map(platform => {
            const p = platform as string;
            const platformResponses = activeScan.responses.filter(r => r.platform === p);
            const total = platformResponses.length;
            const mentions = platformResponses.filter(r => r.brandMentioned).length;
            const score = total > 0 ? Math.round((mentions / total) * 100) : 0;
            return { platform: p, score, total, mentions };
        });

        scanData = {
            id: activeScan.id,
            completedAt: activeScan.completedAt || new Date(),
            score: activeScan.score,
            platformScores,
            responses: activeScan.responses.map(r => ({
                id: r.id,
                platform: r.platform,
                promptText: r.prompt.text,
                brandMentioned: r.brandMentioned,
                brandPosition: r.brandPosition,
                sentiment: r.sentiment,
                responseText: r.responseText,
                competitorPositions: r.competitorPositions as Record<string, number | null>
            })),
            partial: false
        };
    }

    return (
        <div className="space-y-8 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Visibility Tracker</h2>
                    <p className="text-muted-foreground">Analisi della presenza del brand nelle risposte degli LLM.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/visibility/create">
                        <Button variant="outline" size="sm" className="gap-2">
                            <Settings className="h-4 w-4" />
                            Impostazioni
                        </Button>
                    </Link>
                    <ScanForm />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Content (3/4) */}
                <div className="lg:col-span-3">
                    <ScanResults scan={scanData} totalScans={totalScans} />
                </div>

                {/* Sidebar History (1/4) */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <History className="w-4 h-4 text-amber-600" />
                                Cronologia Scansioni
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-2">
                            <div className="space-y-1">
                                {allScans.length > 0 ? (
                                    allScans.map((s) => (
                                        <Link
                                            key={s.id}
                                            href={`/dashboard/visibility?scanId=${s.id}`}
                                            className={`flex items-center justify-between p-3 rounded-lg text-sm transition-colors ${activeScan?.id === s.id ? 'bg-amber-50 border-amber-200 border' : 'hover:bg-slate-50 border border-transparent'}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">
                                                    {s.completedAt?.toLocaleDateString()}
                                                </span>
                                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {s.completedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <Badge variant={s.score > 50 ? 'default' : 'secondary'} className={s.score > 50 ? 'bg-green-600' : ''}>
                                                {s.score}%
                                            </Badge>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                        Nessuna scansione completata
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Prossima Scansione</h4>
                        <p className="text-sm text-blue-700">
                            {config.nextScanAt
                                ? `Programmata per il ${config.nextScanAt.toLocaleDateString()}`
                                : 'Non programmata automatica'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
