import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response('Unauthorized', { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                ownedProjects: {
                    select: {
                        id: true,
                        name: true,
                        organizationId: true
                    }
                },
                projectAccess: {
                    where: { role: 'OWNER' },
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true,
                                organizationId: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return new Response('User not found', { status: 404 });
        }

        const userProjects = [
            ...user.ownedProjects,
            ...user.projectAccess.map(pa => pa.project)
        ];

        // Unique by ID
        const projects = Array.from(new Map(userProjects.map(p => [p.id, p])).values());

        return NextResponse.json({ projects });

    } catch (error) {
        console.error('Fetch All Projects Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
