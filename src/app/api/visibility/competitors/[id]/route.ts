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
        const { name, website, enabled } = body;

        const competitor = await prisma.competitor.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(website !== undefined && { website }),
                ...(enabled !== undefined && { enabled })
            }
        });

        return NextResponse.json({ success: true, competitor });

    } catch (error) {
        console.error('Error updating competitor:', error);
        return NextResponse.json(
            { error: 'Failed to update competitor' },
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

        await prisma.competitor.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting competitor:', error);
        return NextResponse.json(
            { error: 'Failed to delete competitor' },
            { status: 500 }
        );
    }
}
