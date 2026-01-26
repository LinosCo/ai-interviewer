/**
 * API Route: /api/credits/usage-by-tool
 *
 * GET: Restituisce consumo crediti per strumento (per grafici dashboard)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { CreditService } from '@/services/creditService';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const usageByTool = await CreditService.getUsageByTool(session.user.id);

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
