import { Prisma, ProjectTipOriginType } from '@prisma/client';

import { createPrismaClient } from './_shared.js';

const prisma = createPrismaClient();

async function run(): Promise<void> {
  const [
    projectCount,
    projectStrategyCount,
    methodologyProfileCount,
    methodologyBindingCount,
    dataSourceCount,
    sourceBindingCount,
    canonicalTipCount,
    crossChannelInsightCount,
    websiteAnalysisWithRecommendationsCount,
    brandReportsWithTipsCount,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.projectStrategy.count(),
    prisma.methodologyProfile.count(),
    prisma.projectMethodologyBinding.count(),
    prisma.dataSource.count(),
    prisma.projectDataSourceBinding.count(),
    prisma.projectTip.count(),
    prisma.crossChannelInsight.count(),
    prisma.websiteAnalysis.count({
      where: { recommendations: { not: Prisma.AnyNull } },
    }),
    prisma.brandReport.count({
      where: { aiTips: { not: Prisma.AnyNull } },
    }),
  ]);

  const byOrigin = await prisma.projectTip.groupBy({
    by: ['originType'],
    _count: { _all: true },
  });

  const duplicateRows = await prisma.$queryRaw<Array<{ originFingerprint: string; count: bigint }>>`
    SELECT "originFingerprint", COUNT(*)::bigint AS "count"
    FROM "ProjectTip"
    WHERE "originFingerprint" IS NOT NULL
    GROUP BY "originFingerprint"
    HAVING COUNT(*) > 1
  `;

  const byOriginMap = new Map<ProjectTipOriginType, number>();
  for (const row of byOrigin) {
    byOriginMap.set(row.originType, row._count._all);
  }

  console.log('\n[verify-project-intelligence-phase1]');
  console.log(`  total projects:               ${projectCount}`);
  console.log(`  total project strategies:     ${projectStrategyCount}`);
  console.log(`  total methodology profiles:   ${methodologyProfileCount}`);
  console.log(`  total methodology bindings:   ${methodologyBindingCount}`);
  console.log(`  total data sources:           ${dataSourceCount}`);
  console.log(`  total source bindings:        ${sourceBindingCount}`);
  console.log(`  total canonical tips:         ${canonicalTipCount}`);
  console.log('  canonical tips by origin type:');
  for (const originType of Object.values(ProjectTipOriginType)) {
    console.log(`    ${originType}: ${byOriginMap.get(originType) ?? 0}`);
  }
  console.log(`  duplicate originFingerprint:  ${duplicateRows.length}`);

  console.log('\n  legacy source presence:');
  console.log(`    CrossChannelInsight rows:     ${crossChannelInsightCount}`);
  console.log(`    WebsiteAnalysis rows (tips):  ${websiteAnalysisWithRecommendationsCount}`);
  console.log(`    BrandReport rows (tips):      ${brandReportsWithTipsCount}`);

  const hasLegacyTips =
    crossChannelInsightCount > 0 ||
    websiteAnalysisWithRecommendationsCount > 0 ||
    brandReportsWithTipsCount > 0;

  const strategyTargetOk = projectStrategyCount >= projectCount;
  const tipsTargetOk = !hasLegacyTips || canonicalTipCount > 0;
  const duplicateTargetOk = duplicateRows.length === 0;

  console.log('\n  verification targets:');
  console.log(`    ProjectStrategy.count >= Project.count: ${strategyTargetOk ? 'PASS' : 'FAIL'}`);
  console.log(`    ProjectTip.count > 0 when legacy tips exist: ${tipsTargetOk ? 'PASS' : 'FAIL'}`);
  console.log(`    no duplicate originFingerprint: ${duplicateTargetOk ? 'PASS' : 'FAIL'}`);

  console.log('\n  skipped legacy rows summary: not persisted by script logs in DB (rerun scripts for live skip counts).');
}

run()
  .catch((error) => {
    console.error('[verify-project-intelligence-phase1] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
