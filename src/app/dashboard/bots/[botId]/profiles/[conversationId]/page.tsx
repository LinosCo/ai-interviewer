
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProfileDetailPage({ params }: { params: Promise<{ botId: string, conversationId: string }> }) {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const { botId, conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            messages: { orderBy: { createdAt: 'asc' } }
        }
    }) as any;

    if (!conversation || conversation.botId !== botId) notFound();

    // Parse profile data
    const profile = conversation.candidateProfile as any || {};

    // Normalize fields (legacy vs new neutral)
    const displayName = profile.fullName || profile.name || "Anonimo";
    const displayRole = profile.currentRole || profile.role || "Ruolo non specificato";
    const score = profile.alignmentScore || profile.cultureFitScore || 0;
    const note = profile.summaryNote || profile.recruiterNote || "Nessuna nota disponibile.";
    const hardSkills = profile.hardSkills || [];
    const softSkills = profile.softSkills || [];

    return (
        <div className="space-y-6 max-w-6xl mx-auto text-gray-900">
            <div className="flex items-center gap-4">
                <Link href={`/dashboard/bots/${botId}/profiles`} className="text-gray-500 hover:text-gray-900">
                    &larr; Torna alla lista
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Dettaglio Contatto</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN: Profile Data */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="bg-white border-slate-200">
                        <CardHeader>
                            <CardTitle className="text-gray-900">{displayName}</CardTitle>
                            <p className="text-sm text-gray-500">{displayRole}</p>
                        </CardHeader>
                        <CardContent className="space-y-4 text-gray-900">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Contatti</label>
                                <div className="text-sm">{profile.email || "-"}</div>
                                <div className="text-sm">{profile.phone || "-"}</div>
                                {profile.linkedIn && (
                                    <a href={profile.linkedIn} target="_blank" className="text-sm text-blue-600 hover:underline block mt-1">LinkedIn Profile</a>
                                )}
                                {profile.portfolio && (
                                    <a href={profile.portfolio} target="_blank" className="text-sm text-purple-600 hover:underline block mt-1">Portfolio / Website</a>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Azienda / Location</label>
                                <div className="text-sm">{profile.company || "-"}</div>
                                <div className="text-sm text-gray-400">{profile.location || "-"}</div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Disponibilità / Budget</label>
                                <div className="text-sm">{profile.availability || profile.budget || "-"}</div>
                            </div>

                            <div className="pt-4 border-t">
                                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Alignment Score</label>
                                <div className="flex items-center gap-2">
                                    <span className={`text-2xl font-bold ${score >= 8 ? "text-green-600" : score >= 6 ? "text-yellow-600" : "text-red-600"}`}>
                                        {score}/10
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Note di Sintesi</label>
                                <p className="text-sm bg-gray-50 p-3 rounded-md italic text-gray-700 border border-gray-100">
                                    &quot;{note}&quot;
                                </p>
                            </div>

                            {profile.userMessage && (
                                <div>
                                    <label className="text-xs font-semibold text-purple-600 uppercase mb-2 block">Messaggio Utente</label>
                                    <p className="text-sm bg-purple-50 p-3 rounded-md text-purple-900 border border-purple-100">
                                        &quot;{profile.userMessage}&quot;
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Competenze & Tratti</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Hard Skills / Tech</label>
                                <div className="flex flex-wrap gap-2">
                                    {hardSkills.length > 0 ? hardSkills.map((s: string, i: number) => (
                                        <Badge key={i} variant="secondary">{s}</Badge>
                                    )) : <span className="text-sm text-gray-400">-</span>}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Soft Skills / Traits</label>
                                <div className="flex flex-wrap gap-2">
                                    {softSkills.length > 0 ? softSkills.map((s: string, i: number) => (
                                        <Badge key={i} variant="outline">{s}</Badge>
                                    )) : <span className="text-sm text-gray-400">-</span>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN: Transcript */}
                <div className="lg:col-span-2">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="border-b">
                            <CardTitle>Trascrizione Intervista</CardTitle>
                            <p className="text-sm text-gray-500">
                                {new Date(conversation.startedAt).toLocaleString()} • {conversation.messages.length} messaggi
                            </p>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[800px]">
                            {conversation.messages.map((msg: any) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
