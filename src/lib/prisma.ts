import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let visibilitySchemaCompatibilityPromise: Promise<void> | null = null;

async function ensureVisibilityConfigSchemaCompatibility(client: PrismaClient): Promise<void> {
  if (!visibilitySchemaCompatibilityPromise) {
    visibilitySchemaCompatibilityPromise = (async () => {
      try {
        await client.$executeRawUnsafe(
          'ALTER TABLE "VisibilityConfig" ADD COLUMN IF NOT EXISTS "websiteUrl" TEXT',
        );
        await client.$executeRawUnsafe(
          'ALTER TABLE "VisibilityConfig" ADD COLUMN IF NOT EXISTS "sitemapUrl" TEXT',
        );
        await client.$executeRawUnsafe(
          'ALTER TABLE "VisibilityConfig" ADD COLUMN IF NOT EXISTS "additionalUrls" JSONB',
        );
      } catch (error) {
        console.warn('[prisma] VisibilityConfig compatibility patch skipped:', error);
      }
    })();
  }

  await visibilitySchemaCompatibilityPromise;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL for Prisma client.');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');

  // Strip pg-incompatible URL params before passing to Pool.
  // uselibpqcompat is a Prisma CLI hint only, not valid at runtime.
  // sslmode is stripped too — SSL is controlled via Pool options below, not URL params.
  let cleanUrl = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');
    cleanUrl = url.toString();
  } catch {
    // keep original if URL is not parseable
  }

  // No explicit SSL config: Railway's internal hostname (postgres.railway.internal)
  // is on a private network — no SSL or proxy needed.
  // For external connections (local dev / psql tools), SSL is negotiated by the
  // client tool directly and does not go through this Pool.
  const pool = new Pool({
    connectionString: cleanUrl,
    // Explicit pool sizing prevents connection surge on serverless (many parallel instances).
    // Railway PostgreSQL has a finite max_connections — cap the pool to avoid exhausting it.
    max: parseInt(process.env.DB_POOL_MAX ?? '20'),
    min: parseInt(process.env.DB_POOL_MIN ?? '2'),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? '5000'),
  });
  const adapter = new PrismaPg(pool);

  const baseClient = new PrismaClient({ adapter });
  // Prisma Client created with adapter-pg can miss middleware APIs like $use.
  // Use query extension instead to keep the compatibility patch.
  const client = baseClient.$extends({
    query: {
      visibilityConfig: {
        async $allOperations({ args, query }) {
          await ensureVisibilityConfigSchemaCompatibility(baseClient);
          return query(args);
        },
      },
    },
  });

  return client as PrismaClient;
}

// Returns the singleton PrismaClient, creating it on first call.
// Using globalForPrisma ensures a single instance across hot-reloads in dev.
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Proxy for lazy initialization: the PrismaClient is NOT created at import time.
// This prevents Next.js build failures when DATABASE_URL is not available
// during static analysis / page data collection.
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    return (getPrismaClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
