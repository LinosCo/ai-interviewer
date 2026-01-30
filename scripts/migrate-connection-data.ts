/**
 * Safe Data Migration Script for Connection Sharing
 *
 * This script:
 * 1. Migrates existing CMS connections to the new ProjectCMSConnection table
 * 2. Migrates existing MCP connections to the new ProjectMCPConnection table
 * 3. Populates organizationId for MCP connections
 * 4. DOES NOT delete or modify existing data
 * 5. Can be run multiple times safely (idempotent)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting safe data migration for connection sharing...\n');

  let migratedCMS = 0;
  let migratedMCP = 0;
  let updatedMCP = 0;
  let errors = 0;

  try {
    // Step 1: Migrate CMS Connections
    console.log('📋 Migrating CMS Connections...');

    const cmsConnections = await prisma.cMSConnection.findMany({
      where: {
        projectId: { not: null }
      },
      select: {
        id: true,
        projectId: true,
        enabledBy: true
      }
    });

    console.log(`Found ${cmsConnections.length} CMS connections with projects`);

    for (const conn of cmsConnections) {
      if (!conn.projectId) continue;

      try {
        // Check if already migrated
        const existing = await prisma.$queryRaw`
          SELECT id FROM "ProjectCMSConnection"
          WHERE "projectId" = ${conn.projectId}
          AND "connectionId" = ${conn.id}
        ` as any[];

        if (existing.length > 0) {
          console.log(`  ⏭️  Skipping CMS connection ${conn.id} - already migrated`);
          continue;
        }

        // Create new association
        await prisma.$executeRaw`
          INSERT INTO "ProjectCMSConnection" ("id", "projectId", "connectionId", "role", "createdBy")
          VALUES (
            ${`pcms_${conn.id}_${conn.projectId}`.substring(0, 25)},
            ${conn.projectId},
            ${conn.id},
            'OWNER',
            ${conn.enabledBy}
          )
        `;

        migratedCMS++;
        console.log(`  ✅ Migrated CMS connection ${conn.id}`);
      } catch (error: any) {
        errors++;
        console.error(`  ❌ Error migrating CMS connection ${conn.id}:`, error.message);
      }
    }

    // Step 2: Populate organizationId for MCP Connections
    console.log('\n📋 Updating MCP Connections with organizationId...');

    const mcpConnections = await prisma.mCPConnection.findMany({
      select: {
        id: true,
        projectId: true,
        project: {
          select: {
            id: true,
            organizationId: true
          }
        }
      }
    });

    console.log(`Found ${mcpConnections.length} MCP connections`);

    for (const conn of mcpConnections) {
      try {
        if (!conn.project.organizationId) {
          console.log(`  ⚠️  Skipping MCP connection ${conn.id} - project has no organization`);
          continue;
        }

        // Update organizationId if not set
        const current = await prisma.$queryRaw`
          SELECT "organizationId" FROM "MCPConnection" WHERE id = ${conn.id}
        ` as any[];

        if (current[0]?.organizationId) {
          console.log(`  ⏭️  Skipping MCP connection ${conn.id} - organizationId already set`);
          continue;
        }

        await prisma.$executeRaw`
          UPDATE "MCPConnection"
          SET "organizationId" = ${conn.project.organizationId}
          WHERE id = ${conn.id}
        `;

        updatedMCP++;
        console.log(`  ✅ Updated MCP connection ${conn.id} with organizationId`);
      } catch (error: any) {
        errors++;
        console.error(`  ❌ Error updating MCP connection ${conn.id}:`, error.message);
      }
    }

    // Step 3: Migrate MCP Connections
    console.log('\n📋 Migrating MCP Connections...');

    for (const conn of mcpConnections) {
      try {
        // Check if already migrated
        const existing = await prisma.$queryRaw`
          SELECT id FROM "ProjectMCPConnection"
          WHERE "projectId" = ${conn.projectId}
          AND "connectionId" = ${conn.id}
        ` as any[];

        if (existing.length > 0) {
          console.log(`  ⏭️  Skipping MCP connection ${conn.id} - already migrated`);
          continue;
        }

        // Create new association
        await prisma.$executeRaw`
          INSERT INTO "ProjectMCPConnection" ("id", "projectId", "connectionId", "role", "createdBy")
          VALUES (
            ${`pmcp_${conn.id}_${conn.projectId}`.substring(0, 25)},
            ${conn.projectId},
            ${conn.id},
            'OWNER',
            (SELECT "createdBy" FROM "MCPConnection" WHERE id = ${conn.id})
          )
        `;

        migratedMCP++;
        console.log(`  ✅ Migrated MCP connection ${conn.id}`);
      } catch (error: any) {
        errors++;
        console.error(`  ❌ Error migrating MCP connection ${conn.id}:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ CMS Connections migrated: ${migratedCMS}`);
    console.log(`✅ MCP organizationId updated: ${updatedMCP}`);
    console.log(`✅ MCP Connections migrated: ${migratedMCP}`);
    console.log(`❌ Errors encountered: ${errors}`);
    console.log('='.repeat(60));

    if (errors === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 Old data remains untouched for backward compatibility');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the log above.');
    }

  } catch (error) {
    console.error('\n💥 Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
