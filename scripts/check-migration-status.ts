/**
 * Check Migration Status
 * Verifica lo stato attuale del database e se le migrazioni sono necessarie
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStatus() {
  console.log('🔍 Verifico stato database...\n');

  try {
    // Check if new tables exist
    console.log('📋 Verifico tabelle...');

    let hasProjectCMSConnection = false;
    let hasProjectMCPConnection = false;
    let mcpHasOrganizationId = false;

    try {
      // Try to query new tables
      await prisma.$queryRaw`SELECT 1 FROM "ProjectCMSConnection" LIMIT 1`;
      hasProjectCMSConnection = true;
      console.log('  ✅ ProjectCMSConnection esiste');
    } catch (e) {
      console.log('  ❌ ProjectCMSConnection NON esiste - migrazione necessaria');
    }

    try {
      await prisma.$queryRaw`SELECT 1 FROM "ProjectMCPConnection" LIMIT 1`;
      hasProjectMCPConnection = true;
      console.log('  ✅ ProjectMCPConnection esiste');
    } catch (e) {
      console.log('  ❌ ProjectMCPConnection NON esiste - migrazione necessaria');
    }

    // Check if MCPConnection has organizationId
    try {
      await prisma.$queryRaw`SELECT "organizationId" FROM "MCPConnection" LIMIT 1`;
      mcpHasOrganizationId = true;
      console.log('  ✅ MCPConnection.organizationId esiste');
    } catch (e) {
      console.log('  ❌ MCPConnection.organizationId NON esiste - migrazione necessaria');
    }

    console.log('\n📊 Conto connessioni esistenti...');

    // Count existing connections
    const cmsCount = await prisma.cMSConnection.count();
    const mcpCount = await prisma.mCPConnection.count();

    console.log(`  • Connessioni CMS: ${cmsCount}`);
    console.log(`  • Connessioni MCP: ${mcpCount}`);

    // Count connections with projects using raw query
    const cmsWithProjectsResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "CMSConnection" WHERE "projectId" IS NOT NULL
    ` as any[];
    const cmsWithProjects = parseInt(cmsWithProjectsResult[0]?.count || '0');

    const mcpWithProjectsResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "MCPConnection" WHERE "projectId" IS NOT NULL
    ` as any[];
    const mcpWithProjects = parseInt(mcpWithProjectsResult[0]?.count || '0');

    console.log(`  • CMS con progetti: ${cmsWithProjects}`);
    console.log(`  • MCP con progetti: ${mcpWithProjects}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO STATO');
    console.log('='.repeat(60));

    if (hasProjectCMSConnection && hasProjectMCPConnection && mcpHasOrganizationId) {
      console.log('✅ Le migrazioni sono già state eseguite!');

      // Check if data has been migrated
      const cmsAssociations = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "ProjectCMSConnection"` as any[];
      const mcpAssociations = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "ProjectMCPConnection"` as any[];

      const cmsAssocCount = parseInt(cmsAssociations[0]?.count || '0');
      const mcpAssocCount = parseInt(mcpAssociations[0]?.count || '0');

      console.log(`\n📈 Dati migrati:`);
      console.log(`  • Associazioni CMS-Project: ${cmsAssocCount}`);
      console.log(`  • Associazioni MCP-Project: ${mcpAssocCount}`);

      if (cmsAssocCount === 0 && cmsWithProjects > 0) {
        console.log('\n⚠️  ATTENZIONE: Le tabelle esistono ma i dati non sono stati migrati!');
        console.log('   Esegui: npx ts-node scripts/migrate-connection-data.ts');
      } else if (mcpAssocCount === 0 && mcpWithProjects > 0) {
        console.log('\n⚠️  ATTENZIONE: Le tabelle MCP esistono ma i dati non sono stati migrati!');
        console.log('   Esegui: npx ts-node scripts/migrate-connection-data.ts');
      } else {
        console.log('\n🎉 Tutto è aggiornato e funzionante!');
      }
    } else {
      console.log('❌ Le migrazioni NON sono state eseguite');
      console.log('\n📋 Cosa manca:');
      if (!hasProjectCMSConnection) console.log('  ❌ Tabella ProjectCMSConnection');
      if (!hasProjectMCPConnection) console.log('  ❌ Tabella ProjectMCPConnection');
      if (!mcpHasOrganizationId) console.log('  ❌ Campo MCPConnection.organizationId');

      console.log('\n🚀 Per eseguire le migrazioni:');
      console.log('   ./scripts/run-migration-safely.sh');
      console.log('   oppure');
      console.log('   bash scripts/run-migration-safely.sh');
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n💥 Errore durante la verifica:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
