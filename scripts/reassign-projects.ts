import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- REASSIGNMENT PLAN ---');

    // Find projects owned by social@linosandco.com that are in Linos's Org
    // but might belong elsewhere (e.g. they have the client's name)
    const adminOrgId = "cmk5d7ieh0000v9awlt9v6usx";

    const projects = await prisma.project.findMany({
        where: { organizationId: adminOrgId },
        select: { id: true, name: true, ownerId: true }
    });

    for (const project of projects) {
        // Find if the owner has another organization
        const ownerMemberships = await prisma.membership.findMany({
            where: { userId: project.ownerId || '' },
            include: { organization: true }
        });

        const targetOrg = ownerMemberships.find(m => m.organizationId !== adminOrgId);

        if (targetOrg) {
            console.log(`Plan: Move Project "${project.name}" (${project.id}) to Org "${targetOrg.organization.name}" (${targetOrg.organizationId})`);

            await prisma.project.update({
                where: { id: project.id },
                data: { organizationId: targetOrg.organizationId }
            });
            console.log(`  ✓ Moved.`);
        } else {
            console.log(`Project "${project.name}" (${project.id}): No alternative organization found for owner.`);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
