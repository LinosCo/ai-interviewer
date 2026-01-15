import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    const { botId } = await params;
    const session = await auth();

    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const gaps = await prisma.knowledgeGap.findMany({
        where: {
            botId,
            status: { not: 'dismissed' } // Show pending and approved(history) or just pending? Docs imply managing gaps.
        },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ gaps });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    // Manually create a gap? Or generic handler.
    // Docs don't explicitly ask for manual creation of gaps via API, mostly auto-detected.
    // But good to have if user wants to log a gap manually.
    const { botId } = await params;
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const body = await req.json();
        const { topic, priority } = body;

        const gap = await prisma.knowledgeGap.create({
            data: {
                botId,
                topic,
                priority: priority || 'medium',
                evidence: { manual: true },
                status: 'pending'
            }
        });

        return NextResponse.json(gap);
    } catch (e) {
        return new NextResponse("Error creating gap", { status: 500 });
    }
}
