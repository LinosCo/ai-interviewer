import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function normalizePgConnectionString(rawConnectionString: string): string {
  try {
    const url = new URL(rawConnectionString);
    const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase();
    const hasLibpqCompat = url.searchParams.has('uselibpqcompat');

    // Avoid pg warning and keep current secure behavior with upcoming pg v9 changes.
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
    throw new Error('Missing DIRECT_URL or DATABASE_URL for Prisma client.');
  }

  // Prisma 7 requires either adapter or accelerateUrl.
  // We use PostgreSQL driver adapter for Neon/direct DB connections.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');

  const normalizedConnectionString = normalizePgConnectionString(connectionString);
  const pool = new Pool({ connectionString: normalizedConnectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
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
