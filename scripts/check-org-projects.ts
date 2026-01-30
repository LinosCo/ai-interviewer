import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const orgName = "Helca srl";
    const org = await prisma.organization.findFirst({
        where: { name: orgName },
        include: {
            projects: {
                include: {
                    bots: true
                }
            }
        }
    });

    if (!org) {
        console.log(`Org ${orgName} not found`);
        return;
    }

    console.log(`Org: ${org.name} (${org.id})`);
    for (const project of org.projects) {
        console.log(`  Project: ${project.name} (${project.id})`);
        for (const bot of project.bots) {
            console.log(`    Bot: ${bot.name} (${bot.id}), Type: ${bot.botType}`);
        }
    }

    console.log('\nRecent Token Logs for this Org:');
    const logs = await prisma.orgCreditTransaction.findMany({
        where: { organizationId: org.id },
        take: 5,
        orderBy: { createdAt: 'desc' }
    });
    console.log(`Found ${logs.length} logs.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
