import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Organizations ---');
    const orgs = await prisma.organization.findMany({
        select: {
            id: true,
            name: true,
            plan: true,
            monthlyCreditsLimit: true,
            monthlyCreditsUsed: true,
            _count: {
                select: { projects: true }
            }
        }
    });

    for (const org of orgs) {
        console.log(`Org: ${org.name} (${org.id})`);
        console.log(`Plan: ${org.plan}, Limit: ${org.monthlyCreditsLimit}, Used: ${org.monthlyCreditsUsed}`);
        console.log(`Projects: ${org._count.projects}`);
        console.log('---');
    }

    console.log('\n--- Projects without Organization ---');
    const projectsWithoutOrg = await prisma.project.findMany({
        where: { organizationId: null },
        select: { id: true, name: true, ownerId: true }
    });
    console.log(`Found ${projectsWithoutOrg.length} projects without org.`);

    console.log('\n--- Token Logs Sample ---');
    const recentLogs = await prisma.orgCreditTransaction.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            organization: { select: { name: true } }
        }
    });

    for (const log of recentLogs) {
        console.log(`Date: ${log.createdAt}, Org: ${log.organization.name}, Tool: ${log.tool}, Amount: ${log.amount}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
