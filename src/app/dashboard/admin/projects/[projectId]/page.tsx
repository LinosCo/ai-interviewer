import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/admin-auth';
import ProjectDetailView from './project-detail-view';
import { ensureProjectOrganization } from '@/lib/domain/workspace';

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
    if (!await checkAdmin()) return <div>Access Denied</div>;

    const { projectId } = await params;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            owner: true,
            bots: {
                orderBy: { createdAt: 'desc' }
            },
            visibilityConfigs: true, // Fetch currently associated configs
            organization: true
        }
    });

    if (!project) notFound();

    // Fetch all projects for transfer destination options
    const allProjects = await prisma.project.findMany({
        select: { id: true, name: true }
    });

    // Fetch all organizations for project transfer
    const allOrganizations = await prisma.organization.findMany({
        select: { id: true, name: true }
    });

    // Normalize legacy projects without organization and keep details in one org scope.
    const orgId = project.organizationId || await ensureProjectOrganization(project.id);

    let availableBots: any[] = [];
    let availableVisibilityConfigs: any[] = [];

    if (orgId) {
        // Fetch bots from other projects in the same organization
        availableBots = await prisma.bot.findMany({
            where: {
                project: {
                    organizationId: orgId
                },
                projectId: {
                    not: project.id
                }
            },
            include: {
                project: {
                    select: { name: true }
                }
            }
        });

        // Fetch visibility configs in the organization not already in this project
        availableVisibilityConfigs = await prisma.visibilityConfig.findMany({
            where: {
                organizationId: orgId,
                OR: [
                    { projectId: null },
                    { projectId: { not: project.id } }
                ]
            },
            include: {
                project: {
                    select: { name: true }
                }
            }
        });
    }

    return (
        <ProjectDetailView
            project={project}
            allProjects={allProjects}
            allOrganizations={allOrganizations}
            availableBots={availableBots}
            availableVisibilityConfigs={availableVisibilityConfigs}
        />
    );
}
