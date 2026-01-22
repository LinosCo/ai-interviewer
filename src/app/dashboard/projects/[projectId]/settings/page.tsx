import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { ProjectAccessManager } from '../../access-manager';
import { ProjectBrandManager } from './ProjectBrandManager';
import { ProjectToolsManager } from './ProjectToolsManager';
import { ProjectDeleteSection } from './ProjectDeleteSection';
import { Button } from "@/components/ui/button";
import { ChevronLeft, LayoutGrid } from "lucide-react";
import Link from 'next/link';

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');

    const { projectId } = await params;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, ownerId: true, isPersonal: true }
    });

    if (!project) notFound();

    // Check user has access (via ProjectAccess with OWNER role)
    const userAccess = await prisma.projectAccess.findUnique({
        where: {
            userId_projectId: {
                userId: session.user.id,
                projectId
            }
        }
    });

    // Only OWNER can access settings
    if (!userAccess || userAccess.role !== 'OWNER') {
        redirect('/dashboard/projects');
    }

    return (
        <div className="space-y-6 p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/projects">
                    <Button variant="ghost" size="sm" className="rounded-full p-2">
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

                {/* Tools Manager - Associate bots */}
                <ProjectToolsManager projectId={projectId} projectName={project.name} />

                {/* Brand Manager */}
                <ProjectBrandManager projectId={projectId} projectName={project.name} />

                {/* Delete Project Section - only for non-personal projects */}
                {!project.isPersonal && (
                    <ProjectDeleteSection projectId={projectId} projectName={project.name} />
                )}
            </div>
        </div>
    );
}
