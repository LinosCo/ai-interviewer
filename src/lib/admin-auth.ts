import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.email) {
        throw new Error('Unauthorized');
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    if (!user || user.role !== 'ADMIN') {
        throw new Error('Forbidden: Admin access required');
    }
    return user;
}

export async function checkAdmin() {
    const session = await auth();
    if (!session?.user?.email) return false;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    return user?.role === 'ADMIN';
}
