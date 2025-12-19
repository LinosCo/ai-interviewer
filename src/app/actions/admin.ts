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
        orderBy: { name: 'asc' },
        include: {
            owner: {
                select: { id: true, name: true, email: true }
            },
            _count: {
                select: { bots: true }
            }
        }
    });
}

export async function transferProject(projectId: string, newOwnerId: string) {
    await requireAdmin();
    console.log(`[AdminAction] Transfer Project: projectId=${projectId} to newOwner=${newOwnerId}`);

    const project = await prisma.project.update({
        where: { id: projectId },
        data: {
            ownerId: newOwnerId
        }
    });

    // Also update access list to ensure new owner has access? 
    // Usually owner has implicit access, but we might want to ensure it.
    // The schema says Project has ownerId.
    // Let's also ensure the user is in ProjectAccess if that's how we track basic visibility?
    // Or does ownerId suffice?
    // Looking at schema: User ownedProjects Project[].
    // Usually owner implies full access.

    revalidatePath('/dashboard/admin/projects');
    return project;
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

    console.log(`[AdminAction] Update User Attempt: userId=${userId}`);
    console.log(`[AdminAction] Data received:`, {
        ...data,
        password: data.password ? `[PRESENT length=${data.password.length}]` : '[UNDEFINED/EMPTY]'
    });
    const { name, email, password, role, projectIds } = data;
    const updateData: any = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) {
        console.log('[AdminAction] Hashing new password...');
        updateData.password = await bcrypt.hash(password, 10);
    } else {
        console.log('[AdminAction] No password provided, skipping update.');
    }
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
    console.log(`Update User Success: userId=${userId}`);
    return user;
}

export async function deleteUser(userId: string) {
    const admin = await requireAdmin();
    if (admin.id === userId) throw new Error('Cannot delete yourself');

    console.log(`Delete User Attempt: userId=${userId} by admin=${admin.email}`);
    await prisma.user.delete({ where: { id: userId } });
    console.log(`Delete User Success: userId=${userId}`);
    revalidatePath('/dashboard/admin/users');
}

export async function createProject(name: string, ownerId: string) {
    await requireAdmin();
    console.log(`[AdminAction] Create Project: name=${name} ownerId=${ownerId}`);

    const project = await prisma.project.create({
        data: {
            name,
            ownerId,
            // Also add owner to access list for clarity
            accessList: {
                create: {
                    userId: ownerId
                }
            }
        }
    });

    revalidatePath('/dashboard/admin/projects');
    return project;
}

export async function createBot(projectId: string, name: string, goal: string) {
    await requireAdmin();
    console.log(`[AdminAction] Create Bot: projectId=${projectId} name=${name}`);

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    const bot = await prisma.bot.create({
        data: {
            name,
            slug,
            researchGoal: goal,
            description: goal,
            projectId,
            status: 'DRAFT'
        }
    });

    revalidatePath(`/dashboard/admin/projects/${projectId}`);
    return bot;
}

export async function transferBot(botId: string, targetProjectId: string) {
    await requireAdmin();
    console.log(`[AdminAction] Transfer Bot: botId=${botId} to projectId=${targetProjectId}`);

    const bot = await prisma.bot.update({
        where: { id: botId },
        data: {
            projectId: targetProjectId
        }
    });

    revalidatePath('/dashboard/admin/projects');
    return bot;
}
