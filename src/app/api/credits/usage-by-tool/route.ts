/**
 * API Route: /api/credits/usage-by-tool
 *
 * GET: Restituisce consumo crediti per strumento (per grafici dashboard)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CreditService } from '@/services/creditService';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const organizationId = searchParams.get('organizationId');

        let targetOrgId = organizationId;

        if (!targetOrgId) {
            // Find user's primary organization
            const membership = await prisma.membership.findFirst({
                where: { userId: session.user.id },
                select: { organizationId: true }
            });
            if (!membership) {
                return NextResponse.json({ error: 'No organization found' }, { status: 404 });
            }
            targetOrgId = membership.organizationId;
        } else {
            // Verify membership if orgId provided
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

        const usageByTool = await CreditService.getUsageByTool(targetOrgId);

        // Get current period
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Normalize raw DB tool ids and always return a complete list for UI consistency
        const normalizeToolId = (raw: string): string => {
            const value = (raw || '').toLowerCase();
            if (value === 'interview') return 'interview';
            if (value === 'chatbot') return 'chatbot';
            if (value === 'training') return 'training';
            if (value === 'visibility') return 'brand_monitor';
            if (value === 'ai_tips' || value === 'tips') return 'ai_tips';
            if (value === 'copilot') return 'copilot';
            if (value === 'automation') return 'automation';
            if (value === 'export') return 'export';
            return value || 'other';
        };

        const toolDisplayNames: Record<string, string> = {
            interview: 'Interviste',
            chatbot: 'Chatbot',
            training: 'Formazione',
            brand_monitor: 'Brand Monitor',
            ai_tips: 'AI Tips',
            copilot: 'Copilot',
            automation: 'Automation',
            export: 'Export',
            other: 'Altro',
        };

        const normalizedTotals = new Map<string, { creditsUsed: number; transactionCount: number }>();
        for (const row of usageByTool) {
            const id = normalizeToolId(row.tool);
            const current = normalizedTotals.get(id) ?? { creditsUsed: 0, transactionCount: 0 };
            normalizedTotals.set(id, {
                creditsUsed: current.creditsUsed + Number(row.creditsUsed),
                transactionCount: current.transactionCount + row.transactionCount,
            });
        }

        const orderedToolIds = [
            'interview',
            'chatbot',
            'training',
            'brand_monitor',
            'ai_tips',
            'copilot',
            'automation',
            'export',
        ];

        const totalUsed = Array.from(normalizedTotals.values()).reduce((sum, t) => sum + t.creditsUsed, 0);

        const tools = orderedToolIds.map((id) => {
            const item = normalizedTotals.get(id) ?? { creditsUsed: 0, transactionCount: 0 };
            const percentage = totalUsed > 0 ? Math.round((item.creditsUsed / totalUsed) * 100) : 0;
            return {
                id,
                name: toolDisplayNames[id] || id,
                creditsUsed: item.creditsUsed,
                transactionCount: item.transactionCount,
                percentage,
            };
        });

        // Also append any unexpected tools at the end
        for (const [id, item] of normalizedTotals.entries()) {
            if (orderedToolIds.includes(id)) continue;
            const percentage = totalUsed > 0 ? Math.round((item.creditsUsed / totalUsed) * 100) : 0;
            tools.push({
                id,
                name: toolDisplayNames[id] || id,
                creditsUsed: item.creditsUsed,
                transactionCount: item.transactionCount,
                percentage,
            });
        }

        const byTool: Record<string, { used: number; percentage: number; displayName: string }> = {};
        for (const tool of tools) {
            byTool[tool.id] = {
                used: tool.creditsUsed,
                percentage: tool.percentage,
                displayName: tool.name,
            };
        }

        return NextResponse.json({
            period,
            byTool,
            tools
        });
    } catch (error) {
        console.error('Error fetching usage by tool:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero del consumo per strumento' },
            { status: 500 }
        );
    }
}
