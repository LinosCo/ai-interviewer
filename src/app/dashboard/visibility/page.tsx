import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScanForm } from "./ScanForm";

export default async function VisibilityPage() {
    const session = await auth();
    if (!session?.user?.organizationId) redirect("/login");

    const orgId = session.user.organizationId;

    // Fetch visibility metrics
    const responses = await prisma.visibilityResponse.findMany({
        where: { prompt: { organizationId: orgId } },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    const totalScans = responses.length;
    // Calculate Average Rank (ignoring 0/unranked? or 0 means unranked = bad?)
    // Assume 0 means "Not in top 10". So high number.
    // Let's count mentions.
    const mentions = responses.filter(r => r.rank > 0 && r.rank <= 10).length;
    const visibilityScore = totalScans > 0 ? Math.round((mentions / totalScans) * 100) : 0;

    return (
        <div className="space-y-8 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Visibility Tracker</h2>
                    <p className="text-muted-foreground">Monitora come l'IA parla del tuo brand.</p>
                </div>
                <ScanForm />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Visibility Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{visibilityScore}%</div>
                        <p className="text-xs text-muted-foreground">Prompt dove appariamo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Totale Scans</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalScans}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Top Sentiment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">
                            {/* Simple mode for now */}
                            {responses.length > 0 ? responses[0].sentiment : '-'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Ultimi Rilevamenti</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {responses.length === 0 ? (
                            <p className="text-slate-500">Nessuna scansione recente.</p>
                        ) : (
                            responses.map((res) => (
                                <div key={res.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border rounded-lg bg-slate-50">
                                    <div className="space-y-1">
                                        <div className="font-medium text-sm text-slate-900">{res.platform}</div>
                                        {/* Ideally fetch prompt text too. Using 'include' above would be better. */}
                                        <div className="text-xs text-slate-500">
                                            Rank: {res.rank > 0 ? `#${res.rank}` : 'Not found'} | Sentiment: {res.sentiment}
                                        </div>
                                    </div>
                                    <div className="mt-2 md:mt-0">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${res.rank > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {res.rank > 0 ? 'Visible' : 'Invisible'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
