import type { Prisma, Project } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { WorkspaceError } from '@/lib/domain/workspace';

type CreateProjectInput = {
  name: string;
  organizationId: string;
  ownerId: string;
  isPersonal?: boolean;
};

type CreateProjectResult = {
  project: Project;
  created: boolean;
};

export function normalizeProjectName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

async function acquireProjectNameLock(
  tx: Prisma.TransactionClient,
  organizationId: string,
  normalizedName: string
) {
  const lockKey = `${organizationId}:${normalizedName.toLowerCase()}`;

  try {
    // Serialize concurrent creates for the same org/name pair.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;
  } catch (error) {
    // If advisory locks are unavailable, continue with best-effort dedupe check below.
    console.warn('[project-create] Advisory lock unavailable:', error);
  }
}

export async function createProjectWithNameGuard(input: CreateProjectInput): Promise<CreateProjectResult> {
  const normalizedName = normalizeProjectName(input.name);

  if (!normalizedName) {
    throw new WorkspaceError('Nome progetto richiesto', 400, 'PROJECT_NAME_REQUIRED');
  }

  return prisma.$transaction(async (tx) => {
    await acquireProjectNameLock(tx, input.organizationId, normalizedName);

    const existing = await tx.project.findFirst({
      where: {
        organizationId: input.organizationId,
        name: {
          equals: normalizedName,
          mode: 'insensitive'
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (existing) {
      return {
        project: existing,
        created: false
      };
    }

    const project = await tx.project.create({
      data: {
        name: normalizedName,
        organizationId: input.organizationId,
        ownerId: input.ownerId,
        isPersonal: input.isPersonal ?? false
      }
    });

    return {
      project,
      created: true
    };
  });
}
