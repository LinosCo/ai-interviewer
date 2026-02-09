import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bots = await prisma.bot.findMany({
            select: {
                id: true,
                name: true,
                slug: true
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        return NextResponse.json(bots);
    } catch (error) {
        console.error('Error fetching bots for admin:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
