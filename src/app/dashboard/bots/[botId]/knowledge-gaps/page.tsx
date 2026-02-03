import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import GapCard from "./GapCard";
import { AlertCircle, FileQuestion } from "lucide-react";

export default async function KnowledgeGapsPage({ params }: { params: Promise<{ botId: string }> }) {
    const { botId } = await params;
    const session = await auth();
    if (!session) redirect("/login");

    const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
            knowledgeGaps: {
                where: { status: 'pending' },
                orderBy: { priority: 'desc' }
            }
        } as any
    });

    if (!bot) redirect("/dashboard");

    // Manual sort because priority is string enum roughly
    const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const gaps = ((bot as any).knowledgeGaps || []).sort((a: any, b: any) => {
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FileQuestion className="w-6 h-6 text-amber-600" />
                    Knowledge Gaps
                </h1>
                <p className="text-slate-500">
                    Review questions your bot couldn&apos;t answer and convert them into new knowledge.
                </p>
            </div>

            {gaps.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-700">All Clear!</h3>
                    <p className="text-slate-500">No knowledge gaps detected recently.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {gaps.map((gap: any) => (
                        <GapCard key={gap.id} gap={gap} botId={botId} />
                    ))}
                </div>
            )}
        </div>
    );
}
