import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import OrganizationsView from './organizations-view';

export default async function AdminOrganizationsPage() {
    const session = await auth();
    if (!session?.user?.email) {
        redirect('/login');
    }

    // Double check admin role
    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    if (user?.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    // Fetch organizations using the same logic as the API or just call the API logic internally
    // For simplicity and to avoid duplicated logic, we can fetch directly from prisma here
    const organizations = await prisma.organization.findMany({
        include: {
            members: {
                where: { role: 'OWNER' },
                include: {
                    user: {
                        select: { email: true, name: true }
                    }
                }
            },
            projects: {
                include: {
                    _count: {
                        select: { bots: true }
                    }
                }
            },
            visibilityConfigs: {
                select: { id: true }
            },
            subscription: true,
            _count: {
                select: {
                    members: true,
                    projects: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const enrichedOrgs = organizations.map(org => {
        const botCount = org.projects.reduce((acc, p) => acc + p._count.bots, 0);
        const toolCount = org.visibilityConfigs.length;

        return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            createdAt: org.createdAt.toISOString(),
            plan: org.plan,
            tier: org.subscription?.tier || 'FREE',
            owner: org.members[0] ? {
                name: org.members[0].user.name,
                email: org.members[0].user.email
            } : null,
            members: org._count.members,
            projectCount: org._count.projects,
            botCount,
            toolCount,
            projects: org.projects,
        };
    });

    return (
        <div className="flex-1 overflow-y-auto">
            <OrganizationsView organizations={enrichedOrgs} />
        </div>
    );
}
