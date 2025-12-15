import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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
                        <div key={project.id} className="border p-6 rounded-lg bg-white shadow-sm">
                            <h2 className="font-semibold text-lg text-gray-800 mb-4">{project.name}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {project.bots.map((bot: any) => (
                                    <Link key={bot.id} href={`/dashboard/bots/${bot.id}`} className="block border p-4 rounded hover:border-blue-500 hover:shadow-md transition">
                                        <div className="font-medium">{bot.name}</div>
                                        <div className="text-sm text-gray-500 mt-1 truncate">{bot.description || 'No description'}</div>
                                    </Link>
                                ))}
                                <Link href={`/dashboard/projects/${project.id}/bots/new`} className="flex items-center justify-center border-2 border-dashed p-4 rounded text-gray-500 hover:text-blue-600 hover:border-blue-300 transition">
                                    + Create Bot
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
