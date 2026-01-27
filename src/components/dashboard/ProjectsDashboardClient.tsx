'use client';

import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    LayoutGrid,
    Plus,
    Bot,
    ArrowRight,
    Calendar,
    ChevronRight,
    Eye,
    Settings2
} from "lucide-react";
import Link from 'next/link';

export default function ProjectsDashboardClient() {
    const { projects, loading: projectsLoading } = useProject();
    const { currentOrganization, loading: orgLoading } = useOrganization();

    const loading = projectsLoading || orgLoading;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-600 mb-4" />
                <p className="text-gray-500 font-medium">Caricamento progetti...</p>
            </div>
        );
    }

    if (!currentOrganization) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                <LayoutGrid className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-900">Seleziona un Team</h3>
                <p className="text-gray-500 max-w-sm mt-2">
                    Scegli uno spazio di lavoro dalla barra laterale per vedere i relativi progetti.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                        Progetti - {currentOrganization.name}
                    </h2>
                    <p className="text-muted-foreground font-medium">
                        Gestisci i tuoi spazi di lavoro, chatbot e monitoraggio brand.
                    </p>
                </div>
                <Link href={`/dashboard/projects/new?orgId=${currentOrganization.id}`}>
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-200 px-6">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuovo Progetto
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.length === 0 ? (
                    <Card className="col-span-full border-dashed border-2 bg-slate-50/50 rounded-3xl">
                        <CardContent className="flex flex-col items-center py-20 text-center">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md mb-6 rotate-3">
                                <LayoutGrid className="w-8 h-8 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Nessun progetto attivo</h3>
                            <p className="text-sm text-slate-500 max-w-sm mt-2">
                                Crea il tuo primo progetto per iniziare a configurare chatbot e interviste in questo team.
                            </p>
                            <Link href={`/dashboard/projects/new?orgId=${currentOrganization.id}`} className="mt-6">
                                <Button variant="outline" className="rounded-xl font-bold">Inizia Ora</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    projects.map((project: any) => (
                        <Card key={project.id} className="group overflow-hidden border-slate-200 hover:border-amber-200 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 rounded-2xl">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg font-bold group-hover:text-amber-600 transition-colors">
                                                {project.name}
                                            </CardTitle>
                                            {project.isPersonal && (
                                                <Badge variant="outline" className="text-[9px] uppercase font-black bg-amber-50 text-amber-600 border-amber-100">
                                                    Personale
                                                </Badge>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs flex items-center gap-1 font-medium">
                                            <Calendar className="w-3 h-3" />
                                            Attivo
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
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                        <div className="flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm font-bold text-slate-700">Online</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-white group-hover:border-amber-100 transition-all">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tracker</p>
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm font-bold text-slate-700">Attivo</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex -space-x-2">
                                        <div className="w-7 h-7 rounded-full border-2 border-white bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700" title="Tu">
                                            TU
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link href={`/dashboard/projects/${project.id}/settings`}>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                                                <Settings2 className="w-4 h-4" />
                                            </Button>
                                        </Link>
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
