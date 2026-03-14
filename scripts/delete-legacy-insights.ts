/**
 * Delete CrossChannelInsight records with no projectId (legacy data).
 * Run via: railway run npx ts-node --skip-project scripts/delete-legacy-insights.ts
 */
import { prisma } from '../src/lib/prisma';

async function main() {
  const count = await prisma.crossChannelInsight.count({ where: { projectId: null } });
  console.log(`Found ${count} legacy CrossChannelInsight records with no projectId`);

  if (count === 0) {
    console.log('Nothing to delete.');
    return;
  }

  const deleted = await prisma.crossChannelInsight.deleteMany({ where: { projectId: null } });
  console.log(`Deleted ${deleted.count} records.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
