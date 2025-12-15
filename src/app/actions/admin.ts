'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

// Middleware-like check for admin
async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.email) throw new Error('Unauthorized');

    const user = await prisma.user.findUnique({
        where: { email: session.user.email }
    });

    if (!user || user.role !== 'ADMIN') {
        throw new Error('Forbidden: Admin access required');
    }
    return user;
}

export async function getUsers() {
    await requireAdmin();
    return await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            projectAccess: {
                include: { project: true }
            }
        }
    });
}

export async function getProjects() {
    await requireAdmin();
    return await prisma.project.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function createUser(data: { name: string; email: string; password?: string; role: UserRole; projectIds: string[] }) {
    await requireAdmin();

    const { name, email, password, role, projectIds } = data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new Error('User with this email already exists');

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role,
            projectAccess: {
                create: projectIds.map(projectId => ({
                    projectId
                }))
            }
        }
    });

    revalidatePath('/dashboard/admin/users');
    return user;
}

export async function updateUser(userId: string, data: { name?: string; email?: string; password?: string; role?: UserRole; projectIds?: string[] }) {
    await requireAdmin();

    const { name, email, password, role, projectIds } = data;
    const updateData: any = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    if (role) updateData.role = role;

    // Handle Project Access Update
    if (projectIds) {
        // First delete existing access, then create new
        // Note: transaction would be better but simple separate ops work for MVP
        await prisma.projectAccess.deleteMany({ where: { userId } });
        updateData.projectAccess = {
            create: projectIds.map(projectId => ({
                projectId
            }))
        };
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data: updateData
    });

    revalidatePath('/dashboard/admin/users');
    return user;
}

export async function deleteUser(userId: string) {
    const admin = await requireAdmin();
    if (admin.id === userId) throw new Error('Cannot delete yourself');

    await prisma.user.delete({ where: { id: userId } });
    revalidatePath('/dashboard/admin/users');
}
