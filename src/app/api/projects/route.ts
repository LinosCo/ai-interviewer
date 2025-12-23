import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                ownedProjects: {
                    select: { id: true, name: true }
                },
                projectAccess: {
                    include: { project: { select: { id: true, name: true } } }
                }
            }
        });

        if (!user) return new Response('User not found', { status: 404 });

        // Combine owned projects and projects where user has access
        const projects = [
            ...user.ownedProjects,
            ...user.projectAccess.map(pa => pa.project)
        ];

        // Unique by ID
        const uniqueProjects = Array.from(new Map(projects.map(p => [p.id, p])).values());

        return Response.json(uniqueProjects);

    } catch (error) {
        console.error('Fetch Projects Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
