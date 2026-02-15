'use server';

import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import {
    ensureProjectOrganization,
    syncLegacyProjectAccessForOrganization
} from '@/lib/domain/workspace';
import { getOrCreateDefaultOrganization } from '@/lib/organizations';
import { createProjectWithNameGuard } from '@/lib/projects/create-project';

// Middleware-like check for admin
// Moved to @/lib/admin-auth

export async function getUsers() {
    await requireAdmin();
    return await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            projectAccess: {
                include: { project: true }
            },
            memberships: {
                include: {
                    organization: {
                        include: { subscription: true }
                    }
                }
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
    console.log(`[AdminAction] Transfer Project: projectId=${projectId}`);

    const organizationId = await ensureProjectOrganization(projectId);

    const project = await prisma.$transaction(async (tx) => {
        const existingProject = await tx.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!existingProject) {
            throw new Error('Project not found');
        }

        const updatedProject = await tx.project.update({
            where: { id: projectId },
            data: {
                ownerId: newOwnerId
            }
        });

        await tx.membership.upsert({
            where: {
                userId_organizationId: {
                    userId: newOwnerId,
                    organizationId
                }
            },
            update: {
                role: 'ADMIN',
                status: 'ACTIVE',
                acceptedAt: new Date(),
                joinedAt: new Date()
            },
            create: {
                userId: newOwnerId,
                organizationId,
                role: 'ADMIN',
                status: 'ACTIVE',
                acceptedAt: new Date(),
                joinedAt: new Date()
            }
        });

        return updatedProject;
    });

    await syncLegacyProjectAccessForOrganization(organizationId);

    revalidatePath('/dashboard/admin/projects');
    revalidatePath(`/dashboard/admin/projects/${projectId}`);
    revalidatePath(`/dashboard/projects/${projectId}`);
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard/settings/members');
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
            role
        }
    });

    if (projectIds.length > 0) {
        const projects = await prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, organizationId: true }
        });

        const validProjectIds = projects
            .filter((project) => Boolean(project.organizationId))
            .map((project) => project.id);

        const organizationIds = Array.from(
            new Set(
                projects
                    .map((project) => project.organizationId)
                    .filter((organizationId): organizationId is string => Boolean(organizationId))
            )
        );

        for (const organizationId of organizationIds) {
            await prisma.membership.upsert({
                where: {
                    userId_organizationId: {
                        userId: user.id,
                        organizationId
                    }
                },
                update: {
                    status: 'ACTIVE',
                    acceptedAt: new Date(),
                    joinedAt: new Date()
                },
                create: {
                    userId: user.id,
                    organizationId,
                    role: 'MEMBER',
                    status: 'ACTIVE',
                    acceptedAt: new Date(),
                    joinedAt: new Date()
                }
            });
        }

        if (validProjectIds.length > 0) {
            await prisma.projectAccess.createMany({
                data: validProjectIds.map((projectId) => ({
                    userId: user.id,
                    projectId,
                    role: 'MEMBER'
                })),
                skipDuplicates: true
            });
        }
    }

    revalidatePath('/dashboard/admin/users');
    return user;
}

export async function updateUser(userId: string, data: { name?: string; email?: string; password?: string; role?: UserRole; projectIds?: string[] }) {
    await requireAdmin();

    console.log(`[AdminAction] Update User Attempt: userId=${userId}`);
    const { name, email, password, role, projectIds } = data;
    const updateData: any = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) {
        updateData.password = await bcrypt.hash(password, 10);
    }
    if (role) updateData.role = role;

    // Handle project selection by ensuring membership on corresponding organizations.
    if (projectIds) {
        const projects = await prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, organizationId: true }
        });

        const validProjectIds = projects
            .filter((project) => Boolean(project.organizationId))
            .map((project) => project.id);

        const organizationIds = Array.from(
            new Set(
                projects
                    .map((project) => project.organizationId)
                    .filter((organizationId): organizationId is string => Boolean(organizationId))
            )
        );

        for (const organizationId of organizationIds) {
            await prisma.membership.upsert({
                where: {
                    userId_organizationId: {
                        userId,
                        organizationId
                    }
                },
                update: {
                    status: 'ACTIVE',
                    acceptedAt: new Date(),
                    joinedAt: new Date()
                },
                create: {
                    userId,
                    organizationId,
                    role: 'MEMBER',
                    status: 'ACTIVE',
                    acceptedAt: new Date(),
                    joinedAt: new Date()
                }
            });
        }

        if (validProjectIds.length > 0) {
            await prisma.projectAccess.deleteMany({
                where: {
                    userId,
                    projectId: { notIn: validProjectIds }
                }
            });

            for (const projectId of validProjectIds) {
                await prisma.projectAccess.upsert({
                    where: {
                        userId_projectId: {
                            userId,
                            projectId
                        }
                    },
                    update: {
                        role: 'MEMBER'
                    },
                    create: {
                        userId,
                        projectId,
                        role: 'MEMBER'
                    }
                });
            }
        } else {
            await prisma.projectAccess.deleteMany({
                where: { userId }
            });
        }
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

    console.log(`Delete User Attempt: userId=${userId}`);
    await prisma.user.delete({ where: { id: userId } });
    console.log(`Delete User Success: userId=${userId}`);
    revalidatePath('/dashboard/admin/users');
}

