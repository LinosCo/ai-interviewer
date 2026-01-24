import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Looking for orphan tools to assign...\n');

    // 1. Find user social@linosandco.com
    const user = await prisma.user.findUnique({
        where: { email: 'social@linosandco.com' },
        include: {
            ownedProjects: true,
            memberships: {
                include: { organization: true }
            }
        }
    });

    if (!user) {
        console.error('❌ User social@linosandco.com not found');
        return;
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    console.log(`   Projects owned: ${user.ownedProjects.length}`);
    user.ownedProjects.forEach(p => console.log(`   - ${p.name} (ID: ${p.id})`));

    // 2. Find "internal" project
    let internalProject = user.ownedProjects.find(p => p.name.toLowerCase() === 'internal');

    if (!internalProject) {
        console.log('\n⚠️  No "internal" project found. Creating one...');

        // Get user's organization
        const membership = user.memberships[0];
        if (!membership) {
            console.error('❌ User has no organization membership');
            return;
        }

        internalProject = await prisma.project.create({
            data: {
                name: 'internal',
                ownerId: user.id,
                organizationId: membership.organizationId
            }
        });
        console.log(`✅ Created "internal" project (ID: ${internalProject.id})`);
    } else {
        console.log(`\n✅ Found "internal" project (ID: ${internalProject.id})`);
    }

    // 3. Find orphan VisibilityConfigs (brand monitors without project)
    const orphanBrands = await prisma.visibilityConfig.findMany({
        where: { projectId: null }
    });

    console.log(`\n📊 Orphan Brand Monitors: ${orphanBrands.length}`);
    orphanBrands.forEach(b => console.log(`   - ${b.brandName} (ID: ${b.id})`));

    // 4. Find Bots without proper project (even if schema says required, check anyway)
    const allBots = await prisma.bot.findMany({
        include: { project: true }
    });

    // Check for bots where project might be deleted
    const botsWithIssues = allBots.filter(b => !b.project);
    console.log(`\n🤖 Bots with missing project: ${botsWithIssues.length}`);
    botsWithIssues.forEach(b => console.log(`   - ${b.name} (${b.botType}) ID: ${b.id}`));

    // 5. Update orphan VisibilityConfigs
    if (orphanBrands.length > 0) {
        console.log('\n🔧 Assigning orphan brand monitors to "internal" project...');
        const updateResult = await prisma.visibilityConfig.updateMany({
            where: { projectId: null },
            data: { projectId: internalProject.id }
        });
        console.log(`✅ Updated ${updateResult.count} brand monitors`);
    }

    // 6. Update orphan Bots (if any)
    if (botsWithIssues.length > 0) {
        console.log('\n🔧 Assigning orphan bots to "internal" project...');
        for (const bot of botsWithIssues) {
            await prisma.bot.update({
                where: { id: bot.id },
                data: { projectId: internalProject.id }
            });
            console.log(`   ✅ Updated bot: ${bot.name}`);
        }
    }

    // 7. Summary
    console.log('\n✨ Assignment complete!');

    // Verify
    const finalOrphanBrands = await prisma.visibilityConfig.findMany({
        where: { projectId: null }
    });
    console.log(`\n📋 Final check:`);
    console.log(`   Remaining orphan brand monitors: ${finalOrphanBrands.length}`);
}

main()
    .catch((e) => {
        console.error('❌ Script failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
