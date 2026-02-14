import { Client } from 'pg';

type TableCopySpec = {
  table: string;
  pk: string;
};

const TABLES: TableCopySpec[] = [
  { table: 'CMSConnection', pk: 'id' },
  { table: 'MCPConnection', pk: 'id' },
  { table: 'N8NConnection', pk: 'id' },
  { table: 'ProjectCMSConnection', pk: 'id' },
  { table: 'ProjectMCPConnection', pk: 'id' },
  { table: 'ProjectVisibilityConfig', pk: 'id' }
];

function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

async function getColumns(client: Client, table: string): Promise<string[]> {
  const res = await client.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table]
  );
  return res.rows.map((r) => r.column_name);
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const res = await client.query<{ exists: number }>(
    `
      SELECT 1 as exists
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
    [table]
  );
  return res.rowCount > 0;
}

async function copyTable(params: {
  src: Client;
  dst: Client;
  table: string;
  pk: string;
}): Promise<{ sourceRows: number; insertedRows: number; skippedRows: number; skippedReason?: string }> {
  const { src, dst, table, pk } = params;
  const [srcHasTable, dstHasTable] = await Promise.all([tableExists(src, table), tableExists(dst, table)]);
  if (!srcHasTable || !dstHasTable) {
    return {
      sourceRows: 0,
      insertedRows: 0,
      skippedRows: 0,
      skippedReason: `missing table (src=${srcHasTable} dst=${dstHasTable})`
    };
  }

  const [srcCols, dstCols] = await Promise.all([getColumns(src, table), getColumns(dst, table)]);
  const columns = srcCols.filter((c) => dstCols.includes(c));

  if (!columns.length) {
    return { sourceRows: 0, insertedRows: 0, skippedRows: 0, skippedReason: 'no common columns' };
  }
  if (!columns.includes(pk)) {
    return { sourceRows: 0, insertedRows: 0, skippedRows: 0, skippedReason: `pk ${pk} not in common columns` };
  }

  const colList = columns.map(quoteIdent).join(', ');
  const srcRowsRes = await src.query<Record<string, unknown>>(`SELECT ${colList} FROM ${quoteIdent(table)}`);
  const sourceRows = srcRowsRes.rows.length;

  if (!sourceRows) {
    return { sourceRows: 0, insertedRows: 0, skippedRows: 0 };
  }

  let insertedRows = 0;
  let skippedRows = 0;

  for (const row of srcRowsRes.rows) {
    const values = columns.map((c) => row[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `
      INSERT INTO ${quoteIdent(table)} (${colList})
      VALUES (${placeholders})
      ON CONFLICT (${quoteIdent(pk)}) DO NOTHING
    `;
    const ins = await dst.query(sql, values);
    if (ins.rowCount && ins.rowCount > 0) insertedRows += 1;
    else skippedRows += 1;
  }

  return { sourceRows, insertedRows, skippedRows };
}

async function main() {
  const stageUrl = process.env.STAGING_DATABASE_URL;
  const prodUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

  if (!stageUrl) {
    throw new Error('Missing STAGING_DATABASE_URL');
  }
  if (!prodUrl) {
    throw new Error('Missing PROD_DATABASE_URL (or DATABASE_URL)');
  }

  const src = new Client({ connectionString: stageUrl, ssl: { rejectUnauthorized: false } });
  const dst = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });

  await src.connect();
  await dst.connect();

  try {
    console.log('Starting stage -> prod tool import...');
    for (const spec of TABLES) {
      const stats = await copyTable({ src, dst, table: spec.table, pk: spec.pk });
      const suffix = stats.skippedReason ? ` note=${stats.skippedReason}` : '';
      console.log(
        `${spec.table}: source=${stats.sourceRows} inserted=${stats.insertedRows} skipped=${stats.skippedRows}${suffix}`
      );
    }
    console.log('Import completed.');
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch((err) => {
  console.error('Import failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
