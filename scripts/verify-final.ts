import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- FINAL VERIFICATION ---');

    // Check "Linos's Organization" (the one we moved projects to)
    const orgId = "cmke4axb1000013i8oe4da0g4";
    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
            projects: true,
            subscription: true
        }
    });

    if (org) {
        console.log(`Org: ${org.name}`);
        console.log(`  Plan: ${org.plan}`);
        console.log(`  Monthly Limit: ${org.monthlyCreditsLimit}`);
        console.log(`  Projects Count: ${org.projects.length}`);
        org.projects.forEach(p => console.log(`    - Project: ${p.name}`));
    }

    // Check a client org that was upgraded
    const clientOrgName = "Helca srl";
    const clientOrg = await prisma.organization.findFirst({
        where: { name: clientOrgName },
        include: { subscription: true }
    });

    if (clientOrg) {
        console.log(`\nClient Org: ${clientOrg.name}`);
        console.log(`  Plan: ${clientOrg.plan}`);
        console.log(`  Monthly Limit: ${clientOrg.monthlyCreditsLimit}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
