import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

export function buildOriginFingerprint(
  projectId: string,
  originType: string,
  originId: string | null | undefined,
  originItemKey: string | null | undefined
): string {
  return `${projectId}:${originType}:${originId || 'none'}:${originItemKey || 'base'}`;
}

export function normalizeJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function safeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function chunked<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

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

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require('@prisma/adapter-pg');

  const pool = new Pool({
    connectionString: normalizePgConnectionString(connectionString),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export type ScriptCounters = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

export function createCounters(): ScriptCounters {
  return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

export function printCounters(name: string, counters: ScriptCounters, extra?: Record<string, number>): void {
  console.log(`\n[${name}] summary`);
  console.log(`  created: ${counters.created}`);
  console.log(`  updated: ${counters.updated}`);
  console.log(`  skipped: ${counters.skipped}`);
  console.log(`  failed:  ${counters.failed}`);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      console.log(`  ${key}: ${value}`);
    }
  }
}

export function isNonEmptyJson(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

