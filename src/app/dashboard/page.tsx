import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import ProjectCard from '@/components/project-card';

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.email) redirect('/login');

    const userQuery = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            ownedProjects: {
                include: { bots: true }
            },
            projectAccess: {
                include: {
                    project: {
                        include: { bots: true }
                    }
                }
            }
        }
    });

    if (!userQuery) return <div>User not found.</div>;

    let projects = [];

    if (userQuery.role === 'ADMIN') {
        // Admins see all projects
        projects = await prisma.project.findMany({
            include: { bots: true },
            orderBy: { createdAt: 'desc' }
        });
    } else {
        // Users see owned + assigned projects
        const assignedProjects = userQuery.projectAccess.map(pa => pa.project);

        // Remove duplicates if any
        const allProjects = [...userQuery.ownedProjects, ...assignedProjects];
        const uniqueIds = new Set();
        projects = allProjects.filter(p => {
            if (uniqueIds.has(p.id)) return false;
            uniqueIds.add(p.id);
            return true;
        });
    }



    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Your Projects</h1>
                <Link href="/dashboard/projects/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    + New Project
                </Link>
            </div>

            {projects.length === 0 ? (
                <div className="p-8 border rounded bg-gray-50 text-center text-gray-500">
                    <p>You don't have any projects yet.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {projects.map((project: any) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            userId={userQuery.id}
                            isAdmin={userQuery.role === 'ADMIN'}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
