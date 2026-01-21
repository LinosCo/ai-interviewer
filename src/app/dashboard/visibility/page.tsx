import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ScanForm } from "./ScanForm";
import { ScanResults } from "@/components/visibility/ScanResults";
import { SerpMonitoringSection } from "./SerpMonitoringSection";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Settings, History, Calendar, Newspaper, Plus, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisibilityProjectFilter } from "./VisibilityProjectFilter";

export default async function VisibilityPage({
    searchParams
}: {
    searchParams: Promise<{ scanId?: string; projectId?: string }>
}) {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const params = await searchParams;
    const selectedScanId = params.scanId;
    const projectIdFilter = params.projectId;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { memberships: { take: 1, include: { organization: true } } }
    });

    const orgId = user?.memberships[0]?.organizationId;
    if (!orgId) redirect("/login");

    // 1. Check if config exists (optionally filtered by project)
    const config = await prisma.visibilityConfig.findFirst({
        where: {
            organizationId: orgId,
            ...(projectIdFilter && projectIdFilter !== '__ALL__' ? { projectId: projectIdFilter } : {})
        },
        include: { prompts: true, project: { select: { id: true, name: true } } }
    });

    // If no config at all, redirect to create
    const anyConfig = await prisma.visibilityConfig.findFirst({
        where: { organizationId: orgId }
    });

    if (!anyConfig) {
        redirect("/dashboard/visibility/create");
    }

    // If filtering by project but no config for that project
    if (!config && projectIdFilter && projectIdFilter !== '__ALL__') {
        return (
            <div className="space-y-8 p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Brand Monitor</h2>
                        <p className="text-muted-foreground">Monitora come il tuo brand appare negli LLM e nelle ricerche Google.</p>
                    </div>
                    <VisibilityProjectFilter currentProjectId={projectIdFilter} />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                    <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun brand configurato per questo progetto</h3>
                    <p className="text-gray-500 mb-6">Configura il monitoraggio della visibilità per questo progetto</p>
                    <Link
                        href={`/dashboard/visibility/create?projectId=${projectIdFilter}`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Configura Brand
                    </Link>
                </div>
            </div>
        );
    }

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
                model: r.model,
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
                    <h2 className="text-3xl font-bold tracking-tight">Monitor visibilità online</h2>
                    <p className="text-muted-foreground">
                        {config.brandName && (
                            <span className="font-medium text-amber-600">{config.brandName}</span>
                        )}
                        {config.project && (
                            <span className="text-gray-400 ml-2">• {config.project.name}</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <VisibilityProjectFilter currentProjectId={projectIdFilter || config.projectId || undefined} />
                    <Link href={`/dashboard/visibility/create${config.projectId ? `?projectId=${config.projectId}` : ''}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Settings className="h-4 w-4" />
                            Impostazioni
                        </Button>
                    </Link>
                    <ScanForm />
                </div>
            </div>

            <Tabs defaultValue="llm" className="space-y-6">
                <TabsList className="bg-stone-100">
                    <TabsTrigger value="llm" className="data-[state=active]:bg-white">
                        Visibilità LLM
                    </TabsTrigger>
                    <TabsTrigger value="serp" className="data-[state=active]:bg-white flex items-center gap-2">
                        <Newspaper className="w-4 h-4" />
                        Google News
                    </TabsTrigger>
                </TabsList>

                {/* LLM Visibility Tab */}
                <TabsContent value="llm" className="space-y-6">
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

                            {/* Sezione Presenza Online */}
                            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-stone-900">Brand Monitor</h3>
                                        <p className="text-sm text-stone-500">
                                            {config.nextScanAt
                                                ? `Programmata per il ${config.nextScanAt.toLocaleDateString()}`
                                                : 'Non programmata automatica'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Google SERP Monitoring Tab */}
                <TabsContent value="serp">
                    <SerpMonitoringSection />
                </TabsContent>
            </Tabs>
        </div>
    );
}
