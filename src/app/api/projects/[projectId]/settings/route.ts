import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateSettingsSchema = z.object({
    strategicVision: z.string().optional(),
    valueProposition: z.string().optional()
});

export async function GET(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId } = await params;

        // Check user has access to project
        const access = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId
                }
            }
        });

        if (!access) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                name: true,
                strategicVision: true,
                valueProposition: true
            }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json(project);

    } catch (error) {
        console.error('Get project settings error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { projectId } = await params;
        const body = await req.json();
        const data = updateSettingsSchema.parse(body);

        // Check user has access (any access can update strategy for now)
        const access = await prisma.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId
                }
            }
        });

        if (!access) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data: {
                strategicVision: data.strategicVision,
                valueProposition: data.valueProposition
            },
            select: {
                id: true,
                name: true,
                strategicVision: true,
                valueProposition: true
            }
        });

        return NextResponse.json(project);

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
        }
        console.error('Update project settings error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
