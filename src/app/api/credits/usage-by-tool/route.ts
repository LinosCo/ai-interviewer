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

        // Map tool names to display names
        const toolDisplayNames: Record<string, string> = {
            interview: 'Interview AI',
            chatbot: 'Chatbot',
            visibility: 'Visibility Tracker',
            ai_tips: 'AI Tips',
            copilot: 'Copilot Strategico',
            export: 'Export'
        };

        const byTool: Record<string, { used: number; percentage: number; displayName: string }> = {};

        usageByTool.forEach(usage => {
            byTool[usage.tool] = {
                used: Number(usage.creditsUsed),
                percentage: usage.percentage,
                displayName: toolDisplayNames[usage.tool] || usage.tool
            };
        });

        return NextResponse.json({
            period,
            byTool,
            tools: usageByTool.map(u => ({
                id: u.tool,
                name: toolDisplayNames[u.tool] || u.tool,
                creditsUsed: Number(u.creditsUsed),
                transactionCount: u.transactionCount,
                percentage: u.percentage
            }))
        });
    } catch (error) {
        console.error('Error fetching usage by tool:', error);
        return NextResponse.json(
            { error: 'Errore nel recupero del consumo per strumento' },
            { status: 500 }
        );
    }
}
