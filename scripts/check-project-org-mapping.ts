import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.project.findMany({
        include: {
            organization: {
                select: { name: true }
            },
            owner: {
                select: { email: true }
            }
        }
    });

    console.log('--- Project to Organization Mapping ---');
    for (const project of projects) {
        console.log(`Project: ${project.name}`);
        console.log(`  Org: ${project.organization?.name || 'NONE'} (${project.organizationId})`);
        console.log(`  Owner: ${project.owner?.email || 'NONE'}`);
        console.log('---');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
