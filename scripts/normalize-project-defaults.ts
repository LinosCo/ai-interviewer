import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

function normalizePgConnectionString(rawConnectionString: string): string {
  try {
    const url = new URL(rawConnectionString);
    const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase();
    const hasLibpqCompat = url.searchParams.has('uselibpqcompat');

    if (!hasLibpqCompat && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      url.searchParams.set('uselibpqcompat', 'true');
    }

    return url.toString();
  } catch {
    return rawConnectionString;
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');

  const pool = new Pool({
    connectionString: normalizePgConnectionString(connectionString)
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

type Stats = {
  organizationsScanned: number;
  defaultsRenamed: number;
  personalFlagsCleared: number;
};

const stats: Stats = {
  organizationsScanned: 0,
  defaultsRenamed: 0,
  personalFlagsCleared: 0
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

const orgArgIndex = process.argv.indexOf('--org');
const onlyOrganizationId =
  orgArgIndex >= 0
    ? process.argv[orgArgIndex + 1]
    : undefined;

if (orgArgIndex >= 0 && !onlyOrganizationId) {
  throw new Error('Missing value after --org');
}

function normalizeProjectName(rawName: string | null | undefined): string {
  const normalized = String(rawName || '').trim().replace(/\s+/g, ' ');
  return normalized || 'Workspace';
}

function hasLegacyDefaultNaming(rawName: string | null | undefined): boolean {
  const normalized = normalizeProjectName(rawName).toLowerCase();
  if (normalized === 'default project') return true;
  return /^default project\s*\(.+\)$/.test(normalized);
}

async function mutate<T>(description: string, action: () => Promise<T>, dryValue: T): Promise<T> {
  if (dryRun) {
    console.log(`[dry-run] ${description}`);
    return dryValue;
  }
  return action();
}

async function main() {
  console.log('Project defaults normalization started.');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'APPLY CHANGES'}`);
  if (onlyOrganizationId) {
    console.log(`Scope: organization ${onlyOrganizationId}`);
  } else {
    console.log('Scope: all organizations');
  }

  const isPersonalWhere = onlyOrganizationId
    ? { isPersonal: true, organizationId: onlyOrganizationId }
    : { isPersonal: true };

  const personalCount = await prisma.project.count({ where: isPersonalWhere });
  if (personalCount > 0) {
    await mutate(
      `Set isPersonal=false for ${personalCount} project(s)`,
      () => prisma.project.updateMany({
        where: isPersonalWhere,
        data: { isPersonal: false }
      }),
      { count: personalCount }
    );
    stats.personalFlagsCleared = personalCount;
  }

  const organizations = await prisma.organization.findMany({
    where: onlyOrganizationId ? { id: onlyOrganizationId } : undefined,
    select: {
      id: true,
      name: true,
      projects: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  for (const organization of organizations) {
    stats.organizationsScanned += 1;
    const defaultProject = organization.projects[0];
    if (!defaultProject) continue;

    const desiredName = normalizeProjectName(organization.name);
    const currentName = normalizeProjectName(defaultProject.name);
    if (!hasLegacyDefaultNaming(currentName)) continue;
    if (currentName === desiredName) continue;

    await mutate(
      `Rename default project ${defaultProject.id} to "${desiredName}"`,
      () => prisma.project.update({
        where: { id: defaultProject.id },
        data: { name: desiredName }
      }),
      {
        id: defaultProject.id,
        name: desiredName,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPersonal: false,
        organizationId: organization.id,
        ownerId: null,
        strategicVision: null,
        valueProposition: null,
        originPartnerId: null,
        transferredAt: null,
        transferredToUserId: null,
        transferredFromOrgId: null,
        cmsConnectionId: null
      }
    );
    stats.defaultsRenamed += 1;
  }

  console.log('\nNormalization summary:');
  for (const [key, value] of Object.entries(stats)) {
    console.log(`- ${key}: ${value}`);
  }
}

main()
  .catch((error) => {
    console.error('Normalization failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
