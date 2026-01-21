import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import {
    LayoutGrid,
    Bot,
    MessageSquare,
    Eye,
    Plus,
    Settings2,
    BarChart3,
    Calendar,
    ArrowRight,
    Users,
    Zap,
    Search
} from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function ProjectCockpitPage({ params }: { params: Promise<{ projectId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');
    const userId = session.user.id;

    const { projectId } = await params;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            bots: {
                orderBy: { updatedAt: 'desc' },
                include: { _count: { select: { conversations: true } } }
            },
            visibilityConfigs: {
                orderBy: { createdAt: 'desc' },
                include: { scans: { orderBy: { startedAt: 'desc' }, take: 1 } }
            },
            owner: { select: { name: true, email: true } },
            accessList: { include: { user: { select: { name: true, email: true } } } }
        }
    });

    if (!project) notFound();

    // Verify access
    const hasAccess = project.ownerId === userId || project.accessList.some(a => a.userId === userId);
    if (!hasAccess) redirect('/dashboard/projects');

    const interviews = project.bots.filter(b => (b as any).botType === 'interview' || !(b as any).botType);
    const chatbots = project.bots.filter(b => (b as any).botType === 'chatbot');
    const trackers = project.visibilityConfigs;

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-2 border-b border-slate-100">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                        <Link href="/dashboard/projects" className="hover:text-amber-600 transition-colors">Progetti</Link>
                        <span className="text-slate-200">/</span>
                        <span className="text-slate-900">{project.name}</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        {project.name}
                        <Badge className="bg-amber-50 text-amber-600 border-amber-100 font-bold uppercase text-[9px]">Cockpit</Badge>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <Link href={`/dashboard/projects/${projectId}/settings`}>
                        <Button variant="outline" size="sm" className="rounded-xl font-bold bg-white text-slate-700 border-slate-200 hover:border-amber-500 transition-all">
                            <Users className="w-4 h-4 mr-2" />
                            Gestisci Accessi
                        </Button>
                    </Link>
                    <Link href={`/dashboard/projects/${projectId}/analytics`}>
                        <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md font-bold transition-all px-5">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Analytics Unificati
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Bots & Trackers */}
                <div className="lg:col-span-2 space-y-10">

                    {/* Interviews Section */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-amber-500" />
                                Interviste AI
                            </h3>
                            <Link href={`/onboarding?projectId=${projectId}`}>
                                <Button variant="ghost" size="sm" className="text-amber-600 font-bold hover:bg-amber-50 rounded-lg">
                                    <Plus className="w-4 h-4 mr-1" /> Nuova
                                </Button>
                            </Link>
                        </div>
                        {interviews.length === 0 ? (
                            <Card className="border-dashed bg-slate-50/50">
                                <CardContent className="py-10 text-center">
                                    <p className="text-sm text-slate-500 mb-4">Nessuna intervista creata in questo progetto.</p>
                                    <Link href={`/onboarding?projectId=${projectId}`}>
                                        <Button size="sm" variant="outline" className="rounded-xl font-bold">Crea la prima intervista</Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {interviews.map(bot => (
                                    <Link key={bot.id} href={`/dashboard/bots/${bot.id}`}>
                                        <Card className="hover:border-amber-200 transition-all group hover:shadow-lg hover:shadow-slate-200/40">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                                                        <MessageSquare className="w-4 h-4" />
                                                    </div>
                                                    <Badge variant="secondary" className="text-[9px] uppercase font-bold bg-slate-100">
                                                        {bot._count.conversations} Risposte
                                                    </Badge>
                                                </div>
                                                <h4 className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">{bot.name}</h4>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{bot.description || 'Nessuna descrizione'}</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Chatbots Section */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <Bot className="w-5 h-5 text-blue-500" />
                                Chatbot Assistenti
                            </h3>
                            <Link href={`/dashboard/bots/create-chatbot?projectId=${projectId}`}>
                                <Button variant="ghost" size="sm" className="text-blue-600 font-bold hover:bg-blue-50 rounded-lg">
                                    <Plus className="w-4 h-4 mr-1" /> Nuovo
                                </Button>
                            </Link>
                        </div>
                        {chatbots.length === 0 ? (
                            <Card className="border-dashed bg-slate-50/50">
                                <CardContent className="py-10 text-center">
                                    <p className="text-sm text-slate-500 mb-4">Nessun chatbot configurato per questo progetto.</p>
                                    <Link href={`/dashboard/bots/create-chatbot?projectId=${projectId}`}>
                                        <Button size="sm" variant="outline" className="rounded-xl font-bold">Configura un chatbot</Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {chatbots.map(bot => (
                                    <Link key={bot.id} href={`/dashboard/bots/${bot.id}`}>
                                        <Card className="hover:border-blue-200 transition-all group hover:shadow-lg hover:shadow-slate-200/40">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                                        <Bot className="w-4 h-4" />
                                                    </div>
                                                    <Badge variant="secondary" className="text-[9px] uppercase font-bold bg-slate-100">
                                                        {bot._count.conversations} Sessioni
                                                    </Badge>
                                                </div>
                                                <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{bot.name}</h4>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{bot.description || 'Nessuna descrizione'}</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Sezione Presenza Online */}
                    <div className="bg-white rounded-[2rem] border border-stone-100 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-purple-500" />
                                    Monitor visibilità
                                </h3>
                            </div>
                            <Link href={`/dashboard/visibility/create?projectId=${projectId}`}>
                                <Button variant="ghost" size="sm" className="text-purple-600 font-bold hover:bg-purple-50 rounded-lg">
                                    <Plus className="w-4 h-4 mr-1" /> Nuovo
                                </Button>
                            </Link>
                        </div>
                        {trackers.length === 0 ? (
                            <div className="text-center py-10 bg-stone-50 rounded-2xl border border-stone-100">
                                <Search className="w-10 h-10 text-stone-300 mx-auto mb-4" />
                                <p className="text-stone-500 mb-6">
                                    Configura almeno un un <strong>monitoraggio visibilità</strong> per iniziare a ricevere insights unificati su questo progetto.
                                </p>
                                <Link href={`/dashboard/visibility/create?projectId=${projectId}`}>
                                    <Button size="sm" variant="outline" className="rounded-xl font-bold">Attiva monitoraggio</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {trackers.map(config => (
                                    <Link key={config.id} href={`/dashboard/visibility`}>
                                        <Card className="hover:border-purple-200 transition-all group hover:shadow-lg hover:shadow-slate-200/40">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                                                        <Eye className="w-4 h-4" />
                                                    </div>
                                                    <Badge className="bg-purple-100 text-purple-700 border-none font-black text-[9px] uppercase">
                                                        Score: {config.scans[0]?.score || 0}%
                                                    </Badge>
                                                </div>
                                                <h4 className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors uppercase tracking-tight">{config.brandName}</h4>
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{config.category}</p>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Project Info & Quick Tools */}
                <div className="space-y-8">
                    <Card className="bg-slate-900 border-none shadow-xl overflow-hidden text-white relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl -mr-16 -mt-16 rounded-full" />
                        <CardHeader className="relative z-10">
                            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-amber-500">Project Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 relative z-10">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Proprietario</p>
                                <p className="text-sm font-bold">{project.owner?.name || project.owner?.email}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Team Access</p>
                                <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-black border-2 border-slate-900" title="Proprietario">
                                        {project.owner?.email[0].toUpperCase()}
                                    </div>
                                    {project.accessList.map(a => (
                                        <div key={a.userId} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-black border-2 border-slate-900" title={a.user.email}>
                                            {a.user.email[0].toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4">
                                <Link href={`/dashboard/projects/${projectId}/settings`}>
                                    <Button variant="outline" className="w-full bg-transparent border-slate-700 text-white hover:bg-slate-800 text-xs font-black uppercase tracking-widest h-10 rounded-xl">
                                        Gestisci Team
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200">
                        <CardHeader>
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900">Suggerimenti AI</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <Zap className="w-5 h-5 text-amber-600 flex-shrink-0" />
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    Configura almeno un un <strong>monitoraggio visibilità</strong> per iniziare a ricevere insights unificati su questo progetto.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
