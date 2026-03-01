/**
 * API Route: /api/cron/backup-db
 *
 * Cron job per il backup giornaliero del database PostgreSQL.
 * Salva i backup direttamente su Railway Volume (filesystem persistente).
 *
 * ─── SETUP RAILWAY VOLUME ─────────────────────────────────────────────────
 * 1. Dashboard Railway → Il tuo servizio → Settings → Volumes
 *    → "New Volume" → Mount Path: /app/backups → Crea
 *
 * 2. Aggiungi l'env var al servizio Railway:
 *    BACKUP_PATH = /app/backups
 *
 * 3. Aggiungi il cron su Railway:
 *    Dashboard → New Service → Cron Job
 *    Command: POST /api/cron/backup-db
 *    Schedule: 0 2 * * * (ogni giorno alle 2:00 UTC)
 *    Header: Authorization: Bearer ${CRON_SECRET}
 *
 * ─── RECOVERY ──────────────────────────────────────────────────────────────
 * I backup si trovano in /app/backups/db-backup-YYYY-MM-DD.json.gz
 * Per scaricarli usa: railway run -- cat /app/backups/db-backup-2026-03-01.json.gz > backup.json.gz
 * Per ripristinare: decomprime il .gz e usa i dati JSON
 * ────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';
import { getS3ConfigFromEnv, uploadToS3 } from '@/lib/backup/s3Upload';

// Tabelle da includere nel backup (ordine: prima le tabelle parent)
const BACKUP_TABLES = [
    'User',
    'Organization',
    'OrganizationMember',
    'Subscription',
    'OrgCreditPack',
    'CreditTransaction',
    'Project',
    'ProjectMember',
    'Bot',
    'InterviewResult',
    'KnowledgeSource',
    'KnowledgeDocument',
    'VisibilityConfig',
    'BrandReport',
    'GlobalConfig',
    'TipRoutingRule',
    'TrainingBot',
    'TrainingSession',
    'N8NConnection',
    'GoogleConnection',
    'MCPConnection',
] as const;

const RETENTION_DAYS = 7; // conserva backup degli ultimi 7 giorni

async function exportTable(pool: Pool, tableName: string): Promise<{ count: number; rows: unknown[] }> {
    try {
        const result = await pool.query(`SELECT * FROM "${tableName}" LIMIT 100000`);
        return { count: result.rowCount ?? 0, rows: result.rows };
    } catch {
        console.warn(`[backup-db] Tabella ${tableName} non trovata, skip.`);
        return { count: 0, rows: [] };
    }
}

function cleanOldBackups(backupDir: string, retentionDays: number): string[] {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const deleted: string[] = [];

    try {
        const files = readdirSync(backupDir).filter((f) => f.startsWith('db-backup-') && f.endsWith('.json.gz'));
        for (const file of files) {
            const filePath = join(backupDir, file);
            const { mtimeMs } = statSync(filePath);
            if (mtimeMs < cutoff) {
                unlinkSync(filePath);
                deleted.push(file);
            }
        }
    } catch {
        // Non bloccante
    }

    return deleted;
}

export async function POST(request: Request) {
    try {
        // Auth: Bearer token obbligatorio per cron job
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            return NextResponse.json({ error: 'DATABASE_URL non configurata' }, { status: 500 });
        }

        // Directory di backup: Railway Volume (BACKUP_PATH) o /tmp come fallback temporaneo
        const backupDir = process.env.BACKUP_PATH ?? '/tmp/backups';
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const fileName = `db-backup-${dateStr}.json.gz`;
        const filePath = join(backupDir, fileName);

        console.log(`[Cron][backup-db] Avvio backup ${dateStr} → ${filePath}`);

        // 1. Crea la directory se non esiste
        mkdirSync(backupDir, { recursive: true });

        // 2. Connessione diretta al DB via pg
        const pool = new Pool({
            connectionString: databaseUrl,
            ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech')
                ? { rejectUnauthorized: false }
                : undefined,
            max: 3,
            connectionTimeoutMillis: 15000,
        });

        // 3. Esporta ogni tabella
        const backupData: Record<string, unknown> = {
            _meta: {
                version: 1,
                createdAt: now.toISOString(),
                retentionDays: RETENTION_DAYS,
                tables: BACKUP_TABLES,
            },
        };

        const stats: Record<string, number> = {};
        let totalRows = 0;

        for (const table of BACKUP_TABLES) {
            const { count, rows } = await exportTable(pool, table);
            backupData[table] = rows;
            stats[table] = count;
            totalRows += count;
            console.log(`[backup-db] ${table}: ${count} righe`);
        }

        await pool.end();

        // 4. Comprimi e scrivi su disco (Railway Volume)
        const compressed = gzipSync(Buffer.from(JSON.stringify(backupData), 'utf-8'));
        const sizeKb = Math.round(compressed.length / 1024);
        writeFileSync(filePath, compressed);

        console.log(`[backup-db] Salvato: ${filePath} (${sizeKb} KB, ${totalRows} righe)`);

        // 5. Pulizia file vecchi
        const deletedFiles = cleanOldBackups(backupDir, RETENTION_DAYS);
        if (deletedFiles.length > 0) {
            console.log(`[backup-db] Eliminati backup scaduti: ${deletedFiles.join(', ')}`);
        }

        // 6. Upload opzionale su S3/R2 per off-site backup
        let uploadedTo: string | null = null;
        const s3Config = getS3ConfigFromEnv();
        if (s3Config) {
            try {
                const s3Key = `backups/${dateStr}/${fileName}`;
                await uploadToS3(s3Config, s3Key, compressed);
                uploadedTo = `${s3Config.bucket}/${s3Key}`;
                console.log(`[backup-db] Anche caricato su S3: ${uploadedTo}`);
            } catch (s3Err) {
                // S3 è opzionale: non bloccare il backup locale se fallisce
                console.error('[backup-db] Upload S3 fallito (backup locale ok):', s3Err);
            }
        }

        return NextResponse.json({
            success: true,
            date: dateStr,
            filePath,
            sizeKb,
            totalRows,
            deletedOldBackups: deletedFiles,
            offSiteBackup: uploadedTo,
            stats,
            timestamp: now.toISOString(),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Errore sconosciuto';
        console.error('[Cron][backup-db] Errore:', error);
        return NextResponse.json(
            { error: 'Backup fallito', detail: message, timestamp: new Date().toISOString() },
            { status: 500 }
        );
    }
}

/**
 * GET: Stato backup — lista file presenti nel volume
 */
export async function GET() {
    const backupDir = process.env.BACKUP_PATH ?? '/tmp/backups';
    const volumeConfigured = !!process.env.BACKUP_PATH;

    let files: Array<{ name: string; sizeKb: number; date: string }> = [];

    try {
        mkdirSync(backupDir, { recursive: true });
        files = readdirSync(backupDir)
            .filter((f) => f.startsWith('db-backup-') && f.endsWith('.json.gz'))
            .map((f) => {
                const filePath = join(backupDir, f);
                const { size, mtimeMs } = statSync(filePath);
                return {
                    name: f,
                    sizeKb: Math.round(size / 1024),
                    date: new Date(mtimeMs).toISOString(),
                };
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    } catch {
        // Volume non ancora montato
    }

    return NextResponse.json({
        status: 'ok',
        endpoint: 'backup-db',
        volumeConfigured,
        backupDir,
        retentionDays: RETENTION_DAYS,
        backupCount: files.length,
        latestBackup: files[0]?.name ?? null,
        backups: files,
        setup: volumeConfigured
            ? 'Volume configurato ✓'
            : 'Aggiungi BACKUP_PATH=/app/backups e monta un Railway Volume su /app/backups',
    });
}
