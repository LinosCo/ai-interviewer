import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });
        if (currentUser?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bots = await prisma.bot.findMany({
            where: {
                botType: 'interview',
                status: 'PUBLISHED'
            },
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
