import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * Health check endpoint for Railway uptime monitoring.
 * Returns service status, Railway PostgreSQL connectivity, and pool info.
 */
export async function GET() {
    const startMs = Date.now();

    // DB connectivity check
    let dbStatus: 'ok' | 'error' = 'error';
    let dbLatencyMs: number | null = null;
    let dbError: string | undefined;

    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - dbStart;
        dbStatus = 'ok';
    } catch (err: any) {
        dbError = err?.message ?? 'Unknown DB error';
    }

    const totalMs = Date.now() - startMs;
    const healthy = dbStatus === 'ok';

    return NextResponse.json(
        {
            status: healthy ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime ? Math.floor(process.uptime()) : null,
            db: {
                status: dbStatus,
                latencyMs: dbLatencyMs,
                ...(dbError ? { error: dbError } : {}),
                pool: {
                    max: parseInt(process.env.DB_POOL_MAX ?? '20'),
                    min: parseInt(process.env.DB_POOL_MIN ?? '2'),
                },
            },
            responseMs: totalMs,
        },
        { status: healthy ? 200 : 503 }
    );
}
