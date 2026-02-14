/**
 * API Route: /api/credits/history
 *
 * GET: Restituisce storico transazioni crediti organizzazione
 * Query params:
 *   - from: data inizio (ISO string)
 *   - to: data fine (ISO string)
 *   - tool: filtro per tool (optional)
 *   - organizationId: organizzazione target (optional, default primary org)
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
        const organizationId = searchParams.get('organizationId');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        let targetOrgId = organizationId;

        if (!targetOrgId) {
            const membership = await prisma.membership.findFirst({
                where: { userId: session.user.id },
                select: { organizationId: true }
            });

            if (!membership) {
                return NextResponse.json({ error: 'No organization found' }, { status: 404 });
            }

            targetOrgId = membership.organizationId;
        } else {
            const membership = await prisma.membership.findUnique({
                where: {
                    userId_organizationId: {
                        userId: session.user.id,
                        organizationId: targetOrgId
                    }
                }
            });

            if (!membership) {
                return NextResponse.json({ error: 'Access denied' }, { status: 403 });
            }
        }

        const where: Record<string, unknown> = {
            organizationId: targetOrgId,
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

        const transactions = await prisma.orgCreditTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        const totalCount = await prisma.orgCreditTransaction.count({ where });

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const summary = await prisma.orgCreditTransaction.groupBy({
            by: ['tool'],
            where: {
                organizationId: targetOrgId,
                type: 'usage',
                createdAt: { gte: startOfMonth }
            },
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
                project: null,
                projectId: t.projectId || null,
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
