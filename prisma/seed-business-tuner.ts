import { PrismaClient, PlanType, BillingCycle } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database with Business Tuner defaults...');

    // Update existing organizations with default plan values
    const orgs = await prisma.organization.findMany();

    for (const org of orgs) {
        await prisma.organization.update({
            where: { id: org.id },
            data: {
                plan: PlanType.TRIAL,
                billingCycle: BillingCycle.MONTHLY,
                responsesUsedThisMonth: 0,
                monthlyResetDate: new Date()
            }
        });
        console.log(`✅ Updated organization: ${org.name} → TRIAL plan`);
    }

    // Update existing users
    // - social@linosandco.com → ADMIN
    // - All others → USER (free plan)
    const users = await prisma.user.findMany({
        include: {
            memberships: {
                include: {
                    organization: true
                }
            }
        }
    });

    for (const user of users) {
        const newRole: 'ADMIN' | 'MEMBER' | 'VIEWER' | 'USER' =
            user.email === 'social@linosandco.com' ? 'ADMIN' : 'USER';

        await prisma.user.update({
            where: { id: user.id },
            data: { role: newRole }
        });

        console.log(`✅ Updated user: ${user.email} → ${newRole}`);
    }

    // Update existing conversations with default tracking values
    await prisma.conversation.updateMany({
        data: {
            exchangeCount: 0,
            totalTokens: 0
        }
    });
    console.log('✅ Updated conversations with tracking fields');

    console.log('✨ Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
