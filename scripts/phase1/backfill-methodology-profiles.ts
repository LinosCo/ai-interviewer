import { MethodologyProfileStatus, ProjectMethodologyRole } from '@prisma/client';

import { createCounters, createPrismaClient, printCounters, safeString } from './_shared.js';

const prisma = createPrismaClient();
const counters = createCounters();
let bindingCreated = 0;
let bindingUpdated = 0;
let bindingSkipped = 0;
let bindingFailed = 0;

const INTERVIEW_PROFILE = {
  slug: 'default-interview-methodology',
  name: 'Default Interview Methodology',
  category: 'stakeholder_research',
  role: ProjectMethodologyRole.SECONDARY,
} as const;

const STRATEGIC_PROFILE = {
  slug: 'default-strategic-marketing',
  name: 'Default Strategic Marketing',
  category: 'strategic_marketing',
  role: ProjectMethodologyRole.PRIMARY,
} as const;

async function upsertProfile(params: {
  organizationId: string;
  slug: string;
  name: string;
  category: string;
  knowledge: string;
}) {
  const existing = await prisma.methodologyProfile.findUnique({
    where: {
      organizationId_slug: {
        organizationId: params.organizationId,
        slug: params.slug,
      },
    },
    select: {
      id: true,
      knowledge: true,
      name: true,
      category: true,
      isDefault: true,
      status: true,
    },
  });

  if (!existing) {
    const created = await prisma.methodologyProfile.create({
      data: {
        organizationId: params.organizationId,
        slug: params.slug,
        name: params.name,
        category: params.category,
        knowledge: params.knowledge,
        isDefault: true,
        status: MethodologyProfileStatus.ACTIVE,
      },
      select: { id: true },
    });
    counters.created += 1;
    return created.id;
  }

  const changed =
    existing.knowledge !== params.knowledge ||
    existing.name !== params.name ||
    existing.category !== params.category ||
    existing.isDefault !== true ||
    existing.status !== MethodologyProfileStatus.ACTIVE;

  if (!changed) {
    counters.skipped += 1;
    return existing.id;
  }

  const updated = await prisma.methodologyProfile.update({
    where: { id: existing.id },
    data: {
      name: params.name,
      category: params.category,
      knowledge: params.knowledge,
      isDefault: true,
      status: MethodologyProfileStatus.ACTIVE,
    },
    select: { id: true },
  });
  counters.updated += 1;
  return updated.id;
}

async function upsertBinding(projectId: string, profileId: string, role: ProjectMethodologyRole): Promise<void> {
  const existing = await prisma.projectMethodologyBinding.findUnique({
    where: {
      projectId_methodologyProfileId: {
        projectId,
        methodologyProfileId: profileId,
      },
    },
    select: { id: true, role: true },
  });

  if (!existing) {
    await prisma.projectMethodologyBinding.create({
      data: {
        projectId,
        methodologyProfileId: profileId,
        role,
      },
    });
    bindingCreated += 1;
    return;
  }

  if (existing.role === role) {
    bindingSkipped += 1;
    return;
  }

  await prisma.projectMethodologyBinding.update({
    where: { id: existing.id },
    data: { role },
  });
  bindingUpdated += 1;
}

async function run(): Promise<void> {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      platformSettings: {
        select: {
          methodologyKnowledge: true,
          strategicMarketingKnowledge: true,
        },
      },
      projects: {
        select: { id: true },
      },
    },
  });

  for (const organization of organizations) {
    try {
      const methodologyKnowledge = safeString(organization.platformSettings?.methodologyKnowledge);
      const strategicKnowledge = safeString(organization.platformSettings?.strategicMarketingKnowledge);

      let strategicProfileId: string | null = null;
      let interviewProfileId: string | null = null;

      if (strategicKnowledge) {
        strategicProfileId = await upsertProfile({
          organizationId: organization.id,
          slug: STRATEGIC_PROFILE.slug,
          name: STRATEGIC_PROFILE.name,
          category: STRATEGIC_PROFILE.category,
          knowledge: strategicKnowledge,
        });
      }

      if (methodologyKnowledge) {
        interviewProfileId = await upsertProfile({
          organizationId: organization.id,
          slug: INTERVIEW_PROFILE.slug,
          name: INTERVIEW_PROFILE.name,
          category: INTERVIEW_PROFILE.category,
          knowledge: methodologyKnowledge,
        });
      }

      for (const project of organization.projects) {
        try {
          if (strategicProfileId) {
            await upsertBinding(project.id, strategicProfileId, STRATEGIC_PROFILE.role);
          }
          if (interviewProfileId) {
            await upsertBinding(project.id, interviewProfileId, INTERVIEW_PROFILE.role);
          }
        } catch (error) {
          bindingFailed += 1;
          console.error(
            `[backfill-methodology-profiles] binding failed org=${organization.id} project=${project.id}`,
            error
          );
        }
      }
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill-methodology-profiles] failed org=${organization.id}`, error);
    }
  }

  printCounters('backfill-methodology-profiles', counters, {
    totalOrganizations: organizations.length,
    bindingCreated,
    bindingUpdated,
    bindingSkipped,
    bindingFailed,
  });
}

run()
  .catch((error) => {
    console.error('[backfill-methodology-profiles] fatal', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
