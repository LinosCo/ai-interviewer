import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    LayoutGrid,
    Plus,
    Bot,
    MessageSquare,
    ArrowRight,
    Users,
    Settings2,
    BarChart3,
    Calendar,
    ChevronRight,
    Eye
} from "lucide-react";
import Link from 'next/link';

export default async function ProjectsDashboardPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: {
                include: {
                    bots: { select: { id: true } },
                    visibilityConfigs: { select: { id: true } },
                    _count: { select: { accessList: true } }
                }
            },
            projectAccess: {
                include: {
                    project: {
                        include: {
                            owner: { select: { name: true, email: true } },
                            bots: { select: { id: true } },
                            visibilityConfigs: { select: { id: true } }
                        }
                    }
                }
            }
        }
    });

    if (!user) return null;

    const ownedProjects = user.ownedProjects.map(p => ({ ...p, isOwner: true }));
    const sharedProjects = user.projectAccess.map(pa => ({ ...pa.project, isOwner: false }));
    const allProjects = [...ownedProjects, ...sharedProjects];

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                        I Miei Progetti
                    </h2>
                    <p className="text-muted-foreground font-medium">
                        Gestisci i tuoi spazi di lavoro, chatbot e monitoraggio brand.
                    </p>
                </div>
                <Link href="/dashboard/projects/new">
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-200 px-6">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuovo Progetto
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allProjects.length === 0 ? (
                    <Card className="col-span-full border-dashed border-2 bg-slate-50/50">
                        <CardContent className="flex flex-col items-center py-20 text-center">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 rotate-3">
                                <LayoutGrid className="w-8 h-8 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Nessun progetto attivo</h3>
                            <p className="text-sm text-slate-500 max-w-sm mt-2">
                                Crea il tuo primo progetto per iniziare a configurare chatbot e interviste.
                            </p>
                            <Link href="/dashboard/projects/new" className="mt-6">
                                <Button variant="outline" className="rounded-xl font-bold">Inizia Ora</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    allProjects.map((project) => (
                        <Card key={project.id} className="group overflow-hidden border-slate-200 hover:border-amber-200 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg font-bold group-hover:text-amber-600 transition-colors">
                                                {project.name}
                                            </CardTitle>
                                            {!project.isOwner && (
                                                <Badge variant="outline" className="text-[9px] uppercase font-black bg-blue-50 text-blue-600 border-blue-100">
                                                    Shared
                                                </Badge>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs flex items-center gap-1 font-medium">
                                            <Calendar className="w-3 h-3" />
                                            Creato il {new Date(project.createdAt).toLocaleDateString('it-IT')}
                                        </CardDescription>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-amber-50 transition-colors">
                                        <div className="w-4 h-4 text-slate-400 group-hover:text-amber-600">
                                            <ChevronRight />
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-white group-hover:border-amber-100 transition-all">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assistenti</p>
                                        <div className="flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-slate-400" />
                                            <span className="text-lg font-black text-slate-900">{project.bots.length}</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-white group-hover:border-amber-100 transition-all">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tracker</p>
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-slate-400" />
                                            <span className="text-lg font-black text-slate-900">{project.visibilityConfigs.length}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex -space-x-2">
                                        <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold" title={project.isOwner ? 'Tu' : (project as any).owner?.email}>
                                            {project.isOwner ? 'ME' : (project as any).owner?.email[0].toUpperCase()}
                                        </div>
                                        {project.isOwner && (project as any)._count?.accessList > 0 && (
                                            <div className="w-7 h-7 rounded-full border-2 border-white bg-amber-500 flex items-center justify-center text-[10px] font-bold text-white">
                                                +{(project as any)._count.accessList}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {project.isOwner && (
                                            <Link href={`/dashboard/projects/${project.id}/settings`}>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                                                    <Settings2 className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                        )}
                                        <Link href={`/dashboard/projects/${project.id}`}>
                                            <Button size="sm" className="h-8 rounded-full px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1">
                                                Apri <ArrowRight className="w-3 h-3" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
