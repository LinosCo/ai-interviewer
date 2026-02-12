/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import { PrismaClient, PlanType, Role, MemberStatus } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function migrate() {
    console.log('🚀 Starting Organization migration...');

    // 1. Get all users with their current plan/credits
    const users = await prisma.user.findMany({
        include: {
            ownedProjects: true,
            memberships: true,
        }
    });

    console.log(`👥 Found ${users.length} users to migrate.`);

    for (const user of users) {
        try {
            // Check if user already has a personal organization
            const existingPersonalOrg = await prisma.organization.findFirst({
                where: {
                    members: {
                        some: {
                            userId: user.id,
                            role: 'OWNER'
                        }
                    },
                    name: { contains: 'Personal' }
                }
            });

            if (existingPersonalOrg) {
                console.log(`⏭️  User ${user.email} already has a personal organization. Skipping creation.`);
            } else {
                await prisma.$transaction(async (tx) => {
                    // Create Personal Organization
                    const orgName = `${user.name || user.email.split('@')[0]}'s Personal Organization`;
                    const slug = `${user.email.split('@')[0]}-personal-${crypto.randomBytes(4).toString('hex')}`;

                    const org = await tx.organization.create({
                        data: {
                            name: orgName,
                            slug: slug,
                            // @ts-ignore - Fields were commented out but we use them here before final deprecation
                            plan: (user as any).plan || PlanType.FREE,
                            // @ts-ignore
                            monthlyCreditsLimit: (user as any).monthlyCreditsLimit || BigInt(500),
                            // @ts-ignore
                            monthlyCreditsUsed: (user as any).monthlyCreditsUsed || BigInt(0),
                            // @ts-ignore
                            creditsResetDate: (user as any).creditsResetDate,
                            // @ts-ignore
                            packCreditsAvailable: (user as any).packCreditsAvailable || BigInt(0),
                            maxMembers: 1,
                            currentMemberCount: 1,
                        }
                    });

                    // Create Ownership Membership
                    await tx.membership.create({
                        data: {
                            userId: user.id,
                            organizationId: org.id,
                            role: 'OWNER' as Role,
                            status: 'ACTIVE' as MemberStatus,
                            joinedAt: new Date(),
                        }
                    });

                    // Link Projects to this Organization
                    if (user.ownedProjects.length > 0) {
                        await tx.project.updateMany({
                            where: {
                                ownerId: user.id,
                                organizationId: null
                            },
                            data: {
                                organizationId: org.id
                            }
                        });
                        console.log(`🔗 Linked ${user.ownedProjects.length} projects to organization ${org.name}`);
                    }

                    console.log(`✅ Created personal organization for ${user.email}`);
                });
            }
        } catch (error) {
            console.error(`❌ Failed to migrate user ${user.email}:`, error);
        }
    }

    console.log('🏁 Migration completed.');
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
