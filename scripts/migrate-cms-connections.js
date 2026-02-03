/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting CMS Connection migration...');

    // Find all projects that have an old CMS connection link
    const projects = await prisma.project.findMany({
        where: {
            cmsConnectionId: { not: null }
        },
        select: {
            id: true,
            cmsConnectionId: true
        }
    });

    console.log(`Found ${projects.length} associations to migrate.`);

    let migratedCount = 0;
    for (const project of projects) {
        try {
            // Update the CMSConnection to point to this project via the new field
            await prisma.cMSConnection.update({
                where: { id: project.cmsConnectionId },
                data: { projectId: project.id }
            });
            migratedCount++;
        } catch (error) {
            console.error(`Failed to migrate connection ${project.cmsConnectionId} for project ${project.id}:`, error.message);
        }
    }

    console.log(`Successfully migrated ${migratedCount} associations.`);
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
