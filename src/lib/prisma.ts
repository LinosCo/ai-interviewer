import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL for Prisma client.');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');

  // Strip URL-based SSL params (sslmode, uselibpqcompat) before passing to pg.
  // pg-connection-string behaviour for these params varies across pg versions;
  // we configure SSL explicitly in the Pool options below instead.
  let cleanUrl = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');
    cleanUrl = url.toString();
  } catch {
    // keep original if URL is not parseable
  }

  // In production (Railway) we always use SSL with self-signed cert tolerance.
  // Railway's external proxy requires TLS; rejectUnauthorized:false handles
  // the self-signed certificate without a full CA chain.
  // In development we skip SSL to support plain local PostgreSQL instances.
  const sslConfig =
    process.env.NODE_ENV === 'production'
      ? ({ rejectUnauthorized: false } as const)
      : undefined;

  const pool = new Pool({ connectionString: cleanUrl, ssl: sslConfig });
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
