const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

function id() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

async function getDefaultContext(client, email) {
  const userRes = await client.query(
    `SELECT id, email FROM "User" WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (!userRes.rowCount) throw new Error(`User not found: ${email}`);
  const userId = userRes.rows[0].id;

  const orgRes = await client.query(
    `
      SELECT m."organizationId" as id
      FROM "Membership" m
      WHERE m."userId" = $1
      ORDER BY m."createdAt" ASC
      LIMIT 1
    `,
    [userId]
  );
  if (!orgRes.rowCount) throw new Error(`No organization membership for user ${email}`);
  const organizationId = orgRes.rows[0].id;

  let projectRes = await client.query(
    `
      SELECT p.id, p.name
      FROM "Project" p
      WHERE p."ownerId" = $1 AND p."organizationId" = $2
      ORDER BY p."createdAt" ASC
      LIMIT 1
    `,
    [userId, organizationId]
  );

  if (!projectRes.rowCount) {
    const newProjectId = id();
    await client.query(
      `
        INSERT INTO "Project" (id, name, "ownerId", "organizationId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
      `,
      [newProjectId, 'internal', userId, organizationId]
    );
    projectRes = await client.query(`SELECT id, name FROM "Project" WHERE id = $1`, [newProjectId]);
  }

  return {
    userId,
    organizationId,
    projectId: projectRes.rows[0].id,
    projectName: projectRes.rows[0].name
  };
}

async function countOrphans(client) {
  const q = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM "CMSConnection" WHERE "organizationId" IS NULL OR "projectId" IS NULL) AS cms_orphan,
      (SELECT COUNT(*)::int FROM "MCPConnection" WHERE "organizationId" IS NULL) AS mcp_orphan_org,
      (SELECT COUNT(*)::int FROM "VisibilityConfig" WHERE "projectId" IS NULL) AS visibility_orphan_project,
      (
        SELECT COUNT(*)::int
        FROM "CMSConnection" c
        LEFT JOIN "ProjectCMSConnection" pc ON pc."connectionId" = c.id
        WHERE pc.id IS NULL
      ) AS cms_without_share,
      (
        SELECT COUNT(*)::int
        FROM "MCPConnection" m
        LEFT JOIN "ProjectMCPConnection" pm ON pm."connectionId" = m.id
        WHERE pm.id IS NULL
      ) AS mcp_without_share
  `);
  return q.rows[0];
}

async function disableOlderDuplicates(client, userId) {
  let cmsDisabled = 0;
  let mcpDisabled = 0;

  const cmsGroups = await client.query(`
    SELECT lower(trim("cmsApiUrl")) AS key
    FROM "CMSConnection"
    WHERE "cmsApiUrl" IS NOT NULL AND trim("cmsApiUrl") <> ''
    GROUP BY lower(trim("cmsApiUrl"))
    HAVING COUNT(*) > 1
  `);

  for (const g of cmsGroups.rows) {
    const rows = await client.query(
      `
        SELECT id, "updatedAt"
        FROM "CMSConnection"
        WHERE lower(trim("cmsApiUrl")) = $1
        ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC
      `,
      [g.key]
    );
    const keep = rows.rows[0]?.id;
    for (const r of rows.rows.slice(1)) {
      const upd = await client.query(
        `
          UPDATE "CMSConnection"
          SET status = 'DISABLED',
              notes = COALESCE(notes, '') || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\\n' END || $1,
              "enabledBy" = COALESCE("enabledBy", $2),
              "updatedAt" = NOW()
          WHERE id = $3 AND status <> 'DISABLED'
        `,
        [`Duplicate disabled in favor of ${keep}`, userId, r.id]
      );
      cmsDisabled += upd.rowCount || 0;
    }
  }

  const mcpGroups = await client.query(`
    SELECT type, lower(trim(endpoint)) AS key
    FROM "MCPConnection"
    WHERE endpoint IS NOT NULL AND trim(endpoint) <> ''
    GROUP BY type, lower(trim(endpoint))
    HAVING COUNT(*) > 1
  `);

  for (const g of mcpGroups.rows) {
    const rows = await client.query(
      `
        SELECT id
        FROM "MCPConnection"
        WHERE type = $1 AND lower(trim(endpoint)) = $2
        ORDER BY "updatedAt" DESC NULLS LAST, "createdAt" DESC
      `,
      [g.type, g.key]
    );
    for (const r of rows.rows.slice(1)) {
      const upd = await client.query(
        `
          UPDATE "MCPConnection"
          SET status = 'DISABLED',
              "updatedAt" = NOW()
          WHERE id = $1 AND status <> 'DISABLED'
        `,
        [r.id]
      );
      mcpDisabled += upd.rowCount || 0;
    }
  }

  return { cmsDisabled, mcpDisabled };
}

async function main() {
  const conn = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  if (!conn) throw new Error('Missing PROD_DATABASE_URL or DATABASE_URL');

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const ctx = await getDefaultContext(client, 'social@linosandco.com');
    console.log('Default context:', ctx);

    const before = await countOrphans(client);
    console.log('Before:', before);

    await client.query('BEGIN');

    const dedup = await disableOlderDuplicates(client, ctx.userId);

    const cmsOrgUpd = await client.query(
      `UPDATE "CMSConnection" SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
      [ctx.organizationId]
    );

    const mcpOrgUpd = await client.query(
      `UPDATE "MCPConnection" SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
      [ctx.organizationId]
    );

    const visProjUpd = await client.query(
      `UPDATE "VisibilityConfig" SET "projectId" = $1 WHERE "projectId" IS NULL`,
      [ctx.projectId]
    );

    const cmsNoShare = await client.query(
      `
        SELECT c.id
        FROM "CMSConnection" c
        LEFT JOIN "ProjectCMSConnection" pc ON pc."connectionId" = c.id
        WHERE pc.id IS NULL
      `
    );
    let cmsShareInserted = 0;
    for (const r of cmsNoShare.rows) {
      const ins = await client.query(
        `
          INSERT INTO "ProjectCMSConnection" (id, "projectId", "connectionId", role, "createdAt", "createdBy")
          VALUES ($1, $2, $3, 'OWNER', NOW(), $4)
          ON CONFLICT ("projectId", "connectionId") DO NOTHING
        `,
        [id(), ctx.projectId, r.id, ctx.userId]
      );
      cmsShareInserted += ins.rowCount || 0;
    }

    const mcpNoShare = await client.query(
      `
        SELECT m.id
        FROM "MCPConnection" m
        LEFT JOIN "ProjectMCPConnection" pm ON pm."connectionId" = m.id
        WHERE pm.id IS NULL
      `
    );
    let mcpShareInserted = 0;
    for (const r of mcpNoShare.rows) {
      const ins = await client.query(
        `
          INSERT INTO "ProjectMCPConnection" (id, "projectId", "connectionId", role, "createdAt", "createdBy")
          VALUES ($1, $2, $3, 'OWNER', NOW(), $4)
          ON CONFLICT ("projectId", "connectionId") DO NOTHING
        `,
        [id(), ctx.projectId, r.id, ctx.userId]
      );
      mcpShareInserted += ins.rowCount || 0;
    }

    await client.query('COMMIT');

    const after = await countOrphans(client);
    console.log('Applied:', {
      cmsDuplicateDisabled: dedup.cmsDisabled,
      mcpDuplicateDisabled: dedup.mcpDisabled,
      cmsOrgUpdated: cmsOrgUpd.rowCount || 0,
      mcpOrgUpdated: mcpOrgUpd.rowCount || 0,
      visibilityProjectUpdated: visProjUpd.rowCount || 0,
      cmsShareInserted,
      mcpShareInserted
    });
    console.log('After:', after);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
