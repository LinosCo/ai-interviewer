const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: '.env.local' });
dotenv.config();

function buildOriginFingerprint(projectId, originType, originId, originItemKey) {
  return `${projectId}:${originType}:${originId || 'none'}:${originItemKey || 'base'}`;
}

function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function chunked(items, size) {
  if (size <= 0) return [items];
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizePgConnectionString(rawConnectionString) {
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

function createPrismaClient() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL');
  }

  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');

  const pool = new Pool({
    connectionString: normalizePgConnectionString(connectionString),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function createCounters() {
  return { created: 0, updated: 0, skipped: 0, failed: 0 };
}

function printCounters(name, counters, extra) {
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

function isNonEmptyJson(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

module.exports = {
  buildOriginFingerprint,
  normalizeJsonArray,
  safeString,
  chunked,
  createPrismaClient,
  createCounters,
  printCounters,
  isNonEmptyJson,
};
