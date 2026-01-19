import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { text, enabled } = body;

        const prompt = await prisma.visibilityPrompt.update({
            where: { id },
            data: {
                ...(text !== undefined && { text, lastEditedAt: new Date() }),
                ...(enabled !== undefined && { enabled })
            }
        });

        return NextResponse.json({ success: true, prompt });

    } catch (error) {
        console.error('Error updating prompt:', error);
        return NextResponse.json(
            { error: 'Failed to update prompt' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        await prisma.visibilityPrompt.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting prompt:', error);
        return NextResponse.json(
            { error: 'Failed to delete prompt' },
            { status: 500 }
        );
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const prompt = await prisma.visibilityPrompt.findUnique({
            where: { id },
            include: {
                responses: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        scan: {
                            select: {
                                id: true,
                                startedAt: true,
                                completedAt: true
                            }
                        }
                    }
                }
            }
        });

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
        }

        return NextResponse.json({ prompt });

    } catch (error) {
        console.error('Error fetching prompt:', error);
        return NextResponse.json(
            { error: 'Failed to fetch prompt' },
            { status: 500 }
        );
    }
}
