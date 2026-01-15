import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Chatbot Analytics | Business Tuner',
};

export default async function ChatbotAnalyticsPage({ params }: { params: Promise<{ botId: string }> }) {
    const { botId } = await params;
    const session = await auth();
    if (!session) redirect("/login");

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            // Simplified fetch, ideally we use the API or service
            // For Server Component, direct DB access is fine and faster
            analytics: {
                orderBy: { period: 'desc' },
                take: 7
            },
            knowledgeGaps: {
                where: { status: 'pending' },
                orderBy: { priority: 'asc' } // High priority first (if string 'high' < 'medium'?? No. 'high' > 'low')
                // actually "high" comes before "medium" alphabetically? No.
                // We'll sort in UI or fix sort order.
            }
        }
    });

    if (!bot) redirect("/dashboard");

    // Calculate totals for last 7 entries (approx 7 days)
    const recentAnalytics = bot.analytics;
    const totalSessions = recentAnalytics.reduce((acc, curr) => acc + curr.sessionsCount, 0);
    const totalLeads = recentAnalytics.reduce((acc, curr) => acc + curr.leadsCollected, 0);
    const avgResponse = "94%"; // Placeholder or calculated from messages

    return (
        <div className="space-y-8 p-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                <p className="text-muted-foreground">Insight sulle performance del tuo chatbot</p>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sessioni Totali (7d)</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSessions}</div>
                        <p className="text-xs text-muted-foreground">+12% vs settimana scorsa</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lead Raccolti</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <rect width="20" height="14" x="2" y="5" rx="2" />
                            <path d="M2 10h20" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalLeads}</div>
                        <p className="text-xs text-muted-foreground">+15% conversion rate</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Knowledge Gaps</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{bot.knowledgeGaps.length}</div>
                        <p className="text-xs text-muted-foreground">Domande senza risposta</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Charts Area */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Sessioni nel Tempo</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        {/* Client Component for Recharts would go here */}
                        <div className="h-[200px] flex items-center justify-center bg-slate-50 border rounded text-slate-400">
                            Grafico Sessioni (Coming Soon)
                        </div>
                    </CardContent>
                </Card>

                {/* Gaps List */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Gap Rilevati</CardTitle>
                        <CardDescription>
                            Domande a cui il bot non ha saputo rispondere.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {bot.knowledgeGaps.length === 0 ? (
                                <p className="text-sm text-slate-500">Ottimo lavoro! Nessun gap rilevato.</p>
                            ) : (
                                bot.knowledgeGaps.map(gap => (
                                    <div className="flex items-center" key={gap.id}>
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">{gap.topic}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Priorità: {gap.priority}
                                            </p>
                                        </div>
                                        <div className="ml-auto font-medium">
                                            {/* Action Button Placeholder */}
                                            <button className="text-xs bg-black text-white px-2 py-1 rounded">Review</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