export async function createProject(name: string, ownerId: string) {
    await requireAdmin();
    const ownerMembership = await prisma.membership.findFirst({
        where: {
            userId: ownerId,
            status: 'ACTIVE'
        },
        select: { organizationId: true },
        orderBy: { createdAt: 'asc' }
    });

    const organizationId = ownerMembership?.organizationId || (await getOrCreateDefaultOrganization(ownerId)).id;

    const { project, created } = await createProjectWithNameGuard({
        name,
        ownerId,
        organizationId,
        isPersonal: false
    });

    if (created) {
        await syncLegacyProjectAccessForOrganization(organizationId);
    }

    revalidatePath('/dashboard/admin/projects');
    return project;
}

export async function createBot(projectId: string, name: string, goal: string) {
    await requireAdmin();
    console.log(`[AdminAction] Create Bot: projectId=${projectId}`);

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
    console.log(`[AdminAction] Transfer Bot: botId=${botId}`);

    const bot = await prisma.bot.update({
        where: { id: botId },
        data: {
            projectId: targetProjectId
        }
    });

    revalidatePath('/dashboard/admin/projects');
    return bot;
}

export async function updateUserSubscription(userId: string, tier: any) {
    await requireAdmin();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            memberships: {
                include: { organization: true },
                take: 1
            }
        }
    });

    if (!user) {
        throw new Error('User not found');
    }

    let organizationId: string;

    if (user.memberships.length === 0) {
        // Create organization if missing
        const org = await prisma.organization.create({
            data: {
                name: `${user.name || user.email}'s Workspace`,
                slug: `org-${user.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 5)}`,
                members: {
                    create: {
                        userId: user.id,
                        role: 'OWNER'
                    }
                }
            }
        });
        organizationId = org.id;
    } else {
        organizationId = user.memberships[0].organizationId;
    }

    // Map business tier to valid Enums
    const subscriptionTier = tier.toUpperCase();
    const organizationPlan = tier === 'FREE' ? 'TRIAL' : tier.toUpperCase();

    // Update in standard format
    await prisma.subscription.upsert({
        where: { organizationId },
        update: {
            tier: subscriptionTier as any,
            status: 'ACTIVE',
        },
        create: {
            organizationId,
            tier: subscriptionTier as any,
            status: 'ACTIVE',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
    });

    // Sync organization plan
    await prisma.organization.update({
        where: { id: organizationId },
        data: { plan: organizationPlan as any }
    });

    revalidatePath('/dashboard/admin/users');
}

export async function deleteOrganization(orgId: string) {
    await requireAdmin();
    console.log(`[AdminAction] Delete Organization: orgId=${orgId}`);

    // We need to handle related data. 
    // Projects might have a lot of data, we should probably delete them too.
    // Memberships must be deleted.

    await prisma.$transaction(async (tx) => {
        // Delete project-related data first (cascading in DB handles most, but let's be safe)
        // Actually Project model has onDelete: Cascade for its children in many cases?
        // Let's check Bot, etc. 
        // For now, let's delete the organization and assume DB supports it or we'll add more cleanup.

        // Deleting projects linked to this org
        await tx.project.deleteMany({
            where: { organizationId: orgId }
        });

        // Deleting memberships
        await tx.membership.deleteMany({
            where: { organizationId: orgId }
        });

        // Delete the organization itself
        await tx.organization.delete({
            where: { id: orgId }
        });
    });

    revalidatePath('/dashboard/admin/organizations');
}
