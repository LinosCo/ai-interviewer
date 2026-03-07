import { createCounters, createPrismaClient, printCounters, safeString } from './_shared.js';

const prisma = createPrismaClient();
const counters = createCounters();

async function run(): Promise<void> {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      strategicVision: true,
      valueProposition: true,
    },
  });

  for (const project of projects) {
    try {
      const incomingPositioning = safeString(project.strategicVision);
      const incomingValueProp = safeString(project.valueProposition);

      const existing = await prisma.projectStrategy.findUnique({
        where: { projectId: project.id },
        select: {
          id: true,
          positioning: true,
          valueProposition: true,
        },
      });

      if (!existing) {
        await prisma.projectStrategy.create({
          data: {
            projectId: project.id,
            positioning: incomingPositioning,
            valueProposition: incomingValueProp,
          },
        });
        counters.created += 1;
        continue;
      }

      const shouldFillPositioning = !safeString(existing.positioning) && Boolean(incomingPositioning);
      const shouldFillValueProp = !safeString(existing.valueProposition) && Boolean(incomingValueProp);

      if (!shouldFillPositioning && !shouldFillValueProp) {
        counters.skipped += 1;
        continue;
      }

      await prisma.projectStrategy.update({
        where: { id: existing.id },
        data: {
          ...(shouldFillPositioning ? { positioning: incomingPositioning } : {}),
          ...(shouldFillValueProp ? { valueProposition: incomingValueProp } : {}),
        },
      });
      counters.updated += 1;
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-project-strategies] failed project=${project.id}`, error);
    }
  }

  printCounters('backfill-project-strategies', counters, { totalProjects: projects.length });
}

run()
  .catch((error) => {
    console.error('[backfill-project-strategies] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
