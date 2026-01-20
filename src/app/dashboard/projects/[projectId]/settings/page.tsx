import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { ProjectAccessManager } from '../../access-manager';
import { Button } from "@/components/ui/button";
import { ChevronLeft, LayoutGrid, Settings } from "lucide-react";
import Link from 'next/link';

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');

    const { projectId } = await params;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, ownerId: true }
    });

    if (!project) notFound();
    if (project.ownerId !== session.user.id) redirect('/dashboard/projects');

    return (
        <div className="space-y-6 p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/projects">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
                        <LayoutGrid className="w-3 h-3" />
                        <span>Progetti</span>
                        <span className="text-slate-200">/</span>
                        <span className="text-slate-900">{project.name}</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Impostazioni Progetto</h1>
                </div>
            </div>

            <div className="grid gap-8">
                {/* Sharing Manager */}
                <ProjectAccessManager projectId={projectId} />

                {/* Additional Settings could go here (Rename, Delete) */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-slate-400" />
                        <h3 className="font-bold text-slate-900">Configurazioni Base</h3>
                    </div>
                    <p className="text-sm text-slate-500">In questa sezione potrai rinominare o eliminare definitivamente il progetto (disponibile a breve).</p>
                </div>
            </div>
        </div>
    );
}
