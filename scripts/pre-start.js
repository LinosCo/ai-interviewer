#!/usr/bin/env node
/**
 * pre-start.js — Run before `npm start` in production.
 *
 * Problem this solves:
 *   `prisma migrate deploy` is idempotent — it skips migrations already
 *   recorded in `_prisma_migrations` as "applied". If the DB was restored
 *   from a backup, or a migration failed mid-run and was partially recorded,
 *   the tracker can show a migration as "applied" even though the actual
 *   table/column doesn't exist (migration drift).
 *
 * Strategy:
 *   1. Connect to the DB and check whether each critical table actually exists.
 *   2. Also check whether critical COLUMNS exist on existing tables
 *      (catches ALTER TABLE migrations that added columns to existing tables).
 *   3. For any missing table or column, find the responsible migration and
 *      mark it as "rolled-back" via `prisma migrate resolve --rolled-back`.
 *      This removes the "applied" record so `migrate deploy` will re-run it.
 *   4. Run `prisma migrate deploy` to apply all pending/rolled-back migrations.
 */

const { execSync } = require('child_process');
const { Client } = require('pg');

// Map: table name -> migration folder name that creates it.
// Add new entries whenever a migration creates a new table.
const TABLE_MIGRATION_MAP = {
    TipRoutingRule:       '20260227210028_add_tip_routing_rule',
    BrandReport:          '20260228_add_brand_report',
    TrainingBot:          '20260228_add_training_tool',
    TrainingTopicBlock:   '20260228_add_training_tool',
    TrainingSession:      '20260228_add_training_tool',
    TrainingMessage:      '20260228_add_training_tool',
    N8NConnection:        '20260211_add_n8n_connection_table',
    SiteStructureCache:   '20260224_add_site_structure_cache',
    ProjectVisibilityConfig: '20260207_add_project_visibility_config',
    InterviewPlan:        '20260204_add_interview_plan',
    StripeWebhookEvent:   '20260206_add_stripe_webhook_event',
};

// Map: "TableName.columnName" -> migration that adds that column to an existing table.
// Add new entries whenever a migration ALTER TABLE adds columns (not creates a new table).
const COLUMN_MIGRATION_MAP = {
    'TrainingTopicBlock.minCheckingTurns': '20260301_training_dialogue_kb',
    'TrainingTopicBlock.maxCheckingTurns': '20260301_training_dialogue_kb',
    'KnowledgeSource.trainingBotId':       '20260301_training_dialogue_kb',
};

async function tableExists(client, tableName) {
    const res = await client.query(
        `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = $1
        ) AS exists`,
        [tableName]
    );
    return res.rows[0].exists === true;
}

async function columnExists(client, tableName, columnName) {
    const res = await client.query(
        `SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name   = $1
            AND column_name  = $2
        ) AS exists`,
        [tableName, columnName]
    );
    return res.rows[0].exists === true;
}

async function migrationIsApplied(client, migrationName) {
    try {
        const res = await client.query(
            `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1`,
            [migrationName]
        );
        return res.rowCount > 0;
    } catch {
        // _prisma_migrations table doesn't exist yet — that's fine
        return false;
    }
}

function resolveRolledBack(migrationName) {
    try {
        console.log(`[pre-start] Marking "${migrationName}" as rolled-back...`);
        execSync(`npx prisma migrate resolve --rolled-back "${migrationName}"`, {
            stdio: 'inherit',
            env: process.env,
        });
    } catch (err) {
        console.warn(`[pre-start] resolve --rolled-back failed for "${migrationName}" (may not be in tracker). Continuing.`);
    }
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('[pre-start] DATABASE_URL not set — skipping drift check.');
        runMigrations();
        return;
    }

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    try {
        // Track which migrations need to be rolled back (de-dup by migration name)
        const migrationsToRollback = new Set();

        // --- 1. Table-level drift check ---
        for (const [table, migration] of Object.entries(TABLE_MIGRATION_MAP)) {
            const exists = await tableExists(client, table);
            if (!exists) {
                const applied = await migrationIsApplied(client, migration);
                if (applied) {
                    console.log(`[pre-start] ⚠️  Table "${table}" missing but migration "${migration}" marked applied — will roll back.`);
                    migrationsToRollback.add(migration);
                } else {
                    console.log(`[pre-start] Table "${table}" missing, migration "${migration}" not applied — will be applied by migrate deploy.`);
                }
            } else {
                console.log(`[pre-start] ✓ Table "${table}" exists.`);
            }
        }

        // --- 2. Column-level drift check ---
        // Catches ALTER TABLE migrations that are marked "applied" but never ran
        // (e.g., failed mid-transaction, or DB restored from an older snapshot).
        for (const [tableCol, migration] of Object.entries(COLUMN_MIGRATION_MAP)) {
            const [tableName, colName] = tableCol.split('.');

            // Only check column if the table itself exists
            const tblExists = await tableExists(client, tableName);
            if (!tblExists) {
                // Table missing is already handled above; skip column check
                continue;
            }

            const colExists = await columnExists(client, tableName, colName);
            if (!colExists) {
                const applied = await migrationIsApplied(client, migration);
                if (applied) {
                    console.log(`[pre-start] ⚠️  Column "${tableName}.${colName}" missing but migration "${migration}" marked applied — will roll back.`);
                } else {
                    console.log(`[pre-start] Column "${tableName}.${colName}" missing, migration "${migration}" not yet applied — will be applied by migrate deploy.`);
                }
                migrationsToRollback.add(migration);
            } else {
                console.log(`[pre-start] ✓ Column "${tableName}.${colName}" exists.`);
            }
        }

        // Also check for migrations whose dependent tables exist but sibling
        // migrations (ALTER TABLE, index fixes) are wrongly marked applied.
        // If we're rolling back a migration, also roll back any sibling
        // migrations in the same date group that might reference those tables.
        const siblingMap = {
            '20260228_add_training_tool': [
                '20260228_add_training_token_category',
                '20260228_training_schema_index_fixes',
            ],
            '20260228_add_brand_report': [
                '20260228c_add_brand_report_llmo_score',
            ],
        };

        for (const parent of migrationsToRollback) {
            const siblings = siblingMap[parent] || [];
            for (const sibling of siblings) {
                const applied = await migrationIsApplied(client, sibling);
                if (applied) {
                    console.log(`[pre-start] ⚠️  Sibling migration "${sibling}" also needs rollback.`);
                    migrationsToRollback.add(sibling);
                }
            }
        }

        // Roll back in REVERSE order (newest first) to respect dependency order
        const rollbackList = [...migrationsToRollback].sort().reverse();
        for (const migration of rollbackList) {
            resolveRolledBack(migration);
        }

    } finally {
        await client.end();
    }

    runMigrations();
}

function runMigrations() {
    console.log('[pre-start] Running prisma migrate deploy...');
    try {
        execSync('npx prisma migrate deploy', {
            stdio: 'inherit',
            env: process.env,
        });
        console.log('[pre-start] ✅ Migrations complete.');
    } catch (err) {
        console.error('[pre-start] ❌ prisma migrate deploy failed:', err.message);
        // Exit with error so Railway knows the container failed to start cleanly.
        process.exit(1);
    }
}

main().catch(err => {
    console.error('[pre-start] Fatal error:', err);
    process.exit(1);
});
