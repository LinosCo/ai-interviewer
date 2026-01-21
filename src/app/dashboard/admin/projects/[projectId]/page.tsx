import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/admin-auth';
import ProjectDetailView from './project-detail-view';

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
    if (!await checkAdmin()) return <div>Access Denied</div>;

    const { projectId } = await params;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            owner: true,
            bots: {
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!project) notFound();

    // Fetch all projects for transfer destination options
    const allProjects = await prisma.project.findMany({
        select: { id: true, name: true }
    });

    return <ProjectDetailView project={project} allProjects={allProjects} />;
}
