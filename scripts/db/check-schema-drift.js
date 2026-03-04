#!/usr/bin/env node
/*
 * Compares Prisma models in prisma/schema.prisma with the live Postgres schema.
 * Usage: DATABASE_URL=... node scripts/db/check-schema-drift.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

const SCALAR_TYPES = new Set([
  'String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean',
  'DateTime', 'Json', 'Bytes'
]);

function parsePrismaSchema(content) {
  const modelRegex = /^model\s+(\w+)\s+\{([\s\S]*?)^\}/gm;
  const models = [];
  let m;

  while ((m = modelRegex.exec(content)) !== null) {
    const modelName = m[1];
    const body = m[2];
    const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let tableName = modelName;
    const columns = [];

    for (const line of lines) {
      if (line.startsWith('//')) continue;
      if (line.startsWith('@@map(')) {
        const mm = line.match(/@@map\("([^"]+)"\)/);
        if (mm) tableName = mm[1];
        continue;
      }
      if (line.startsWith('@@') || line.startsWith('@@')) continue;
      if (line.startsWith('@')) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const fieldName = parts[0];
      const rawType = parts[1].replace(/[?\[\]]/g, '');

      // Skip relation fields and unsupported pseudo fields.
      if (!SCALAR_TYPES.has(rawType)) continue;

      // Respect @map on field.
      let columnName = fieldName;
      const mapMatch = line.match(/@map\("([^"]+)"\)/);
      if (mapMatch) columnName = mapMatch[1];

      columns.push(columnName);
    }

    models.push({ modelName, tableName, columns });
  }

  return models;
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL or POSTGRES_URL');
    process.exit(1);
  }

  const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
  const models = parsePrismaSchema(schemaRaw);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const tableRows = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `);
  const existingTables = new Set(tableRows.rows.map((r) => r.tablename));

  const columnRows = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);

  const columnsByTable = new Map();
  for (const row of columnRows.rows) {
    if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
    columnsByTable.get(row.table_name).add(row.column_name);
  }

  const missingTables = [];
  const missingColumns = [];

  for (const model of models) {
    if (!existingTables.has(model.tableName)) {
      missingTables.push(model.tableName);
      continue;
    }

    const existingCols = columnsByTable.get(model.tableName) || new Set();
    for (const col of model.columns) {
      if (!existingCols.has(col)) {
        missingColumns.push(`${model.tableName}.${col}`);
      }
    }
  }

  if (missingTables.length === 0 && missingColumns.length === 0) {
    console.log('Schema aligned: no missing tables/columns detected.');
    await client.end();
    process.exit(0);
  }

  console.log('Schema drift detected.');
  if (missingTables.length > 0) {
    console.log('\nMissing tables:');
    for (const t of missingTables) console.log(`- ${t}`);
  }
  if (missingColumns.length > 0) {
    console.log('\nMissing columns:');
    for (const c of missingColumns) console.log(`- ${c}`);
  }

  await client.end();
  process.exit(2);
})().catch(async (err) => {
  console.error('check-schema-drift failed:', err.message || err);
  process.exit(1);
});
