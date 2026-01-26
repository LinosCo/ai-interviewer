/**
 * API Route: /api/credits/history
 *
 * GET: Restituisce storico transazioni crediti
 * Query params:
 *   - from: data inizio (ISO string)
 *   - to: data fine (ISO string)
 *   - tool: filtro per tool (optional)
 *   - limit: numero massimo risultati (default 50)
 *   - offset: offset per paginazione (default 0)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');
        const tool = searchParams.get('tool');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
        const offset = parseInt(searchParams.get('offset') || '0');

        // Build where clause
        const where: Record<string, unknown> = {
            userId: session.user.id,
            type: 'usage'
        };

        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) {
                (where.createdAt as Record<string, Date>).gte = new Date(fromDate);
            }
            if (toDate) {
                (where.createdAt as Record<string, Date>).lte = new Date(toDate);
            }
        }

        if (tool) {
            where.tool = tool;
        }

        // Fetch transactions
        const transactions = await prisma.creditTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                project: {
                    select: { id: true, name: true }
                }
            }
        });

        // Get total count for pagination
        const totalCount = await prisma.creditTransaction.count({ where });

        // Calculate summary by tool for the period
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const summaryWhere: Record<string, unknown> = {
            userId: session.user.id,
            type: 'usage',
            createdAt: { gte: startOfMonth }
        };

        const summary = await prisma.creditTransaction.groupBy({
            by: ['tool'],
            where: summaryWhere,
            _sum: { amount: true }
        });

        const summaryByTool: Record<string, number> = {};
        summary.forEach(s => {
            if (s.tool) {
                summaryByTool[s.tool] = Number(s._sum.amount || 0);
            }
        });

        return NextResponse.json({
            transactions: transactions.map(t => ({
                id: t.id,
                date: t.createdAt.toISOString(),
                tool: t.tool,
                action: t.action,
                amount: Number(t.amount),
                project: t.project?.name || null,
                projectId: t.project?.id || null,
                description: t.description
            })),
            pagination: {
                total: totalCount,
                limit,
                offset,
                hasMore: offset + transactions.length < totalCount
            },
            summary: summaryByTool
        });
    } catch (error) {
        console.error('Error fetching credit history:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero dello storico' },
            { status: 500 }
        );
    }
}
