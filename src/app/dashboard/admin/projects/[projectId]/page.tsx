import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth'; // Or reuse the logic if not exported
import ProjectDetailView from './project-detail-view';
import { auth } from '@/auth';

async function checkAdmin() {
    const session = await auth();
    if (!session?.user?.email) return false;
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    return user?.role === 'ADMIN';
}

export default async function AdminProjectDetailPage({ params }: { params: { projectId: string } }) {
    if (!await checkAdmin()) return <div>Access Denied</div>;

    const project = await prisma.project.findUnique({
        where: { id: params.projectId },
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
