import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import InsightCard from "./InsightCard";
import { Sparkles, Layers } from "lucide-react";

export default async function InsightsPage() {
    const session = await auth();
    if (!session || !session.user?.id) redirect("/login");

    // Fetch user's organization
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { memberships: { take: 1 } }
    });
    const orgId = user?.memberships[0]?.organizationId;

    if (!orgId) redirect("/dashboard");

    const insights = await (prisma as any).crossChannelInsight.findMany({
        where: {
            organizationId: orgId,
            status: { not: 'dismissed' }
        },
        orderBy: { priorityScore: 'desc' }
    });

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
                        <Layers className="w-8 h-8 text-indigo-600" />
                        Unified Insights
                    </h1>
                    <p className="text-slate-500 max-w-2xl">
                        AI aggregates data from your Interviews, Chatbots, and Brand Visibility to find strategic opportunities.
                    </p>
                </div>
            </div>

            {insights.length === 0 ? (
                <div className="bg-gradient-to-br from-indigo-50 to-white p-12 rounded-xl border border-indigo-100 text-center">
                    <Sparkles className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-indigo-900">Waiting for Data</h3>
                    <p className="text-indigo-600/70 mt-2">
                        Insights will appear here once we gather enough data across your channels.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {insights.map((insight: any) => (
                        <InsightCard key={insight.id} insight={insight} />
                    ))}
                </div>
            )}
        </div>
    );
}
