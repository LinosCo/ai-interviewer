import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { ProjectAccessManager } from '../../access-manager';
import { ProjectBrandManager } from './ProjectBrandManager';
import { ProjectToolsManager } from './ProjectToolsManager';
import { ProjectDeleteSection } from './ProjectDeleteSection';
import { ProjectRenameSection } from './ProjectRenameSection';
import { ProjectTransferSection } from './ProjectTransferSection';
import { Button } from "@/components/ui/button";
import { ChevronLeft, LayoutGrid } from "lucide-react";
import Link from 'next/link';
import { assertProjectAccess, hasRequiredRole } from '@/lib/domain/workspace';

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');

    const { projectId } = await params;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, isPersonal: true, organizationId: true }
    });

    if (!project) notFound();

    const projectAccess = await assertProjectAccess(session.user.id, projectId, 'MEMBER')
        .catch(() => redirect('/dashboard/projects'));
    const canManageProject = projectAccess.isPlatformAdmin || hasRequiredRole(projectAccess.role, 'ADMIN');

    // Fetch user organizations for transfer
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            memberships: {
                where: { role: { in: ['OWNER', 'ADMIN'] } },
                include: { organization: { select: { id: true, name: true } } }
            }
        }
    });

    const availableOrganizations = user?.memberships.map(m => m.organization) || [];
    if (!canManageProject) {
        redirect('/dashboard/projects');
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/projects">
                    <Button variant="ghost" size="sm" className="rounded-full p-2">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                        <LayoutGrid className="w-3 h-3" />
                        <span>Progetti</span>
                        <span className="text-slate-200">/</span>
                        <span className="text-slate-900">{project.name}</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Impostazioni Progetto</h1>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-amber-50 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Control Center</p>
                <p className="mt-1 text-sm text-slate-700">
                    Qui gestisci identità progetto, trasferimenti tra organizzazioni, membri, strumenti e monitor.
                    Tutto è allineato al modello organizzazione-first.
                </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                <div className="space-y-8 lg:col-span-2">
                    <ProjectRenameSection projectId={projectId} projectName={project.name} />

                    {canManageProject && (
                        <ProjectTransferSection
                            projectId={projectId}
                            projectName={project.name}
                            currentOrgId={project.organizationId || ''}
                            availableOrganizations={availableOrganizations}
                        />
                    )}

                    <ProjectToolsManager projectId={projectId} projectName={project.name} />

                    <ProjectDeleteSection projectId={projectId} projectName={project.name} />
                </div>

                <div className="space-y-8">
                    <ProjectAccessManager projectId={projectId} />
                    <ProjectBrandManager projectId={projectId} projectName={project.name} />
                </div>
            </div>
        </div>
    );
}
