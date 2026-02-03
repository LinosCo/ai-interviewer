import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

/**
 * Generate a unique key for a tip based on its content
 */
function generateTipKey(title: string, type: string): string {
    const content = `${title}-${type}`;
    return createHash('md5').update(content).digest('hex').substring(0, 16);
}

/**
 * GET - Fetch tip actions for a config
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const configId = searchParams.get('configId');
        const status = searchParams.get('status'); // active, completed, dismissed

        if (!configId) {
            return NextResponse.json({ error: 'configId required' }, { status: 400 });
        }

        const where: any = { configId };
        if (status) {
            where.status = status;
        }

        const tipActions = await prisma.tipAction.findMany({
            where,
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json({ tipActions });
    } catch (error) {
        console.error('[tip-actions] GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch tip actions' }, { status: 500 });
    }
}

/**
 * POST - Create or update a tip action
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { configId, tipTitle, tipType, action, notes } = body;

        if (!configId || !tipTitle || !tipType || !action) {
            return NextResponse.json(
                { error: 'configId, tipTitle, tipType, and action required' },
                { status: 400 }
            );
        }

        const tipKey = generateTipKey(tipTitle, tipType);

        let status: string;
        let completedAt: Date | null = null;
        let dismissedAt: Date | null = null;

        switch (action) {
            case 'complete':
                status = 'completed';
                completedAt = new Date();
                break;
            case 'dismiss':
                status = 'dismissed';
                dismissedAt = new Date();
                break;
            case 'restore':
                status = 'active';
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const tipAction = await prisma.tipAction.upsert({
            where: {
                configId_tipKey: { configId, tipKey }
            },
            create: {
                configId,
                tipKey,
                tipTitle,
                tipType,
                status,
                completedAt,
                dismissedAt,
                notes
            },
            update: {
                status,
                completedAt,
                dismissedAt,
                notes: notes || undefined
            }
        });

        return NextResponse.json({ success: true, tipAction });
    } catch (error) {
        console.error('[tip-actions] POST error:', error);
        return NextResponse.json({ error: 'Failed to update tip action' }, { status: 500 });
    }
}

/**
 * DELETE - Delete a tip action (restore to original state)
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const configId = searchParams.get('configId');
        const tipKey = searchParams.get('tipKey');

        if (!configId || !tipKey) {
            return NextResponse.json({ error: 'configId and tipKey required' }, { status: 400 });
        }

        await prisma.tipAction.delete({
            where: {
                configId_tipKey: { configId, tipKey }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[tip-actions] DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete tip action' }, { status: 500 });
    }
}
